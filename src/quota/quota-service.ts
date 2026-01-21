/**
 * Quota Service
 * Monitors and displays real quota information from Antigravity API
 */

import * as vscode from 'vscode';
import * as https from 'https';
import { ConfigService } from '../shared/config';
import { Logger } from '../shared/logger';
import { ProcessHunter } from './process-hunter';
import {
    QuotaSnapshot,
    ModelQuotaInfo,
    UserInfo,
    ServerUserStatusResponse,
    EnvironmentScanResult
} from './types';

// Re-export types for external use
export { QuotaSnapshot, ModelQuotaInfo, UserInfo };

// Re-export QuotaInfo interface for status bar
export interface QuotaInfo {
    email?: string;
    plan?: string;
    percentage: number;
    remaining?: number;
    total?: number;
    resetTime?: string;
    status: 'ok' | 'warning' | 'critical' | 'unknown';
}

const API_ENDPOINT = '/exa.language_server_pb.LanguageServerService/GetUserStatus';

export class QuotaService {
    private config: ConfigService;
    private logger: Logger;
    private hunter: ProcessHunter;
    private monitorInterval: NodeJS.Timeout | null = null;
    private connectionInfo: EnvironmentScanResult | null = null;
    private currentQuota: QuotaInfo = { percentage: 100, status: 'unknown' };
    private lastSnapshot: QuotaSnapshot | null = null;

    private _onQuotaUpdate = new vscode.EventEmitter<QuotaInfo>();
    public readonly onQuotaUpdate = this._onQuotaUpdate.event;

    constructor(config: ConfigService, logger: Logger) {
        this.config = config;
        this.logger = logger;
        this.hunter = new ProcessHunter(logger);
    }

    async refresh(): Promise<QuotaInfo> {
        try {
            // Ensure we have connection info
            if (!this.connectionInfo) {
                this.connectionInfo = await this.hunter.scanEnvironment(2);
                if (!this.connectionInfo) {
                    this.logger.warn('Cannot connect to Antigravity process');
                    this.currentQuota = { percentage: 0, status: 'unknown' };
                    this._onQuotaUpdate.fire(this.currentQuota);
                    return this.currentQuota;
                }
            }

            // Fetch quota data
            const response = await this.fetchUserStatus();
            this.lastSnapshot = this.decodeResponse(response);

            // Calculate overall quota
            this.currentQuota = this.calculateQuotaInfo(this.lastSnapshot);
            this._onQuotaUpdate.fire(this.currentQuota);

            this.logger.info(`Quota refreshed: ${this.currentQuota.percentage}%`);
            return this.currentQuota;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error('Failed to refresh quota', err);

            // Reset connection info on error
            this.connectionInfo = null;
            this.currentQuota = { percentage: 0, status: 'unknown' };
            this._onQuotaUpdate.fire(this.currentQuota);
            return this.currentQuota;
        }
    }

    getCurrentQuota(): QuotaInfo {
        return this.currentQuota;
    }

    getLastSnapshot(): QuotaSnapshot | null {
        return this.lastSnapshot;
    }

    startMonitoring(): void {
        if (this.monitorInterval) {
            return;
        }

        const intervalMs = this.config.getRefreshIntervalMs();
        this.logger.info(`Starting quota monitoring (interval: ${intervalMs}ms)`);

        // Initial refresh
        this.refresh();

        // Start periodic refresh
        this.monitorInterval = setInterval(() => {
            this.refresh();
        }, intervalMs);

        // Listen for config changes
        this.config.onConfigChange(() => {
            this.restartMonitoring();
        });
    }

