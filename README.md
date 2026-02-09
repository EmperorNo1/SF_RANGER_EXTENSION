# 📦 Salesforce Ranger Toolkit

A lightweight VS Code extension for **Salesforce org management** in the sidebar.

## ✨ Features

### Org Manager

- ☁️ **Visual org tiles** – Tile-based UI for each authenticated org
- 🚀 **Caching** – Configurable cache (default 5 min) for fast loading
- 🎯 **Actions** – Open in browser, reauthenticate, logout, set default org, get access token
- ➕ **Authenticate new org** – Add orgs from the sidebar
- 🏷️ **Badges** – Default org, Dev Hub, Scratch org, connection status
- 🔄 **Refresh** – Force-refresh org list

### General

- 🎨 **Native UI** – HTML/CSS/JS in the extension
- 🔐 **Auth via CLI** – Uses Salesforce CLI (`sf` / `sfdx`) for authentication

---

## 🎯 Quick Start

### 1. Prerequisites

- **VS Code** 1.60.0 or later
- **Salesforce CLI** (`sf` or `sfdx`)
- At least one authenticated org

### 2. Authenticate

```bash
sf org login web
sf config set target-org your-username@example.com
sf org display
```

### 3. Install the extension

```bash
code --install-extension sf-ranger-toolkit-1.0.0.vsix
```

Then reload VS Code: **Cmd+Shift+P** → **Developer: Reload Window**.

### 4. Use Org Manager

1. Click the **SF Ranger Tools** icon in the Activity Bar.
2. Open the **Org Manager** panel.
3. Use the tiles to open orgs, reauth, set default, copy token, or logout.  
   Use **🔄 Refresh** to reload the list (by default it is cached for 5 minutes).

---

## 🔧 Configuration

| Setting | Default | Description |
|--------|---------|-------------|
| `sfRangerToolkit.maxBufferSizeMB` | 50 | Max buffer size (MB) for CLI output. Increase for very large orgs. |
| `sfRangerToolkit.orgCacheDurationSeconds` | 300 | How long (seconds) to cache the org list. |

---

## 🔧 Troubleshooting

- **Icon not visible** – Reload VS Code (**Cmd+Shift+P** → **Developer: Reload Window**).
- **No orgs / "No SFDX default org found"** – Run `sf org login web` and `sf config set target-org <alias>`.
- **Generate / actions disabled** – Confirm auth with `sf org display`; re-auth with `sf org login web` if needed.

---

## 📁 Project structure

```
SF_RANGER_EXTENSION/
├── .vscode/extensions/sf-ranger-toolkit/   # VS Code extension
│   ├── src/
│   │   ├── extension.js
│   │   ├── handlers/orgMessageHandler.js
│   │   ├── providers/orgManagerProvider.js
│   │   ├── utils/                          # config, orgCache, sfdxCommandExecutor, etc.
│   │   └── webview/org-manager-content.js
│   ├── package.json
│   └── icons/
├── build-extension.sh
├── sf-ranger-toolkit-1.0.0.vsix            # Built extension (after build)
└── README.md
```

---

## 🔧 Development

### Build

```bash
./build-extension.sh
```

### Test

```bash
cd .vscode/extensions/sf-ranger-toolkit && npm test
```

### Main modules

- **orgMessageHandler.js** – Routes webview messages (list orgs, open, reauth, logout, token, etc.).
- **orgCache.js** – In-memory cache for the org list.
- **sfdxCommandExecutor.js** – Runs `sf` / `sfdx` commands (list orgs, open, reauth, logout, set default, token, authenticate).
- **config.js** – Reads `maxBufferSizeMB` and `orgCacheDurationSeconds`.

---

## 📄 License

MIT License.
