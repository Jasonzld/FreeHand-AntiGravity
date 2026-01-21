/**
 * Auto Clicker Engine
 * Handles CDP connection and automatic button clicking
 */

import * as vscode from 'vscode';
import WebSocket from 'ws';
import { ConfigService } from '../shared/config';
import { Logger } from '../shared/logger';
import { ACCEPT_PATTERNS, REJECT_PATTERNS, CDP_DEFAULT_PORT, CDP_POLL_INTERVAL_MS } from '../shared/constants';
import { InputGuard } from './input-guard';
import { SafetyFilter } from './safety-filter';

interface CDPTarget {
    id: string;
    title: string;
    type: string;
    webSocketDebuggerUrl?: string;
}

export class AutoClicker {
    private config: ConfigService;
    private logger: Logger;
    private inputGuard: InputGuard;
    private safetyFilter: SafetyFilter;
    private ws: WebSocket | null = null;
    private isRunning = false;
    private pollInterval: NodeJS.Timeout | null = null;
    private messageId = 0;

    constructor(config: ConfigService, logger: Logger) {
        this.config = config;
        this.logger = logger;
        this.inputGuard = new InputGuard();
        this.safetyFilter = new SafetyFilter(config);
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.logger.info('AutoClicker starting...');
        this.isRunning = true;

        try {
            await this.connect();
            this.startPolling();
        } catch (error) {
            this.logger.error('Failed to start AutoClicker', error);
            this.isRunning = false;
        }
    }

    stop(): void {
        this.logger.info('AutoClicker stopping...');
        this.isRunning = false;
        this.stopPolling();
        this.disconnect();
    }

    private async connect(): Promise<void> {
        const port = CDP_DEFAULT_PORT;
        const targetsUrl = `http://127.0.0.1:${port}/json`;

        try {
            const response = await fetch(targetsUrl);
            const targets: CDPTarget[] = await response.json() as CDPTarget[];

            // Find a suitable target (page type)
            const target = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);

            if (!target?.webSocketDebuggerUrl) {
                throw new Error('No suitable CDP target found');
            }

            this.ws = new WebSocket(target.webSocketDebuggerUrl);

            await new Promise<void>((resolve, reject) => {
                this.ws!.on('open', () => {
                    this.logger.info('CDP connection established');
                    resolve();
                });
                this.ws!.on('error', reject);
            });

            // Enable Runtime domain
            await this.sendCDP('Runtime.enable');

        } catch (error) {
            this.logger.warn('CDP connection failed, will retry...', error);
            throw error;
        }
    }

    private disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    private async sendCDP(method: string, params?: Record<string, unknown>): Promise<unknown> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }

        const id = ++this.messageId;
        const message = JSON.stringify({ id, method, params });

        return new Promise((resolve, reject) => {
            const handler = (data: WebSocket.Data) => {
                const response = JSON.parse(data.toString());
                if (response.id === id) {
                    this.ws!.off('message', handler);
                    if (response.error) {
                        reject(new Error(response.error.message));
                    } else {
                        resolve(response.result);
                    }
                }
            };
            this.ws!.on('message', handler);
            this.ws!.send(message);
        });
    }

    private startPolling(): void {
        if (this.pollInterval) {
            return;
        }

        this.pollInterval = setInterval(async () => {
            if (!this.isRunning) {
                return;
            }

            try {
                await this.performAutoClick();
            } catch (error) {
                this.logger.debug('Poll cycle error', error);
            }
        }, CDP_POLL_INTERVAL_MS);
    }

    private stopPolling(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    private async performAutoClick(): Promise<void> {
        const script = this.generateClickScript();

        try {
            const result = await this.sendCDP('Runtime.evaluate', {
                expression: script,
                returnByValue: true,
            }) as { result?: { value?: { clicked: number; skipped: string } } };

            const value = result?.result?.value;
            if (value?.clicked && value.clicked > 0) {
                this.logger.info(`Clicked ${value.clicked} buttons`);
            }
            if (value?.skipped) {
                this.logger.debug(`Skipped: ${value.skipped}`);
            }
        } catch (error) {
            // Ignore evaluation errors
        }
    }

    private generateClickScript(): string {
        const acceptPatterns = JSON.stringify(ACCEPT_PATTERNS);
        const rejectPatterns = JSON.stringify(REJECT_PATTERNS);
        const blocklist = JSON.stringify(this.config.get<string[]>('safety.blocklist') ?? []);

        return `
(function() {
    const ACCEPT_PATTERNS = ${acceptPatterns};
    const REJECT_PATTERNS = ${rejectPatterns};
    const BLOCKLIST = ${blocklist};

    // Check if user is typing
    function isUserTyping() {
        const activeEl = document.activeElement;
        if (!activeEl) return false;
        
        const tagName = activeEl.tagName?.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') return true;
        if (activeEl.isContentEditable) return true;
        if (activeEl.closest('.monaco-editor')) return true;
        if (activeEl.closest('[class*="input"]')) return true;
        if (activeEl.closest('.ProseMirror')) return true;
        
        return false;
    }

    if (isUserTyping()) {
        return { clicked: 0, skipped: 'user typing' };
    }

    // Check if command is blocked
    function isCommandBlocked(text) {
        const lowerText = text.toLowerCase();
        for (const pattern of BLOCKLIST) {
            if (lowerText.includes(pattern.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    // Check if button should be clicked
    function isAcceptButton(el) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.length === 0 || text.length > 50) return false;
        
        // Check reject patterns first
        if (REJECT_PATTERNS.some(p => text.includes(p))) return false;
        
        // Check accept patterns
        if (!ACCEPT_PATTERNS.some(p => text.includes(p))) return false;
        
        // Check visibility
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (style.display === 'none' || rect.width === 0) return false;
        if (style.pointerEvents === 'none' || el.disabled) return false;
        
        return true;
    }

    // Find and click buttons
    let clicked = 0;
    const buttons = document.querySelectorAll('button, [role="button"], [class*="button"]');
    
    for (const btn of buttons) {
        if (isAcceptButton(btn)) {
            const text = btn.textContent.trim();
            
            // Check for blocked commands
            if (text.toLowerCase().includes('run') || text.toLowerCase().includes('execute')) {
                const pre = btn.closest('div')?.querySelector('pre, code');
                if (pre && isCommandBlocked(pre.textContent)) {
                    continue; // Skip blocked command
                }
            }
            
            btn.click();
            clicked++;
        }
    }

    return { clicked, skipped: null };
})();
        `;
    }
}
