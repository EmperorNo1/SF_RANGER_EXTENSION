/**
 * Org Manager Webview Provider
 *
 * Manages the lifecycle of the Org Manager webview panel.
 * Implements VS Code's WebviewViewProvider interface.
 *
 * @module orgManagerProvider
 */

const vscode = require("vscode");
const orgMessageHandler = require("../handlers/orgMessageHandler");
const path = require("path");
const fs = require("fs");

/**
 * Webview View Provider for Org Manager
 * Manages webview lifecycle, HTML content, and message passing
 */
class OrgManagerViewProvider {
  /**
   * Creates a new OrgManagerViewProvider
   *
   * @param {vscode.ExtensionContext} context - Extension context
   */
  constructor(context) {
    this._context = context;
    this._view = null;
  }

  /**
   * Resolves the webview view
   * Called when the view is first shown or when it needs to be recreated
   *
   * @param {vscode.WebviewView} webviewView - The webview view to resolve
   * @param {vscode.WebviewViewResolveContext} context - Context for the resolve
   * @param {vscode.CancellationToken} token - Cancellation token
   */
  resolveWebviewView(webviewView, context, token) {
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };

    // Set the HTML content
    webviewView.webview.html = this._getHtmlContent(webviewView.webview);

    // Set up message handling
    this._setupMessageHandling(webviewView);

    // Trigger initial org list fetch
    setTimeout(() => {
      webviewView.webview.postMessage({
        command: "initialize",
      });
    }, 500);
  }

  /**
   * Sets up message handling between webview and extension
   *
   * @param {vscode.WebviewView} webviewView - The webview view
   * @private
   */
  _setupMessageHandling(webviewView) {
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        await orgMessageHandler.handleMessage(webviewView.webview, message);
      },
      undefined,
      this._context.subscriptions
    );
  }

  /**
   * Generates the HTML content for the webview
   *
   * @param {vscode.Webview} webview - The webview instance
   * @returns {string} HTML content
   * @private
   */
  _getHtmlContent(webview) {
    // Read the org manager content file
    const contentPath = path.join(
      this._context.extensionPath,
      "src",
      "webview",
      "org-manager-content.js"
    );

    let webviewContent = "";
    if (fs.existsSync(contentPath)) {
      webviewContent = fs.readFileSync(contentPath, "utf8");
    }

    // Generate webview URI for the icon
    const iconPath = vscode.Uri.file(
      path.join(this._context.extensionPath, "icons", "org-manager-icon.png")
    );
    const iconUri = webview.asWebviewUri(iconPath);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>SF Org Manager</title>
</head>
<body>
  <div id="orgManagerRoot"></div>
  <script>
    const ICON_URI = '${iconUri.toString()}';
    ${webviewContent}
  </script>
</body>
</html>`;
  }

  /**
   * Returns the current webview view
   *
   * @returns {vscode.WebviewView|null} The webview view
   */
  getView() {
    return this._view;
  }
}

module.exports = OrgManagerViewProvider;
