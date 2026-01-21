/**
 * Status Bar Controller
 * Manages the status bar item display
 */

import * as vscode from 'vscode';
import { ConfigService } from '../shared/config';
import { ICONS } from '../shared/constants';

export class StatusBarController {
    private statusBarItem: vscode.StatusBarItem;
    private config: ConfigService;
    private state: 'off' | 'on' | 'multi' | 'loading' | 'error' = 'off';

    constructor(context: vscode.ExtensionContext, config: ConfigService) {
        this.config = config;

        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'freehand.toggle';
        this.statusBarItem.tooltip = 'Click to toggle FreeHand automation';

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
            // Don't update while loading
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
        const lines: string[] = [
            '**FreeHand AntiGravity**',
            '',
            `• Auto-Accept: ${cfg.autoAccept.enabled ? '✅' : '❌'}`,
            `• Auto-Run: ${cfg.autoRun.enabled ? '✅' : '❌'}`,
            `• Auto-Retry: ${cfg.autoRetry.enabled ? '✅' : '❌'}`,
            `• Multi-Tab: ${cfg.multiTab.enabled ? '✅' : '❌'}`,
            '',
            'Click to toggle | Right-click for settings',
        ];

        this.statusBarItem.tooltip = new vscode.MarkdownString(lines.join('\n'));
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
