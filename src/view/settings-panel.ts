/**
 * Settings Panel
 * Webview-based settings UI
 */

import * as vscode from 'vscode';
import { ConfigService } from '../shared/config';
import { QuotaService } from '../quota/quota-service';

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private config: ConfigService;
    private quotaService: QuotaService;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(
        context: vscode.ExtensionContext,
        config: ConfigService,
        quotaService: QuotaService
    ): SettingsPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.panel.reveal(column);
            return SettingsPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'freehandSettings',
            'FreeHand Settings',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, context.extensionUri, config, quotaService);
        return SettingsPanel.currentPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        config: ConfigService,
        quotaService: QuotaService
    ) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.config = config;
        this.quotaService = quotaService;

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'updateConfig':
                        await this.config.set(message.key, message.value);
                        break;
                    case 'refreshQuota':
                        await this.quotaService.refresh();
                        this.sendQuotaUpdate();
                        break;
                    case 'getConfig':
                        this.sendConfigUpdate();
                        break;
                }
            },
            null,
            this.disposables
        );

        // Listen for config changes
        this.config.onConfigChange(() => this.sendConfigUpdate());
        this.quotaService.onQuotaUpdate(() => this.sendQuotaUpdate());
    }

    private sendConfigUpdate(): void {
        this.panel.webview.postMessage({
            command: 'configUpdate',
            config: this.config.getAll(),
        });
    }

    private sendQuotaUpdate(): void {
        this.panel.webview.postMessage({
            command: 'quotaUpdate',
            quota: this.quotaService.getCurrentQuota(),
        });
    }

    private update(): void {
        this.panel.webview.html = this.getHtmlContent();
        setTimeout(() => {
            this.sendConfigUpdate();
            this.sendQuotaUpdate();
        }, 100);
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FreeHand Settings</title>
    <style>
        :root {
            --bg: #1e1e1e;
            --bg-card: #252526;
            --border: #3c3c3c;
            --accent: #0e639c;
            --accent-hover: #1177bb;
            --success: #4ec9b0;
            --warning: #dcdcaa;
            --error: #f14c4c;
            --fg: #d4d4d4;
            --fg-dim: #808080;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--fg);
            padding: 20px;
            line-height: 1.5;
        }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 20px; color: var(--success); }
        .section {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .section-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--fg);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .toggle-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
        }
        .toggle-row:last-child { border-bottom: none; }
        .toggle-label { font-size: 13px; }
        .toggle {
            position: relative;
            width: 44px;
            height: 24px;
        }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
            background: var(--border);
            border-radius: 24px;
            transition: 0.3s;
        }
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background: var(--fg);
            border-radius: 50%;
            transition: 0.3s;
        }
        .toggle input:checked + .toggle-slider { background: var(--success); }
        .toggle input:checked + .toggle-slider:before { transform: translateX(20px); }
        
        .quota-display {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }
        .quota-bar {
            flex: 1;
            height: 8px;
            background: var(--border);
            border-radius: 4px;
            overflow: hidden;
        }
        .quota-fill {
            height: 100%;
            background: var(--success);
            transition: width 0.3s;
        }
        .quota-fill.warning { background: var(--warning); }
        .quota-fill.critical { background: var(--error); }
        .quota-percent { font-size: 14px; font-weight: 600; min-width: 50px; }
        
        .time-row {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-top: 8px;
        }
        .time-input {
            background: var(--bg);
            border: 1px solid var(--border);
            color: var(--fg);
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 13px;
        }
        .time-label { font-size: 12px; color: var(--fg-dim); }
        
        textarea {
            width: 100%;
            min-height: 100px;
            background: var(--bg);
            border: 1px solid var(--border);
            color: var(--fg);
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            resize: vertical;
        }
        
        .btn {
            background: var(--accent);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .btn:hover { background: var(--accent-hover); }
        .btn-row { display: flex; gap: 8px; margin-top: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚡ FreeHand AntiGravity</h1>
        
        <div class="section">
            <div class="section-title">🔄 自动化</div>
            <div class="toggle-row">
                <span class="toggle-label">自动接受文件修改</span>
                <label class="toggle">
                    <input type="checkbox" id="autoAccept">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="toggle-row">
                <span class="toggle-label">自动执行终端命令</span>
                <label class="toggle">
                    <input type="checkbox" id="autoRun">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="toggle-row">
                <span class="toggle-label">自动重试失败操作</span>
                <label class="toggle">
                    <input type="checkbox" id="autoRetry">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="toggle-row">
                <span class="toggle-label">多标签页模式</span>
                <label class="toggle">
                    <input type="checkbox" id="multiTab">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">📊 配额管理</div>
            <div id="quotaInfo" style="font-size: 13px; color: var(--fg-dim); margin-bottom: 8px;">
                加载中...
            </div>
            <div class="quota-display">
                <div class="quota-bar">
                    <div class="quota-fill" id="quotaFill" style="width: 0%"></div>
                </div>
                <span class="quota-percent" id="quotaPercent">--%</span>
            </div>
            <button class="btn" id="refreshQuota">🔄 刷新配额</button>
        </div>
        
        <div class="section">
            <div class="section-title">⏰ 唤醒时间</div>
            <div class="toggle-row">
                <span class="toggle-label">启用定时唤醒</span>
                <label class="toggle">
                    <input type="checkbox" id="wakeEnabled">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="time-row">
                <span class="time-label">开始:</span>
                <input type="time" class="time-input" id="wakeStart" value="09:00">
                <span class="time-label">结束:</span>
                <input type="time" class="time-input" id="wakeEnd" value="18:00">
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">🛡️ 安全规则</div>
            <div style="font-size: 12px; color: var(--fg-dim); margin-bottom: 8px;">
                以下命令模式将被阻止执行 (每行一个):
            </div>
            <textarea id="blocklist" placeholder="rm -rf /&#10;format c:"></textarea>
            <div class="btn-row">
                <button class="btn" id="saveBlocklist">💾 保存</button>
                <button class="btn" id="resetBlocklist" style="background: var(--border);">↺ 重置</button>
            </div>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Toggle handlers
        document.querySelectorAll('.toggle input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const key = getConfigKey(e.target.id);
                vscode.postMessage({ command: 'updateConfig', key, value: e.target.checked });
            });
        });
        
        function getConfigKey(id) {
            const map = {
                'autoAccept': 'autoAccept.enabled',
                'autoRun': 'autoRun.enabled',
                'autoRetry': 'autoRetry.enabled',
                'multiTab': 'multiTab.enabled',
                'wakeEnabled': 'wake.enabled',
            };
            return map[id] || id;
        }
        
        // Quota refresh
        document.getElementById('refreshQuota').addEventListener('click', () => {
            vscode.postMessage({ command: 'refreshQuota' });
        });
        
        // Time inputs
        document.getElementById('wakeStart').addEventListener('change', (e) => {
            vscode.postMessage({ command: 'updateConfig', key: 'wake.startTime', value: e.target.value });
        });
        document.getElementById('wakeEnd').addEventListener('change', (e) => {
            vscode.postMessage({ command: 'updateConfig', key: 'wake.endTime', value: e.target.value });
        });
        
        // Blocklist
        document.getElementById('saveBlocklist').addEventListener('click', () => {
            const list = document.getElementById('blocklist').value.split('\n').filter(l => l.trim());
            vscode.postMessage({ command: 'updateConfig', key: 'safety.blocklist', value: list });
        });
        
        document.getElementById('resetBlocklist').addEventListener('click', () => {
            const defaults = ['rm -rf /', 'rm -rf ~', 'format c:', 'del /f /s /q', ':(){:|:&};:'];
            document.getElementById('blocklist').value = defaults.join('\n');
            vscode.postMessage({ command: 'updateConfig', key: 'safety.blocklist', value: defaults });
        });
        
        // Message handler
        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'configUpdate') {
                const c = msg.config;
                document.getElementById('autoAccept').checked = c.autoAccept.enabled;
                document.getElementById('autoRun').checked = c.autoRun.enabled;
                document.getElementById('autoRetry').checked = c.autoRetry.enabled;
                document.getElementById('multiTab').checked = c.multiTab.enabled;
                document.getElementById('wakeEnabled').checked = c.wake.enabled;
                document.getElementById('wakeStart').value = c.wake.startTime;
                document.getElementById('wakeEnd').value = c.wake.endTime;
                document.getElementById('blocklist').value = (c.safety.blocklist || []).join('\\n');
            }
            if (msg.command === 'quotaUpdate') {
                const q = msg.quota;
                document.getElementById('quotaInfo').textContent = q.email ? \`\${q.email} (\${q.plan})\` : '未连接';
                document.getElementById('quotaPercent').textContent = \`\${q.percentage}%\`;
                const fill = document.getElementById('quotaFill');
                fill.style.width = \`\${q.percentage}%\`;
                fill.className = 'quota-fill ' + (q.status === 'critical' ? 'critical' : q.status === 'warning' ? 'warning' : '');
            }
        });
        
        // Request initial data
        vscode.postMessage({ command: 'getConfig' });
    </script>
</body>
</html>`;
    }

    public dispose(): void {
        SettingsPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) d.dispose();
        }
    }
}
