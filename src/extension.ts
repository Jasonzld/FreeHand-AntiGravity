/**
 * FreeHand AntiGravity - Extension Entry Point
 * Autonomous AI agent control with quota management
 */

import * as vscode from 'vscode';
import { ConfigService } from './shared/config';
import { Logger } from './shared/logger';
import { StatusBarController } from './view/status-bar';
import { SettingsPanel } from './view/settings-panel';
import { AutoClicker } from './core/auto-clicker';
import { QuotaService } from './quota/quota-service';
import { WakeScheduler } from './scheduler/wake-scheduler';

// Global instances
let logger: Logger;
let configService: ConfigService;
let statusBar: StatusBarController;
let autoClicker: AutoClicker;
let quotaService: QuotaService;
let wakeScheduler: WakeScheduler;
let settingsPanel: SettingsPanel | undefined;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize logger
    logger = new Logger('FreeHand');
    logger.info('FreeHand AntiGravity v1.0.0 - Initializing...');

    // Initialize config service
    configService = new ConfigService(context);
    await configService.initialize();

    // Initialize core modules
    statusBar = new StatusBarController(context, configService);
    autoClicker = new AutoClicker(configService, logger);
    quotaService = new QuotaService(configService, logger);
    wakeScheduler = new WakeScheduler(configService, logger);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('freehand.toggle', () => {
            const enabled = configService.toggle('autoAccept.enabled');
            statusBar.update();
            logger.info(`Automation ${enabled ? 'enabled' : 'disabled'}`);
            vscode.window.showInformationMessage(
                `FreeHand: Automation ${enabled ? 'ON' : 'OFF'}`
            );
        }),

        vscode.commands.registerCommand('freehand.openSettings', () => {
            settingsPanel = SettingsPanel.createOrShow(context, configService, quotaService);
        }),

        vscode.commands.registerCommand('freehand.refreshQuota', async () => {
            statusBar.setLoading();
            await quotaService.refresh();
            statusBar.update();
            logger.info('Quota refreshed');
        })
    );

    // Start services
    if (configService.get('autoAccept.enabled') || configService.get('autoRun.enabled')) {
        await autoClicker.start();
    }

    if (configService.get('wake.enabled')) {
        wakeScheduler.start();
    }

    // Start quota monitoring
    quotaService.startMonitoring();

    // Update status bar
    statusBar.update();

    logger.info('FreeHand AntiGravity - Ready');
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    logger?.info('FreeHand AntiGravity - Shutting down...');
    autoClicker?.stop();
    quotaService?.stopMonitoring();
    wakeScheduler?.stop();
    settingsPanel?.dispose();
    logger?.dispose();
}
