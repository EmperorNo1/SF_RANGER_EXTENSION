/**
 * Org Manager Message Handler
 *
 * Routes and processes messages between the Org Manager webview and backend.
 * Handles org listing, opening, reauthentication, and logout operations.
 *
 * @module orgMessageHandler
 */

const sfdxExecutor = require("../utils/sfdxCommandExecutor");
const orgCache = require("../utils/orgCache");
const vscode = require("vscode");

/**
 * Main message router for org management webview
 *
 * @param {vscode.Webview} webview - The webview instance
 * @param {Object} message - Message from webview containing command and data
 * @returns {Promise<void>}
 */
async function handleMessage(webview, message) {
  try {
    switch (message.command) {
      case "listOrgs":
        // Support optional forceRefresh parameter from webview
        await handleListOrgs(webview, message.forceRefresh || false);
        break;

      case "openOrg":
        await handleOpenOrg(webview, message.username);
        break;

      case "reauthOrg":
        await handleReauthOrg(webview, message.username);
        break;

      case "logoutOrg":
        await handleLogoutOrg(webview, message.username);
        break;

      case "setDefaultOrg":
        await handleSetDefaultOrg(webview, message.username);
        break;

      case "getAccessToken":
        await handleGetAccessToken(webview, message.username);
        break;

      case "authenticateNewOrg":
        await handleAuthenticateNewOrg(
          webview,
          message.alias,
          message.instanceUrl
        );
        break;

      case "refreshOrgs":
        // Force refresh when user explicitly clicks refresh button
        orgCache.clearOrgListCache();
        await handleListOrgs(webview, true);
        break;

      default:
        console.warn(`Unknown command: ${message.command}`);
    }
  } catch (error) {
    console.error("Error handling message:", error);
    webview.postMessage({
      command: "error",
      message: error.message || "An unexpected error occurred",
    });
  }
}

/**
 * Lists all authenticated Salesforce orgs
 * Uses cache to avoid repeated SFDX CLI calls for better performance
 *
 * @param {vscode.Webview} webview - The webview instance
 * @param {boolean} forceRefresh - Force refresh bypassing cache (default: false)
 * @returns {Promise<void>}
 */
async function handleListOrgs(webview, forceRefresh = false) {
  try {
    // Check cache first unless forced refresh
    if (!forceRefresh) {
      const cached = orgCache.getOrgListCache();
      if (cached) {
        console.log("[OrgManager] Using cached org list");
        webview.postMessage({
          command: "orgsListResponse",
          data: cached,
          success: true,
          cached: true,
        });
        return;
      }
    }

    console.log("[OrgManager] Fetching fresh org list from SFDX CLI");
    const orgs = await sfdxExecutor.listAllOrgs();

    // Cache the result
    orgCache.setOrgListCache(orgs);

    webview.postMessage({
      command: "orgsListResponse",
      data: orgs,
      success: true,
      cached: false,
    });
  } catch (error) {
    console.error("Error listing orgs:", error);
    webview.postMessage({
      command: "orgsListResponse",
      data: [],
      success: false,
      message: "Failed to list orgs. Make sure Salesforce CLI is installed.",
    });
  }
}

/**
 * Opens a Salesforce org in the default browser
 *
 * @param {vscode.Webview} webview - The webview instance
 * @param {string} username - The org username or alias
 * @returns {Promise<void>}
 */
