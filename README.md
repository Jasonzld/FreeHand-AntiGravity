# FreeHand AntiGravity

<p align="center">
  <img src="assets/icon.png" alt="FreeHand AntiGravity Logo" width="128" />
</p>

<h1 align="center">FreeHand AntiGravity</h1>

<p align="center">
  <strong>⚡ Autonomous AI Agent Control with Quota Management</strong>
</p>

<p align="center">
  <a href="https://github.com/Jasonzld/FreeHand-AntiGravity/blob/master/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
  </a>
</p>

---

## ✨ Features

| Feature | Description |
| :--- | :--- |
| 🔄 **Auto-Accept File Edits** | Instantly applies AI-suggested code changes |
| 💻 **Auto-Execute Commands** | Runs terminal commands automatically |
| 🔁 **Auto-Retry on Errors** | Detects and retries when AI agents get stuck |
| ⚡ **Multi-Tab Mode** | Monitors all agent tabs simultaneously |
| 📊 **Quota Management** | View and monitor your AI quota |
| ⏰ **Wake Scheduler** | Schedule automation based on working hours |
| 🛡️ **Safety Blocklist** | Prevents dangerous commands from running |
| 🔒 **Input Protection** | Skips auto-clicking when you're typing |

---

## 📥 Installation

### From VSIX File
```bash
antigravity --install-extension freehand-antigravity-1.0.0.vsix
```

---

## 🎮 Usage

### Status Bar
- **Click**: Toggle automation ON/OFF
- **Hover**: See current settings

### Commands (Ctrl+Shift+P)
| Command | Description |
| :--- | :--- |
| `FreeHand: Toggle Automation` | Enable/disable automation |
| `FreeHand: Open Settings` | Open the settings panel |
| `FreeHand: Refresh Quota` | Refresh quota data |

### Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| `Ctrl+Shift+F` | Toggle automation |
| `Ctrl+Shift+,` | Open settings |

---

## ⚙️ Configuration

All settings can be configured via the Settings Panel or VS Code settings:

### Automation
- `freehand.autoAccept.enabled` - Auto-accept file edits
- `freehand.autoRun.enabled` - Auto-execute terminal commands
- `freehand.autoRetry.enabled` - Auto-retry on errors
- `freehand.multiTab.enabled` - Multi-tab mode

### Quota
- `freehand.quota.refreshInterval` - Refresh interval (seconds)
- `freehand.quota.warningThreshold` - Warning threshold (%)

### Wake Scheduler
- `freehand.wake.enabled` - Enable scheduler
- `freehand.wake.startTime` - Start time (HH:MM)
- `freehand.wake.endTime` - End time (HH:MM)
- `freehand.wake.workDays` - Working days [0-6]

### Safety
- `freehand.safety.blocklist` - Blocked command patterns

---

## 🛡️ Safety

Built-in blocked patterns:
```
rm -rf /
rm -rf ~
format c:
del /f /s /q
:(){:|:&};:
```

Customize via the Settings Panel or `freehand.safety.blocklist` setting.

---

## 📜 License

MIT License — Open and free forever.

---

## 🙏 Acknowledgements

This project is a complete TypeScript rewrite inspired by:
- [auto-all-Antigravity](https://github.com/ai-dev-2024/AUTO-ALL-AntiGravity) by ai-dev-2024
- [vscode-antigravity-cockpit](https://github.com/jlcodes99/vscode-antigravity-cockpit) by jlcodes99

<p align="center">
  Made with ❤️ by <a href="https://github.com/Jasonzld">Jasonzld</a>
</p>