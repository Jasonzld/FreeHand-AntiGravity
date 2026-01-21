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

        // Cycle state: OFF → ON (Single) → ON (Multi) → OFF
        vscode.commands.registerCommand('freehand.cycleState', async () => {
            const cfg = configService.getAll();
            const isEnabled = cfg.autoAccept.enabled || cfg.autoRun.enabled;
            const isMultiTab = cfg.multiTab.enabled;

            if (!isEnabled) {
                // OFF → ON (Single Tab)
                await configService.set('autoAccept.enabled', true);
                await configService.set('autoRun.enabled', true);
                await configService.set('multiTab.enabled', false);
                logger.info('Cycled to: ON (Single Tab)');
                vscode.window.showInformationMessage('⚡ FreeHand: ON (Single Tab)');
                await autoClicker.start();
            } else if (!isMultiTab) {
                // ON (Single) → ON (Multi-Tab)
                await configService.set('multiTab.enabled', true);
                logger.info('Cycled to: ON (Multi-Tab)');
                vscode.window.showInformationMessage('⚡ FreeHand: ON (Multi-Tab)');
            } else {
                // ON (Multi-Tab) → OFF
                await configService.set('autoAccept.enabled', false);
                await configService.set('autoRun.enabled', false);
                await configService.set('multiTab.enabled', false);
                logger.info('Cycled to: OFF');
                vscode.window.showInformationMessage('⚡ FreeHand: OFF');
                autoClicker.stop();
            }

            statusBar.update();
        }),

        vscode.commands.registerCommand('freehand.openSettings', () => {
            settingsPanel = SettingsPanel.createOrShow(context, configService, quotaService);
        }),

        vscode.commands.registerCommand('freehand.refreshQuota', async () => {
            statusBar.setLoading();
            const quota = await quotaService.refresh();
            statusBar.updateQuota(quota.percentage);
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
