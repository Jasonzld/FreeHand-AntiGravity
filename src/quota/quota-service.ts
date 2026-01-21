/**
 * Quota Service
 * Monitors and displays quota information
 */

import * as vscode from 'vscode';
import { ConfigService } from '../shared/config';
import { Logger } from '../shared/logger';

export interface QuotaInfo {
    email?: string;
    plan?: string;
    percentage: number;
    remaining?: number;
    total?: number;
    resetTime?: string;
    status: 'ok' | 'warning' | 'critical' | 'unknown';
}

export class QuotaService {
    private config: ConfigService;
    private logger: Logger;
    private monitorInterval: NodeJS.Timeout | null = null;
    private currentQuota: QuotaInfo = { percentage: 100, status: 'unknown' };

    private _onQuotaUpdate = new vscode.EventEmitter<QuotaInfo>();
    public readonly onQuotaUpdate = this._onQuotaUpdate.event;

    constructor(config: ConfigService, logger: Logger) {
        this.config = config;
        this.logger = logger;
    }

    async refresh(): Promise<QuotaInfo> {
        try {
            // TODO: Implement actual quota fetching from Antigravity
            // For now, return a mock value
            this.currentQuota = {
                email: 'user@example.com',
                plan: 'Pro',
                percentage: 85,
                remaining: 850,
                total: 1000,
                status: 'ok',
            };

            this._onQuotaUpdate.fire(this.currentQuota);
            this.logger.debug('Quota refreshed', this.currentQuota);
            return this.currentQuota;
        } catch (error) {
            this.logger.error('Failed to refresh quota', error);
            this.currentQuota = { percentage: 0, status: 'unknown' };
            this._onQuotaUpdate.fire(this.currentQuota);
            return this.currentQuota;
        }
    }

    getCurrentQuota(): QuotaInfo {
        return this.currentQuota;
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

        // Listen for config changes to update interval
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

    /**
     * Calculate status based on percentage and thresholds
     */
    private calculateStatus(percentage: number): 'ok' | 'warning' | 'critical' {
        const warningThreshold = this.config.get<number>('quota.warningThreshold') ?? 30;
        const criticalThreshold = 10; // Fixed critical threshold

        if (percentage <= criticalThreshold) {
            return 'critical';
        } else if (percentage <= warningThreshold) {
            return 'warning';
        }
        return 'ok';
    }
}
