/**
 * SFDX Command Executor
 *
 * Handles execution of Salesforce CLI commands and JSON response parsing.
 * Used by Org Manager for listing orgs, open, reauth, logout, set default, token, authenticate.
 *
 * @module sfdxCommandExecutor
 */

const vscode = require("vscode");
const { exec } = require("child_process");
const config = require("./config");

/**
 * Executes an SFDX CLI command and returns parsed JSON result
 *
 * @param {string} command - The SFDX command to execute (e.g., "sf org display --json")
 * @returns {Promise<Object>} Parsed JSON response from SFDX CLI
 * @throws {Error} If command execution fails or JSON parsing fails
 *
 * @example
 * const result = await executeSfdxCommand("sf org display --json");
 * // Returns: { status: 0, result: { username: "...", instanceUrl: "..." } }
 */
function executeSfdxCommand(command) {
  return new Promise((resolve, reject) => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;

    exec(
      command,
      {
        maxBuffer: config.getMaxBufferSize(), // Configurable buffer size for large metadata responses
        cwd: cwd,
      },
      (error, stdout, stderr) => {
        if (error) {
          // Try to parse error response as JSON (SFDX returns JSON even for errors)
          try {
            const errorData = JSON.parse(stdout || stderr);
            resolve(errorData);
          } catch {
            reject(error);
          }
          return;
        }

        try {
          const data = JSON.parse(stdout);
          resolve(data);
        } catch (parseError) {
          reject(
            new Error(`Failed to parse SFDX output: ${parseError.message}`)
          );
        }
      }
    );
  });
}

/**
 * Checks if SFDX CLI is available and authenticated
 *
 * @returns {Promise<Object>} Org information including username and instanceUrl
 * @throws {Error} If no authenticated org found
 */
async function checkSfdxConnection() {
  const result = await executeSfdxCommand("sf org display --json");

  if (result.status === 0 && result.result) {
    return {
      connected: true,
      username: result.result.username,
      instanceUrl: result.result.instanceUrl,
      apiVersion: result.result.apiVersion,
    };
  }

  throw new Error(result.message || "Failed to get org info");
}

/**
 * Lists all authenticated Salesforce orgs
 *
 * @returns {Promise<Array>} Array of org objects with username, alias, connectedStatus, etc.
 *
 * @example
 * const orgs = await listAllOrgs();
 * // Returns: [{ username: "user@example.com", alias: "myOrg", ... }, ...]
 */
async function listAllOrgs() {
  try {
    const result = await executeSfdxCommand("sf org list --json");

    if (result.status === 0 && result.result) {
      const allOrgs = [];

      // Combine all org types (nonScratchOrgs and scratchOrgs)
      if (result.result.nonScratchOrgs) {
        allOrgs.push(...result.result.nonScratchOrgs);
      }
      if (result.result.scratchOrgs) {
        allOrgs.push(...result.result.scratchOrgs);
      }

      return allOrgs.map((org) => ({
        username: org.username,
        alias: org.alias || org.username,
        orgId: org.orgId,
        instanceUrl: org.instanceUrl,
        connectedStatus: org.connectedStatus || "Unknown",
        isDefaultUsername: org.isDefaultUsername || false,
        isDefaultDevHubUsername: org.isDefaultDevHubUsername || false,
        isScratchOrg: org.isScratchOrg || false,
        expirationDate: org.expirationDate || null,
      }));
    }

    return [];
  } catch (error) {
    console.error("Error listing orgs:", error);
    return [];
  }
}

/**
 * Opens a Salesforce org in the default browser
 *
 * @param {string} username - The org username or alias
 * @returns {Promise<Object>} Result with URL and success status
 *
 * @example
 * await openOrgInBrowser("myOrg");
 */
