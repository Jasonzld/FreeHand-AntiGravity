/**
 * Logger Service
 * Centralized logging with output channel
 */

import * as vscode from 'vscode';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
    private outputChannel: vscode.OutputChannel;
    private name: string;

    constructor(name: string) {
        this.name = name;
        this.outputChannel = vscode.window.createOutputChannel(name);
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    debug(message: string, data?: unknown): void {
        const formatted = this.formatMessage('debug', message);
        this.outputChannel.appendLine(formatted);
        if (data) {
            this.outputChannel.appendLine(JSON.stringify(data, null, 2));
        }
    }

    info(message: string, data?: unknown): void {
        const formatted = this.formatMessage('info', message);
        this.outputChannel.appendLine(formatted);
        if (data) {
            this.outputChannel.appendLine(JSON.stringify(data, null, 2));
        }
        console.log(`[${this.name}] ${message}`);
    }

    warn(message: string, data?: unknown): void {
        const formatted = this.formatMessage('warn', message);
        this.outputChannel.appendLine(formatted);
        if (data) {
            this.outputChannel.appendLine(JSON.stringify(data, null, 2));
        }
        console.warn(`[${this.name}] ${message}`);
    }

    error(message: string, error?: Error | unknown): void {
        const formatted = this.formatMessage('error', message);
        this.outputChannel.appendLine(formatted);
        if (error instanceof Error) {
            this.outputChannel.appendLine(`  Stack: ${error.stack}`);
        } else if (error) {
            this.outputChannel.appendLine(`  Details: ${JSON.stringify(error)}`);
        }
        console.error(`[${this.name}] ${message}`, error);
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
