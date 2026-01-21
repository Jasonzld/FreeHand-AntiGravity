/**
 * Process Hunter
 * Detects Antigravity process and extracts connection info
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as process from 'process';
import { Logger } from '../shared/logger';
import { ProcessInfo, EnvironmentScanResult } from './types';

const execAsync = promisify(exec);

const PROCESS_NAMES = {
    windows: 'language_server_windows_x64.exe',
    darwin_arm: 'language_server_macos_arm',
    darwin_x64: 'language_server_macos',
    linux: 'language_server_linux',
};

const API_ENDPOINT = '/exa.language_server_pb.LanguageServerService/GetUnleashData';

export class ProcessHunter {
    private logger: Logger;
    private targetProcess: string;
    private platform: NodeJS.Platform;

    constructor(logger: Logger) {
        this.logger = logger;
        this.platform = process.platform;

        if (this.platform === 'win32') {
            this.targetProcess = PROCESS_NAMES.windows;
        } else if (this.platform === 'darwin') {
            this.targetProcess = process.arch === 'arm64'
                ? PROCESS_NAMES.darwin_arm
                : PROCESS_NAMES.darwin_x64;
        } else {
            this.targetProcess = PROCESS_NAMES.linux;
        }

        this.logger.debug(`ProcessHunter: platform=${this.platform}, target=${this.targetProcess}`);
    }

    async scanEnvironment(maxAttempts: number = 3): Promise<EnvironmentScanResult | null> {
        this.logger.info(`Scanning for Antigravity process (max ${maxAttempts} attempts)`);

        for (let i = 0; i < maxAttempts; i++) {
            this.logger.debug(`Scan attempt ${i + 1}/${maxAttempts}`);

            try {
                const candidates = await this.findProcesses();

                if (candidates.length > 0) {
                    this.logger.info(`Found ${candidates.length} candidate process(es)`);

                    for (const info of candidates) {
                        const ports = await this.identifyPorts(info.pid);

                        if (ports.length > 0) {
                            const validPort = await this.verifyConnection(ports, info.csrfToken);

                            if (validPort) {
                                this.logger.info(`Verified connection on port ${validPort}`);
                                return {
                                    extensionPort: info.extensionPort,
                                    connectPort: validPort,
                                    csrfToken: info.csrfToken,
                                };
                            }
                        }
                    }
                }
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                this.logger.warn(`Scan attempt ${i + 1} failed: ${error.message}`);
            }

            if (i < maxAttempts - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        this.logger.warn('No valid Antigravity process found');
        return null;
    }

    private async findProcesses(): Promise<ProcessInfo[]> {
        const cmd = this.getProcessListCommand();

        try {
            const { stdout } = await execAsync(cmd, { timeout: 15000 });
            return this.parseProcessInfo(stdout);
        } catch (e) {
            return [];
        }
    }

    private getProcessListCommand(): string {
        if (this.platform === 'win32') {
            const utf8Header = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
            return `chcp 65001 >nul && powershell -NoProfile -Command "${utf8Header}Get-CimInstance Win32_Process -Filter 'name=''${this.targetProcess}''' | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
        } else {
            return `ps -ww -eo pid,ppid,args | grep "${this.targetProcess}" | grep -v grep`;
        }
    }

    private parseProcessInfo(stdout: string): ProcessInfo[] {
        const candidates: ProcessInfo[] = [];

        if (this.platform === 'win32') {
            try {
                const jsonStart = stdout.indexOf('{');
                if (jsonStart < 0) return [];

                let data = JSON.parse(stdout.substring(jsonStart).trim());
                if (!Array.isArray(data)) data = [data];

                for (const item of data) {
                    const cmdLine = item.CommandLine || '';
                    if (!this.isAntigravityProcess(cmdLine)) continue;

                    const pid = item.ProcessId;
                    const portMatch = cmdLine.match(/--extension_server_port[=\s]+(\d+)/);
                    const tokenMatch = cmdLine.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);

                    if (pid && tokenMatch?.[1]) {
                        candidates.push({
                            pid,
                            extensionPort: portMatch?.[1] ? parseInt(portMatch[1], 10) : 0,
                            csrfToken: tokenMatch[1],
                        });
                    }
                }
            } catch {
                // Parse failed
            }
        } else {
            const lines = stdout.split('\n').filter(l => l.trim());

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 3) continue;

                const pid = parseInt(parts[0], 10);
                const cmd = parts.slice(2).join(' ');

                if (isNaN(pid) || !this.isAntigravityProcess(cmd)) continue;

                const portMatch = cmd.match(/--extension_server_port[=\s]+(\d+)/);
                const tokenMatch = cmd.match(/--csrf_token[=\s]+([a-zA-Z0-9-]+)/i);

                if (tokenMatch?.[1]) {
                    candidates.push({
                        pid,
                        extensionPort: portMatch?.[1] ? parseInt(portMatch[1], 10) : 0,
                        csrfToken: tokenMatch[1],
                    });
                }
            }
        }

        return candidates;
    }

    private isAntigravityProcess(cmdLine: string): boolean {
        return cmdLine.includes('--extension_server_port') &&
            cmdLine.includes('--csrf_token') &&
            /--app_data_dir\s+antigravity\b/i.test(cmdLine);
    }

    private async identifyPorts(pid: number): Promise<number[]> {
        try {
            const cmd = this.getPortListCommand(pid);
            const { stdout } = await execAsync(cmd, { timeout: 10000 });
            return this.parseListeningPorts(stdout);
        } catch {
            return [];
        }
    }

    private getPortListCommand(pid: number): string {
        if (this.platform === 'win32') {
            const utf8Header = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
            return `chcp 65001 >nul && powershell -NoProfile -Command "${utf8Header}Get-NetTCPConnection -State Listen -OwningProcess ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort | Sort-Object -Unique"`;
        } else if (this.platform === 'darwin') {
            return `lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid} 2>/dev/null | grep LISTEN`;
        } else {
            return `ss -tlnp 2>/dev/null | grep "pid=${pid},"`;
        }
    }

    private parseListeningPorts(stdout: string): number[] {
        const ports = new Set<number>();
        const matches = stdout.match(/\b\d{1,5}\b/g) || [];

        for (const value of matches) {
            const port = parseInt(value, 10);
            if (port > 1024 && port <= 65535) {
                ports.add(port);
            }
        }

        return Array.from(ports).sort((a, b) => a - b);
    }

    private async verifyConnection(ports: number[], token: string): Promise<number | null> {
        for (const port of ports) {
            if (await this.pingPort(port, token)) {
                return port;
            }
        }
        return null;
    }

    private pingPort(port: number, token: string): Promise<boolean> {
        return new Promise(resolve => {
            const options: https.RequestOptions = {
                hostname: '127.0.0.1',
                port,
                path: API_ENDPOINT,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Codeium-Csrf-Token': token,
                    'Connect-Protocol-Version': '1',
                },
                rejectUnauthorized: false,
                timeout: 5000,
            };

            const req = https.request(options, res => resolve(res.statusCode === 200));
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.write(JSON.stringify({ wrapper_data: {} }));
            req.end();
        });
    }
}
