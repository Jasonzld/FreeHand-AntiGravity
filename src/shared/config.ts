/**
 * Configuration Service
 * Manages extension settings with VS Code configuration API
 */

import * as vscode from 'vscode';

export interface FreeHandConfig {
    autoAccept: {
        enabled: boolean;
    };
    autoRun: {
        enabled: boolean;
    };
    autoRetry: {
        enabled: boolean;
    };
    multiTab: {
        enabled: boolean;
    };
    quota: {
        refreshInterval: number;
        warningThreshold: number;
    };
    wake: {
        enabled: boolean;
        startTime: string;
        endTime: string;
        workDays: number[];
    };
    safety: {
        blocklist: string[];
    };
}

export class ConfigService {
    private context: vscode.ExtensionContext;
    private config: vscode.WorkspaceConfiguration;
    private _onConfigChange = new vscode.EventEmitter<FreeHandConfig>();
    public readonly onConfigChange = this._onConfigChange.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = vscode.workspace.getConfiguration('freehand');

        // Watch for config changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('freehand')) {
                this.config = vscode.workspace.getConfiguration('freehand');
                this._onConfigChange.fire(this.getAll());
            }
        });
    }

    async initialize(): Promise<void> {
        this.config = vscode.workspace.getConfiguration('freehand');
    }

    get<T>(key: string): T {
        return this.config.get<T>(key) as T;
    }

    async set<T>(key: string, value: T): Promise<void> {
        await this.config.update(key, value, vscode.ConfigurationTarget.Global);
    }

    toggle(key: string): boolean {
        const current = this.get<boolean>(key);
        const newValue = !current;
        this.set(key, newValue);
        return newValue;
    }

    getAll(): FreeHandConfig {
        return {
            autoAccept: {
                enabled: this.get<boolean>('autoAccept.enabled') ?? true,
            },
            autoRun: {
                enabled: this.get<boolean>('autoRun.enabled') ?? true,
            },
            autoRetry: {
                enabled: this.get<boolean>('autoRetry.enabled') ?? true,
            },
            multiTab: {
                enabled: this.get<boolean>('multiTab.enabled') ?? false,
            },
            quota: {
                refreshInterval: this.get<number>('quota.refreshInterval') ?? 120,
                warningThreshold: this.get<number>('quota.warningThreshold') ?? 30,
            },
            wake: {
                enabled: this.get<boolean>('wake.enabled') ?? false,
                startTime: this.get<string>('wake.startTime') ?? '09:00',
                endTime: this.get<string>('wake.endTime') ?? '18:00',
                workDays: this.get<number[]>('wake.workDays') ?? [1, 2, 3, 4, 5],
            },
            safety: {
                blocklist: this.get<string[]>('safety.blocklist') ?? [],
            },
        };
    }

    getRefreshIntervalMs(): number {
        return (this.get<number>('quota.refreshInterval') ?? 120) * 1000;
    }
}