async function openOrgInBrowser(username) {
  try {
    const result = await executeSfdxCommand(
      `sf org open --target-org ${username} --json`
    );

    if (result.status === 0) {
      return {
        success: true,
        message: `Opened org: ${username}`,
      };
    }

    throw new Error(result.message || "Failed to open org");
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Reauthenticates to a Salesforce org using web login with instance URL
 *
 * @param {string} username - The org username or alias
 * @param {string|null} instanceUrl - The org's instance URL (optional)
 * @returns {Promise<Object>} Result with success status
 */
async function reauthenticateOrg(username, instanceUrl) {
  try {
    // Build command with optional instance URL
    let command = `sf org login web --alias ${username} --json`;

    // Only add instance-url if it's provided and valid
    if (instanceUrl && instanceUrl !== "undefined") {
      command = `sf org login web --instance-url ${instanceUrl} --alias ${username} --json`;
    }

    const result = await executeSfdxCommand(command);

    if (result.status === 0) {
      return {
        success: true,
        message: `Reauthenticated org: ${username}`,
      };
    }

    throw new Error(result.message || "Failed to reauthenticate");
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Logs out from a Salesforce org
 *
 * @param {string} username - The org username or alias
 * @returns {Promise<Object>} Result with success status
 *
 * @example
 * await logoutOrg("myOrg");
 */
async function logoutOrg(username) {
  try {
    const result = await executeSfdxCommand(
      `sf org logout --target-org ${username} --no-prompt --json`
    );

    if (result.status === 0) {
      return {
        success: true,
        message: `Logged out from org: ${username}`,
      };
    }

    throw new Error(result.message || "Failed to logout");
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Sets an org as the default target org
 *
 * @param {string} username - The org username or alias
 * @returns {Promise<Object>} Result with success status
 */
async function setDefaultOrg(username) {
  try {
    const result = await executeSfdxCommand(
      `sf config set target-org=${username} --json`
    );

    if (result.status === 0) {
      return {
        success: true,
        message: `Set ${username} as default org`,
      };
    }

    throw new Error(result.message || "Failed to set default org");
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Gets the access token for a Salesforce org
 *
 * @param {string} username - The org username or alias
 * @returns {Promise<Object>} Result with access token and instance URL
 *
 * @example
 * const tokenInfo = await getAccessToken("myOrg");
 * // Returns: { success: true, accessToken: "00D...", instanceUrl: "https://..." }
 */
async function getAccessToken(username) {
  try {
    const result = await executeSfdxCommand(
      `sf org display --target-org ${username} --json`
    );

    if (result.status === 0 && result.result) {
      return {
        success: true,
        accessToken: result.result.accessToken,
        instanceUrl: result.result.instanceUrl,
        username: result.result.username,
      };
    }

    throw new Error(result.message || "Failed to get access token");
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Authenticates a new Salesforce org using web login
 *
 * @param {string} alias - Optional alias for the new org
 * @param {string} instanceUrl - Optional instance URL (defaults to login.salesforce.com)
 * @returns {Promise<Object>} Result with success status
 *
 * @example
 * await authenticateNewOrg("myNewOrg", "https://test.salesforce.com");
 */
async function authenticateNewOrg(alias = null, instanceUrl = null) {
  try {
    let command = "sf org login web --json";

    if (instanceUrl) {
      command += ` --instance-url ${instanceUrl}`;
    }

    if (alias) {
      command += ` --alias ${alias}`;
    }

    const result = await executeSfdxCommand(command);

    if (result.status === 0) {
      return {
        success: true,
        message: alias
          ? `Successfully authenticated org: ${alias}`
          : "Successfully authenticated new org",
        username: result.result?.username,
      };
    }

    throw new Error(result.message || "Failed to authenticate new org");
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

module.exports = {
  executeSfdxCommand,
  checkSfdxConnection,
  listAllOrgs,
  openOrgInBrowser,
  reauthenticateOrg,
  logoutOrg,
  setDefaultOrg,
  getAccessToken,
  authenticateNewOrg,
};