    stopMonitoring(): void {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            this.logger.info('Quota monitoring stopped');
        }
    }

    private restartMonitoring(): void {
        this.stopMonitoring();
        this.startMonitoring();
    }

    private async fetchUserStatus(): Promise<ServerUserStatusResponse> {
        if (!this.connectionInfo) {
            throw new Error('Not connected to Antigravity');
        }

        return new Promise((resolve, reject) => {
            const payload = JSON.stringify({
                metadata: {
                    ideName: 'antigravity',
                    extensionName: 'antigravity',
                    locale: 'en',
                },
            });

            const options: https.RequestOptions = {
                hostname: '127.0.0.1',
                port: this.connectionInfo!.connectPort,
                path: API_ENDPOINT,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    'Connect-Protocol-Version': '1',
                    'X-Codeium-Csrf-Token': this.connectionInfo!.csrfToken,
                },
                rejectUnauthorized: false,
                timeout: 10000,
            };

            const req = https.request(options, res => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try {
                        if (!body || body.trim().length === 0) {
                            reject(new Error('Empty response'));
                            return;
                        }
                        resolve(JSON.parse(body) as ServerUserStatusResponse);
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e}`));
                    }
                });
            });

            req.on('error', e => reject(new Error(`Request failed: ${e.message}`)));
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
            req.write(payload);
            req.end();
        });
    }

    private decodeResponse(response: ServerUserStatusResponse): QuotaSnapshot {
        const user = response.userStatus;
        const now = Date.now();

        // Extract user info
        const userInfo: UserInfo | undefined = user ? {
            name: user.name || '',
            email: user.email || '',
            planName: user.planStatus?.planInfo?.planName || 'Free',
            tier: user.planStatus?.planInfo?.teamsTier || 'FREE',
            monthlyPromptCredits: user.planStatus?.planInfo?.monthlyPromptCredits || 0,
            availablePromptCredits: user.planStatus?.availablePromptCredits || 0,
        } : undefined;

        // Extract model quotas
        const models: ModelQuotaInfo[] = [];
        const configs = user?.cascadeModelConfigData?.clientModelConfigs || [];

        for (const cfg of configs) {
            const quota = cfg.quotaInfo;
            if (!quota) continue;

            const remainingFraction = Math.min(1, Math.max(0, quota.remainingFraction ?? 0));
            let resetTime = new Date(now + 24 * 60 * 60 * 1000);

            if (quota.resetTime) {
                const parsed = new Date(quota.resetTime);
                if (!isNaN(parsed.getTime())) {
                    resetTime = parsed;
                }
            }

            const timeUntilReset = Math.max(0, resetTime.getTime() - now);

            models.push({
                label: cfg.label || 'Unknown',
                modelId: cfg.modelOrAlias?.model || cfg.label || 'unknown',
                remainingFraction,
                remainingPercentage: remainingFraction * 100,
                isExhausted: remainingFraction <= 0,
                resetTime,
                resetTimeDisplay: this.formatTime(resetTime),
                timeUntilReset,
                timeUntilResetFormatted: this.formatDuration(timeUntilReset),
            });
        }

        // Sort by label
        models.sort((a, b) => a.label.localeCompare(b.label));

        return {
            timestamp: new Date(),
            userInfo,
            models,
            isConnected: true,
        };
    }

    private calculateQuotaInfo(snapshot: QuotaSnapshot): QuotaInfo {
        if (!snapshot.isConnected || snapshot.models.length === 0) {
            return { percentage: 0, status: 'unknown' };
        }

        // Find the lowest quota percentage
        let minPercentage = 100;
        for (const model of snapshot.models) {
            const pct = model.remainingPercentage ?? 100;
            if (pct < minPercentage) {
                minPercentage = pct;
            }
        }

        const warningThreshold = this.config.get<number>('quota.warningThreshold') ?? 30;
        let status: 'ok' | 'warning' | 'critical' = 'ok';

        if (minPercentage <= 10) {
            status = 'critical';
        } else if (minPercentage <= warningThreshold) {
            status = 'warning';
        }

        return {
            email: snapshot.userInfo?.email,
            plan: snapshot.userInfo?.planName,
            percentage: Math.round(minPercentage),
            remaining: snapshot.userInfo?.availablePromptCredits,
            total: snapshot.userInfo?.monthlyPromptCredits,
            status,
        };
    }

    private formatTime(date: Date): string {
        return date.toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    private formatDuration(ms: number): string {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}天`;
        } else if (hours > 0) {
            return `${hours}小时${minutes}分钟`;
        } else {
            return `${minutes}分钟`;
        }
    }
}