async function handleOpenOrg(webview, username) {
  try {
    const result = await sfdxExecutor.openOrgInBrowser(username);

    if (result.success) {
      vscode.window.showInformationMessage(`✅ Opened org: ${username}`);
    } else {
      vscode.window.showErrorMessage(`❌ ${result.message}`);
    }

    webview.postMessage({
      command: "operationComplete",
      operation: "open",
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Error opening org:", error);
    vscode.window.showErrorMessage(`❌ Failed to open org: ${error.message}`);

    webview.postMessage({
      command: "operationComplete",
      operation: "open",
      success: false,
      message: error.message,
    });
  }
}

/**
 * Reauthenticates to a Salesforce org
 *
 * @param {vscode.Webview} webview - The webview instance
 * @param {Object} orgData - The org data containing username and instanceUrl
 * @returns {Promise<void>}
 */
async function handleReauthOrg(webview, orgData) {
  try {
    const username = orgData.username || orgData;
    let instanceUrl = orgData.instanceUrl;

    // Handle undefined or "undefined" string values
    if (!instanceUrl || instanceUrl === "undefined") {
      instanceUrl = null;
    }

    vscode.window.showInformationMessage(
      `🔄 Reauthenticating ${username}... Browser will open.`
    );

    const result = await sfdxExecutor.reauthenticateOrg(username, instanceUrl);

    if (result.success) {
      vscode.window.showInformationMessage(`✅ ${result.message}`);
      // Atomically clear cache and refresh to prevent race conditions
      const clearVersion = orgCache.clearOrgListCache();
      await handleListOrgs(webview, true); // Force refresh
      // Verify cache was updated after our clear (detect if another operation interfered)
      const currentVersion = orgCache.getCacheVersion();
      if (currentVersion === clearVersion) {
        console.warn(
          "[OrgManager] Cache may not have been updated after reauth"
        );
      }
    } else {
      vscode.window.showErrorMessage(`❌ ${result.message}`);
    }

    webview.postMessage({
      command: "operationComplete",
      operation: "reauth",
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Error reauthenticating org:", error);
    vscode.window.showErrorMessage(
      `❌ Failed to reauthenticate: ${error.message}`
    );

    webview.postMessage({
      command: "operationComplete",
      operation: "reauth",
      success: false,
      message: error.message,
    });
  }
}

/**
 * Logs out from a Salesforce org
 *
 * @param {vscode.Webview} webview - The webview instance
 * @param {string} username - The org username or alias
 * @returns {Promise<void>}
 */
async function handleLogoutOrg(webview, username) {
  try {
    // Confirm before logout
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to logout from ${username}?`,
      { modal: true },
      "Yes, Logout"
    );

    if (confirm !== "Yes, Logout") {
      webview.postMessage({
        command: "operationComplete",
        operation: "logout",
        success: false,
        message: "Logout cancelled",
      });
      return;
    }

    const result = await sfdxExecutor.logoutOrg(username);

    if (result.success) {
      vscode.window.showInformationMessage(`✅ ${result.message}`);
      // Atomically clear cache and refresh after logout
      orgCache.clearOrgListCache();
      await handleListOrgs(webview, true); // Force refresh
    } else {
      vscode.window.showErrorMessage(`❌ ${result.message}`);
    }

    webview.postMessage({
      command: "operationComplete",
      operation: "logout",
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Error logging out org:", error);
    vscode.window.showErrorMessage(`❌ Failed to logout: ${error.message}`);

    webview.postMessage({
      command: "operationComplete",
      operation: "logout",
      success: false,
      message: error.message,
    });
  }
}

/**
 * Sets an org as the default target org
 *
 * @param {vscode.Webview} webview - The webview instance
 * @param {string} username - The org username or alias
 * @returns {Promise<void>}
 */
async function handleSetDefaultOrg(webview, username) {
  try {
    const result = await sfdxExecutor.setDefaultOrg(username);

    if (result.success) {
      vscode.window.showInformationMessage(`✅ ${result.message}`);
      // Atomically clear cache and refresh to show updated default
      orgCache.clearOrgListCache();
      await handleListOrgs(webview, true); // Force refresh
    } else {
      vscode.window.showErrorMessage(`❌ ${result.message}`);
    }

    webview.postMessage({
      command: "operationComplete",
      operation: "setDefault",
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Error setting default org:", error);
    vscode.window.showErrorMessage(
      `❌ Failed to set default org: ${error.message}`
    );

    webview.postMessage({
      command: "operationComplete",
      operation: "setDefault",
      success: false,
      message: error.message,
    });
  }
}

/**
 * Gets and displays the access token for an org
 *
 * @param {vscode.Webview} webview - The webview instance
 * @param {string} username - The org username or alias
 * @returns {Promise<void>}
 */
async function handleGetAccessToken(webview, username) {
  try {
    const result = await sfdxExecutor.getAccessToken(username);

    if (result.success) {
      // Copy access token to clipboard
      await vscode.env.clipboard.writeText(result.accessToken);

      // Show info message with masked token
      const maskedToken = result.accessToken.substring(0, 20) + "...";
      vscode.window.showInformationMessage(
        `✅ Access token copied to clipboard: ${maskedToken}`
      );

      webview.postMessage({
        command: "accessTokenResponse",
        success: true,
        accessToken: result.accessToken,
        instanceUrl: result.instanceUrl,
        username: result.username,
      });
    } else {
      vscode.window.showErrorMessage(`❌ ${result.message}`);
      webview.postMessage({
        command: "accessTokenResponse",
        success: false,
        message: result.message,
      });
    }
  } catch (error) {
    console.error("Error getting access token:", error);
    vscode.window.showErrorMessage(
      `❌ Failed to get access token: ${error.message}`
    );

    webview.postMessage({
      command: "accessTokenResponse",
      success: false,
      message: error.message,
    });
  }
}

/**
 * Authenticates a new Salesforce org
 *
 * @param {vscode.Webview} webview - The webview instance
 * @param {string|null} alias - Optional alias for the new org
 * @param {string|null} instanceUrl - Optional instance URL
 * @returns {Promise<void>}
 */
async function handleAuthenticateNewOrg(
  webview,
  alias = null,
  instanceUrl = null
) {
  try {
    // Prompt user for environment type if instanceUrl not provided
    if (!instanceUrl) {
      const envType = await vscode.window.showQuickPick(
        [
          {
            label: "Production",
            description: "Login to a production org (login.salesforce.com)",
            value: "https://login.salesforce.com",
          },
          {
            label: "Sandbox",
            description: "Login to a sandbox org (test.salesforce.com)",
            value: "https://test.salesforce.com",
          },
          {
            label: "Custom Domain",
            description: "Login using a custom domain/My Domain URL",
            value: "custom",
          },
        ],
        {
          placeHolder: "Select the Salesforce environment type",
          title: "Authenticate New Org",
        }
      );

      if (!envType) {
        // User cancelled
        webview.postMessage({
          command: "operationComplete",
          operation: "authenticateNewOrg",
          success: false,
          message: "Authentication cancelled",
        });
        return;
      }

      // If custom domain selected, prompt for URL
      if (envType.value === "custom") {
        instanceUrl = await vscode.window.showInputBox({
          prompt: "Enter your custom Salesforce domain URL",
          placeHolder: "https://your-company.my.salesforce.com",
          validateInput: (value) => {
            if (!value) {
              return "URL is required";
            }
            if (!value.startsWith("http://") && !value.startsWith("https://")) {
              return "URL must start with http:// or https://";
            }
            return null;
          },
        });

        if (!instanceUrl) {
          // User cancelled
          webview.postMessage({
            command: "operationComplete",
            operation: "authenticateNewOrg",
            success: false,
            message: "Authentication cancelled",
          });
          return;
        }
      } else {
        instanceUrl = envType.value;
      }
    }

    // Optionally prompt for alias
    if (!alias) {
      alias = await vscode.window.showInputBox({
        prompt: "Enter an alias for this org (optional)",
        placeHolder: "my-org",
      });
    }

    vscode.window.showInformationMessage(
      "🔐 Opening browser to authenticate new org..."
    );

    const result = await sfdxExecutor.authenticateNewOrg(alias, instanceUrl);

    if (result.success) {
      vscode.window.showInformationMessage(`✅ ${result.message}`);
      // Atomically clear cache and refresh after authentication
      orgCache.clearOrgListCache();
      await handleListOrgs(webview, true); // Force refresh
    } else {
      vscode.window.showErrorMessage(`❌ ${result.message}`);
    }

    webview.postMessage({
      command: "operationComplete",
      operation: "authenticateNewOrg",
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("Error authenticating new org:", error);
    vscode.window.showErrorMessage(
      `❌ Failed to authenticate: ${error.message}`
    );

    webview.postMessage({
      command: "operationComplete",
      operation: "authenticateNewOrg",
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  handleMessage,
};
