/**
 * Salesforce Tools Extension
 *
 * Main entry point for the VS Code extension.
 * Provides a sidebar to manage authenticated SFDX orgs (open, reauth, logout, token).
 *
 * @module extension
 * @author SF Ranger
 * @version 1.0.0
 */

const vscode = require("vscode");
const OrgManagerViewProvider = require("./providers/orgManagerProvider");

/**
 * Checks if extension was just installed or updated and prompts for reload
 *
 * @param {vscode.ExtensionContext} context - The extension context
 * @returns {Promise<void>}
 */
async function checkForReloadPrompt(context) {
  const packageJson = require("../package.json");
  const currentVersion = packageJson.version;
  const previousVersion = context.globalState.get("extensionVersion");

  // If this is first install or version changed
  if (!previousVersion || previousVersion !== currentVersion) {
    // Store the new version
    await context.globalState.update("extensionVersion", currentVersion);

    // Only show reload prompt if there was a previous version (update scenario)
    if (previousVersion) {
      const action = await vscode.window.showInformationMessage(
        `🎉 Salesforce Tools updated to v${currentVersion}. Reload to activate all features.`,
        "Reload Now",
        "Later"
      );

      if (action === "Reload Now") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    } else {
      // First install - show welcome message with reload prompt
      const action = await vscode.window.showInformationMessage(
        `✅ Salesforce Tools v${currentVersion} installed! Reload VS Code to activate.`,
        "Reload Now",
        "Later"
      );

      if (action === "Reload Now") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    }
  }
}

/**
 * Activates the extension
 * Called when the extension is first activated
 *
 * @param {vscode.ExtensionContext} context - The extension context
 * @returns {void}
 *
 * @example
 * // Extension activates when VS Code starts (onStartupFinished)
 * // Creates two sidebar panels: Package.xml Generator and Org Manager
 */
function activate(context) {
  console.log("📦 Salesforce Tools extension is now active!");

  // Check for install/update and prompt for reload if needed
  checkForReloadPrompt(context);

  // Create and register the Org Manager view provider
  const orgManagerProvider = new OrgManagerViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "sfRangerToolkit.orgManager",
      orgManagerProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true, // Keep state when sidebar is hidden
        },
      }
    )
  );

  console.log("✅ Org Manager sidebar registered successfully");
}

/**
 * Deactivates the extension
 * Called when the extension is deactivated
 * Performs cleanup of caches and temporary resources
 *
 * @returns {void}
 */
function deactivate() {
  console.log("SF Ranger Tools extension deactivating...");

  try {
    const orgCache = require("./utils/orgCache");
    orgCache.clearOrgListCache();
    console.log("✓ Org cache cleared");
    console.log("✅ SF Ranger Tools extension deactivated successfully");
  } catch (error) {
    console.error("⚠️ Error during deactivation cleanup:", error.message);
  }
}

module.exports = {
  activate,
  deactivate,
};
