/**
 * Status Bar Controller
 * Manages the status bar item display with click-to-cycle functionality
 */

import * as vscode from 'vscode';
import { ConfigService } from '../shared/config';
import { ICONS } from '../shared/constants';

export class StatusBarController {
    private statusBarItem: vscode.StatusBarItem;
    private config: ConfigService;
    private state: 'off' | 'on' | 'multi' | 'loading' | 'error' = 'off';
    private quotaPercent: number = 100;

    constructor(context: vscode.ExtensionContext, config: ConfigService) {
        this.config = config;

        // Create status bar item with high priority (appears on right side)
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        // Use cycleState command for click-to-cycle behavior
        this.statusBarItem.command = 'freehand.cycleState';

        context.subscriptions.push(this.statusBarItem);
        this.statusBarItem.show();

        // Listen for config changes
        config.onConfigChange(() => this.update());
    }

    update(): void {
        const cfg = this.config.getAll();
        const isEnabled = cfg.autoAccept.enabled || cfg.autoRun.enabled;
        const isMultiTab = cfg.multiTab.enabled;

        if (this.state === 'loading') {
            return;
        }

        if (!isEnabled) {
            this.state = 'off';
            this.statusBarItem.text = `${ICONS.OFF} OFF`;
            this.statusBarItem.backgroundColor = undefined;
        } else if (isMultiTab) {
            this.state = 'multi';
            this.statusBarItem.text = `${ICONS.MULTI} Multi`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.state = 'on';
            this.statusBarItem.text = `${ICONS.ON} ON`;
            this.statusBarItem.backgroundColor = undefined;
        }

        this.updateTooltip();
    }

    updateQuota(percent: number): void {
        this.quotaPercent = percent;
        this.updateTooltip();
    }

    setLoading(): void {
        this.state = 'loading';
        this.statusBarItem.text = `${ICONS.LOADING} Loading...`;
        this.statusBarItem.backgroundColor = undefined;
    }

    setError(message?: string): void {
        this.state = 'error';
        this.statusBarItem.text = `${ICONS.ERROR} Error`;
        this.statusBarItem.tooltip = message || 'FreeHand encountered an error';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    private updateTooltip(): void {
        const cfg = this.config.getAll();
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;

        // Header with current state
        const stateText = this.state === 'off' ? 'OFF'
            : this.state === 'multi' ? 'ON (Multi-Tab)'
                : 'ON (Single Tab)';

        md.appendMarkdown(`**FreeHand AntiGravity:** ${stateText}\n\n`);

        // Cycle action hint
        const nextAction = this.state === 'off'
            ? 'Click → Enable (Single Tab)'
            : this.state === 'on'
                ? 'Click → Multi-Tab Mode'
                : 'Click → Disable';

        md.appendMarkdown(`→ ${nextAction}\n\n`);

        // Quick status
        md.appendMarkdown('---\n\n');
        md.appendMarkdown(`📊 Quota: **${this.quotaPercent}%**\n\n`);

        // Feature status with icons
        md.appendMarkdown(`${cfg.autoAccept.enabled ? '✅' : '⬜'} Auto-Accept  `);
        md.appendMarkdown(`${cfg.autoRun.enabled ? '✅' : '⬜'} Auto-Run  `);
        md.appendMarkdown(`${cfg.autoRetry.enabled ? '✅' : '⬜'} Auto-Retry\n\n`);

        // Settings link
        md.appendMarkdown('---\n\n');
        md.appendMarkdown('[⚙️ Open Settings](command:freehand.openSettings)');

        this.statusBarItem.tooltip = md;
    }

    getState(): 'off' | 'on' | 'multi' | 'loading' | 'error' {
        return this.state;
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
