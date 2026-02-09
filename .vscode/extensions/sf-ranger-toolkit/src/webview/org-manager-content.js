/**
 * Org Manager Webview Content
 *
 * Provides the UI for SF Org Manager with tile-based org display
 * and action buttons (open, reauthenticate, logout)
 */

(function () {
  const vscode = acquireVsCodeApi();
  let allOrgs = [];

  // Initialize the UI
  function init() {
    renderUI();
    setupEventListeners();
    requestOrgsList();
  }

  // Render the main UI structure
  function renderUI() {
    const root = document.getElementById("orgManagerRoot");

    root.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          background-color: var(--vscode-sideBar-background);
          padding: 12px;
        }

        .header {
          padding: 8px 0 16px 0;
          border-bottom: 1px solid var(--vscode-panel-border);
          margin-bottom: 16px;
        }

        .header h2 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .btn {
          padding: 6px 14px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn-primary {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }

        .btn-primary:hover {
          background-color: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
          background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .org-count {
          font-size: 13px;
          color: var(--vscode-descriptionForeground);
          margin-bottom: 12px;
        }

        .orgs-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .org-tile {
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 6px;
          padding: 14px;
          transition: all 0.2s;
          position: relative;
        }

        .org-tile:hover {
          border-color: var(--vscode-focusBorder);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .org-tile.default {
          border-left: 3px solid var(--vscode-charts-blue);
        }

        .org-tile.dev-hub {
          border-left: 3px solid var(--vscode-charts-purple);
        }

        .org-tile.scratch {
          border-left: 3px solid var(--vscode-charts-orange);
        }

        .org-tile.production {
          border: 2px solid var(--vscode-editorError-foreground);
          border-left: 4px solid var(--vscode-editorError-foreground);
        }

        .org-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .org-info {
          flex: 1;
          min-width: 0;
        }

        .org-alias {
          font-size: 14px;
          font-weight: 600;
          color: var(--vscode-editor-foreground);
          margin-bottom: 4px;
          word-break: break-word;
        }

        .org-username {
          font-size: 12px;
          color: var(--vscode-descriptionForeground);
          word-break: break-all;
          margin-bottom: 6px;
        }

        .org-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .badge-default {
          background-color: var(--vscode-charts-blue);
          color: white;
        }

        .badge-devhub {
          background-color: var(--vscode-charts-purple);
          color: white;
        }

        .badge-scratch {
          background-color: var(--vscode-charts-orange);
          color: white;
        }

        .badge-connected {
          background-color: var(--vscode-charts-green);
          color: white;
        }

        .badge-disconnected {
          background-color: var(--vscode-charts-red);
          color: white;
        }

        .org-details {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 6px 10px;
          font-size: 12px;
          margin-bottom: 12px;
        }

        .detail-label {
          color: var(--vscode-descriptionForeground);
          font-weight: 500;
        }

        .detail-value {
          color: var(--vscode-editor-foreground);
          word-break: break-all;
        }

        .detail-value-with-copy {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--vscode-editor-foreground);
          word-break: break-all;
        }

        .copy-icon {
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.2s;
          font-size: 14px;
          flex-shrink: 0;
          user-select: none;
        }

        .copy-icon:hover {
          opacity: 1;
        }

        .copy-icon.copied {
          opacity: 1;
        }

        .org-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .action-btn {
          flex: 1;
          min-width: 80px;
          padding: 6px 10px;
          border: 1px solid var(--vscode-button-border);
          border-radius: 4px;
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .action-btn:hover:not(:disabled) {
          background-color: var(--vscode-button-secondaryHoverBackground);
          border-color: var(--vscode-focusBorder);
        }

        .action-btn.danger:hover:not(:disabled) {
          background-color: var(--vscode-inputValidation-errorBackground);
          border-color: var(--vscode-inputValidation-errorBorder);
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }

        .loading {
          text-align: center;
          padding: 40px 20px;
          color: var(--vscode-descriptionForeground);
        }

        .loading-spinner {
          display: inline-block;
          width: 24px;
          height: 24px;
          border: 3px solid var(--vscode-progressBar-background);
          border-top-color: var(--vscode-button-background);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 12px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--vscode-editor-foreground);
        }

        .empty-state-text {
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 16px;
        }

        .icon {
          display: inline-block;
        }
      </style>

      <div class="header">
        <h2>
          <span class="icon" style="vertical-align: middle;">
            <img src="${ICON_URI}" alt="Org Manager" style="height: 20px; width: 20px; vertical-align: middle;" />
          </span>
          Salesforce Orgs
        </h2>
        <div class="header-actions">
          <button class="btn btn-primary" id="authenticateNewOrgBtn">
            <span class="icon">➕</span>
            Add New Org
          </button>
          <button class="btn btn-secondary" id="refreshBtn">
            <span class="icon">🔄</span>
            Refresh
          </button>
        </div>
      </div>

      <div id="orgCountDisplay" class="org-count"></div>
      <div id="orgsContainer" class="orgs-container">
        <div class="loading">
          <div class="loading-spinner"></div>
          <div>Loading orgs...</div>
        </div>
      </div>
    `;
  }

  // Setup event listeners
  function setupEventListeners() {
    // Refresh button - force refresh bypassing cache
    document.getElementById("refreshBtn").addEventListener("click", () => {
      vscode.postMessage({ command: "refreshOrgs" });
      showLoading();
    });

    // Authenticate new org button
    document
      .getElementById("authenticateNewOrgBtn")
      .addEventListener("click", () => {
        handleAuthenticateNewOrg();
      });

    // Listen for messages from extension
    window.addEventListener("message", (event) => {
      const message = event.data;
      handleMessage(message);
    });
  }

  // Handle messages from extension
  function handleMessage(message) {
    switch (message.command) {
      case "initialize":
        requestOrgsList();
        break;

      case "orgsListResponse":
        handleOrgsListResponse(message);
        break;

      case "operationComplete":
        handleOperationComplete(message);
        break;

      case "accessTokenResponse":
        handleAccessTokenResponse(message);
        break;

      case "error":
        showError(message.message);
        break;
    }
  }

  // Request orgs list from extension
  function requestOrgsList() {
    vscode.postMessage({ command: "listOrgs" });
    showLoading();
  }

  // Handle orgs list response
  function handleOrgsListResponse(message) {
    if (message.success && message.data) {
      allOrgs = message.data;
      renderOrgs(allOrgs);
    } else {
      showEmptyState(message.message || "No orgs found");
    }
  }

  // Handle operation complete
  function handleOperationComplete(message) {
    // Optionally show a notification or refresh the list
    if (
      message.success &&
      (message.operation === "logout" ||
        message.operation === "setDefault" ||
        message.operation === "authenticateNewOrg")
    ) {
      requestOrgsList();
    }
  }

  // Handle access token response
  function handleAccessTokenResponse(message) {
    // Token is already copied to clipboard by the handler
    // Just show a brief success indicator if needed
    if (message.success) {
      console.log("Access token copied to clipboard");
    }
  }

  // Show loading state
  function showLoading() {
    const container = document.getElementById("orgsContainer");
    container.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <div>Loading orgs...</div>
      </div>
    `;
  }

  // Show empty state
  function showEmptyState(message) {
    const container = document.getElementById("orgsContainer");
    const countDisplay = document.getElementById("orgCountDisplay");

    countDisplay.textContent = "0 orgs authenticated";

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">☁️</div>
        <div class="empty-state-title">No Orgs Found</div>
        <div class="empty-state-text">
          ${message || "Authenticate to a Salesforce org to get started."}
          <br><br>
          Run <code>sf org login web</code> in your terminal.
        </div>
      </div>
    `;
  }

  // Show error
  function showError(message) {
    const container = document.getElementById("orgsContainer");
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Error</div>
        <div class="empty-state-text">${message}</div>
      </div>
    `;
  }

  // Render orgs
  function renderOrgs(orgs) {
    const container = document.getElementById("orgsContainer");
    const countDisplay = document.getElementById("orgCountDisplay");

    if (!orgs || orgs.length === 0) {
      showEmptyState();
      return;
    }

    countDisplay.textContent = `${orgs.length} org${orgs.length !== 1 ? "s" : ""} authenticated`;

    const orgsHtml = orgs.map((org) => createOrgTile(org)).join("");
    container.innerHTML = orgsHtml;

    // Attach event listeners to action buttons
    orgs.forEach((org) => {
      attachOrgActions(org);
    });

  }

  // Detect if an org is a production org based on instanceUrl
  function isProductionOrg(org) {
    if (!org.instanceUrl) return false;

    const url = org.instanceUrl.toLowerCase();

    // Non-production indicators
    const nonProductionIndicators = [
      "test.salesforce.com", // Sandbox
      "sandbox.my.salesforce.com", // Sandbox
      ".sandbox.", // Sandbox
      ".cs", // CS instances (cs1, cs2, etc.)
      ".test.", // Test instances
      "dev-ed", // Developer Edition orgs
    ];

    // Check if it's explicitly non-production
    const isNonProduction = nonProductionIndicators.some((indicator) =>
      url.includes(indicator)
    );

    // If it's not a scratch org and not non-production, it's likely production
    return !org.isScratchOrg && !isNonProduction;
  }

  // Create an org tile
  function createOrgTile(org) {
    // Check if production first
    const isProd = isProductionOrg(org);

    // Determine tile class - production takes precedence over others for visual warning
    let tileClass = "";
    if (isProd) {
      tileClass = "production";
    } else if (org.isDefaultUsername) {
      tileClass = "default";
    } else if (org.isDefaultDevHubUsername) {
      tileClass = "dev-hub";
    } else if (org.isScratchOrg) {
      tileClass = "scratch";
    }

    const badges = [];

    if (org.isDefaultUsername)
      badges.push('<span class="badge badge-default">⭐ Default</span>');
    if (org.isDefaultDevHubUsername)
      badges.push('<span class="badge badge-devhub">🔧 Dev Hub</span>');
    if (org.isScratchOrg)
      badges.push('<span class="badge badge-scratch">📦 Scratch</span>');

    const isConnected = org.connectedStatus === "Connected";
    badges.push(
      `<span class="badge badge-${isConnected ? "connected" : "disconnected"}">${isConnected ? "✓" : "✗"} ${org.connectedStatus}</span>`
    );

    const details = [];
    if (org.orgId)
      details.push({
        label: "Org ID:",
        value: org.orgId.substring(0, 15) + "...",
        copyable: false,
      });
    if (org.instanceUrl)
      details.push({
        label: "Instance:",
        value: org.instanceUrl,
        copyable: true,
        copyValue: org.instanceUrl,
      });
    if (org.expirationDate)
      details.push({
        label: "Expires:",
        value: new Date(org.expirationDate).toLocaleDateString(),
        copyable: false,
      });

    return `
      <div class="org-tile ${tileClass}" data-username="${org.username}">
        <div class="org-header">
          <div class="org-info">
            <div class="org-alias">${escapeHtml(org.alias)}</div>
            <div class="org-username">${escapeHtml(org.username)}</div>
          </div>
        </div>
        <div class="org-badges">
          ${badges.join("")}
        </div>

        ${
          details.length > 0
            ? `
          <div class="org-details">
            ${details
              .map(
                (d) => `
              <span class="detail-label">${d.label}</span>
              ${
                d.copyable
                  ? `<span class="detail-value-with-copy">
                      <span>${escapeHtml(d.value)}</span>
                      <span class="copy-icon" data-copy="${escapeHtml(d.copyValue)}" title="Copy to clipboard">📋</span>
                    </span>`
                  : `<span class="detail-value">${escapeHtml(d.value)}</span>`
              }
            `
              )
              .join("")}
          </div>
        `
            : ""
        }

        <div class="org-actions">
          <button class="action-btn" data-action="open" data-username="${org.username}">
            🌐 Open
          </button>
          ${
            !org.isDefaultUsername
              ? `
            <button class="action-btn" data-action="setDefault" data-username="${org.username}">
              ⭐ Set Default
            </button>
          `
              : ""
          }
          <button class="action-btn" data-action="reauth" data-username="${org.username}" data-instance-url="${org.instanceUrl || ""}">
            🔄 Reauth
          </button>
          <button class="action-btn" data-action="getToken" data-username="${org.username}">
            🔑 Token
          </button>
          <button class="action-btn danger" data-action="logout" data-username="${org.username}">
            🚪 Logout
          </button>
        </div>
      </div>
    `;
  }

  // Attach action button event listeners
  function attachOrgActions(org) {
    const tile = document.querySelector(
      `.org-tile[data-username="${org.username}"]`
    );
    if (!tile) return;

    const buttons = tile.querySelectorAll(".action-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const action = e.currentTarget.dataset.action;
        const username = e.currentTarget.dataset.username;
        const instanceUrl = e.currentTarget.dataset.instanceUrl;
        handleOrgAction(action, username, { instanceUrl });
      });
    });

    // Attach copy icon event listeners
    const copyIcons = tile.querySelectorAll(".copy-icon");
    copyIcons.forEach((icon) => {
      icon.addEventListener("click", (e) => {
        const textToCopy = e.currentTarget.dataset.copy;
        handleCopyToClipboard(textToCopy, e.currentTarget);
      });
    });
  }

  // Handle copy to clipboard
  function handleCopyToClipboard(text, iconElement) {
    // Try using the Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          showCopySuccess(iconElement);
        })
        .catch((err) => {
          console.error("Failed to copy text:", err);
          fallbackCopyToClipboard(text, iconElement);
        });
    } else {
      fallbackCopyToClipboard(text, iconElement);
    }
  }

  // Fallback copy method for older browsers
  function fallbackCopyToClipboard(text, iconElement) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        showCopySuccess(iconElement);
      }
    } catch (err) {
      console.error("Fallback copy failed:", err);
    }

    document.body.removeChild(textArea);
  }

  // Show visual feedback for successful copy
  function showCopySuccess(iconElement) {
    const originalText = iconElement.textContent;
    iconElement.textContent = "✓";
    iconElement.classList.add("copied");

    setTimeout(() => {
      iconElement.textContent = originalText;
      iconElement.classList.remove("copied");
    }, 1500);
  }

  // Handle authenticate new org
  function handleAuthenticateNewOrg() {
    // For now, use default login.salesforce.com (user can specify production or sandbox)
    // Future enhancement: show modal to ask for alias and instance URL
    vscode.postMessage({
      command: "authenticateNewOrg",
      alias: null,
      instanceUrl: null,
    });
  }

  // Handle org action
  function handleOrgAction(action, username, additionalData = {}) {
    switch (action) {
      case "open":
        vscode.postMessage({ command: "openOrg", username });
        break;
      case "reauth":
        vscode.postMessage({
          command: "reauthOrg",
          username,
          instanceUrl: additionalData.instanceUrl,
        });
        break;
      case "logout":
        vscode.postMessage({ command: "logoutOrg", username });
        break;
      case "setDefault":
        vscode.postMessage({ command: "setDefaultOrg", username });
        break;
      case "getToken":
        vscode.postMessage({ command: "getAccessToken", username });
        break;
    }
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize on load
  init();
})();
