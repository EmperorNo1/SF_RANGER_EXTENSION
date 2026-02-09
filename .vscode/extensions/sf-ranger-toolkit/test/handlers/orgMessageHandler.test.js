/**
 * Unit Tests for orgMessageHandler Module
 *
 * Tests the message routing and handling for org management operations.
 */

// Mock sfdxCommandExecutor
const mockSfdxExecutor = {
  listAllOrgs: jest.fn(),
  openOrgInBrowser: jest.fn(),
  reauthenticateOrg: jest.fn(),
  logoutOrg: jest.fn(),
  setDefaultOrg: jest.fn(),
  getAccessToken: jest.fn(),
  authenticateNewOrg: jest.fn(),
};

jest.mock('../../src/utils/sfdxCommandExecutor', () => mockSfdxExecutor);

// Mock orgCache
const mockOrgCache = {
  getOrgListCache: jest.fn(),
  setOrgListCache: jest.fn(),
  clearOrgListCache: jest.fn(() => 1),
  getCacheVersion: jest.fn(() => 2),
};

jest.mock('../../src/utils/orgCache', () => mockOrgCache);

// Mock vscode
const mockVscode = {
  workspace: {
    workspaceFolders: [
      {
        uri: {
          fsPath: '/mock/workspace',
        },
      },
    ],
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn(),
  },
  env: {
    clipboard: {
      writeText: jest.fn(),
    },
  },
};

jest.mock('vscode', () => mockVscode, { virtual: true });

const { handleMessage } = require('../../src/handlers/orgMessageHandler');

describe('orgMessageHandler', () => {
  let mockWebview;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock webview
    mockWebview = {
      postMessage: jest.fn(),
    };
  });

  describe('handleMessage - listOrgs', () => {
    it('should return cached orgs when available', async () => {
      const cachedOrgs = [{ username: 'cached@example.com' }];
      mockOrgCache.getOrgListCache.mockReturnValue(cachedOrgs);

      await handleMessage(mockWebview, { command: 'listOrgs' });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'orgsListResponse',
        data: cachedOrgs,
        success: true,
        cached: true,
      });
      expect(mockSfdxExecutor.listAllOrgs).not.toHaveBeenCalled();
    });

    it('should fetch fresh orgs when cache is empty', async () => {
      const freshOrgs = [{ username: 'fresh@example.com' }];
      mockOrgCache.getOrgListCache.mockReturnValue(null);
      mockSfdxExecutor.listAllOrgs.mockResolvedValue(freshOrgs);

      await handleMessage(mockWebview, { command: 'listOrgs' });

      expect(mockSfdxExecutor.listAllOrgs).toHaveBeenCalled();
      expect(mockOrgCache.setOrgListCache).toHaveBeenCalledWith(freshOrgs);
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'orgsListResponse',
        data: freshOrgs,
        success: true,
        cached: false,
      });
    });

    it('should force refresh when forceRefresh is true', async () => {
      const cachedOrgs = [{ username: 'cached@example.com' }];
      const freshOrgs = [{ username: 'fresh@example.com' }];
      mockOrgCache.getOrgListCache.mockReturnValue(cachedOrgs);
      mockSfdxExecutor.listAllOrgs.mockResolvedValue(freshOrgs);

      await handleMessage(mockWebview, { command: 'listOrgs', forceRefresh: true });

      expect(mockSfdxExecutor.listAllOrgs).toHaveBeenCalled();
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: freshOrgs,
          cached: false,
        })
      );
    });

    it('should handle listAllOrgs error gracefully', async () => {
      mockOrgCache.getOrgListCache.mockReturnValue(null);
      mockSfdxExecutor.listAllOrgs.mockRejectedValue(new Error('CLI error'));

      await handleMessage(mockWebview, { command: 'listOrgs' });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'orgsListResponse',
        data: [],
        success: false,
        message: expect.stringContaining('Failed to list orgs'),
      });
    });
  });

  describe('handleMessage - openOrg', () => {
    it('should open org and show success message', async () => {
      mockSfdxExecutor.openOrgInBrowser.mockResolvedValue({
        success: true,
        message: 'Opened org',
      });

      await handleMessage(mockWebview, { command: 'openOrg', username: 'test@example.com' });

      expect(mockSfdxExecutor.openOrgInBrowser).toHaveBeenCalledWith('test@example.com');
      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('test@example.com')
      );
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'operationComplete',
        operation: 'open',
        success: true,
        message: 'Opened org',
      });
    });

    it('should show error message on failure', async () => {
      mockSfdxExecutor.openOrgInBrowser.mockResolvedValue({
        success: false,
        message: 'Failed to open',
      });

      await handleMessage(mockWebview, { command: 'openOrg', username: 'test@example.com' });

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalled();
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'open',
          success: false,
        })
      );
    });

    it('should handle exceptions', async () => {
      mockSfdxExecutor.openOrgInBrowser.mockRejectedValue(new Error('Network error'));

      await handleMessage(mockWebview, { command: 'openOrg', username: 'test@example.com' });

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Network error')
      );
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Network error',
        })
      );
    });
  });

  describe('handleMessage - reauthOrg', () => {
    it('should reauthenticate with username string', async () => {
      mockSfdxExecutor.reauthenticateOrg.mockResolvedValue({
        success: true,
        message: 'Reauthenticated',
      });
      mockSfdxExecutor.listAllOrgs.mockResolvedValue([]);
      mockOrgCache.getOrgListCache.mockReturnValue(null);

      await handleMessage(mockWebview, { command: 'reauthOrg', username: 'test@example.com' });

      expect(mockSfdxExecutor.reauthenticateOrg).toHaveBeenCalledWith('test@example.com', null);
      expect(mockOrgCache.clearOrgListCache).toHaveBeenCalled();
      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledTimes(2); // Starting + success
    });

    it('should reauthenticate with org object containing instanceUrl', async () => {
      mockSfdxExecutor.reauthenticateOrg.mockResolvedValue({
        success: true,
        message: 'Reauthenticated',
      });
      mockSfdxExecutor.listAllOrgs.mockResolvedValue([]);
      mockOrgCache.getOrgListCache.mockReturnValue(null);

      const orgData = {
        username: 'test@example.com',
        instanceUrl: 'https://test.salesforce.com',
      };

      await handleMessage(mockWebview, { command: 'reauthOrg', username: orgData });

      expect(mockSfdxExecutor.reauthenticateOrg).toHaveBeenCalledWith(
        'test@example.com',
        'https://test.salesforce.com'
      );
    });

    it('should handle undefined instanceUrl', async () => {
      mockSfdxExecutor.reauthenticateOrg.mockResolvedValue({
        success: true,
        message: 'Reauthenticated',
      });
      mockSfdxExecutor.listAllOrgs.mockResolvedValue([]);
      mockOrgCache.getOrgListCache.mockReturnValue(null);

      const orgData = {
        username: 'test@example.com',
        instanceUrl: 'undefined',
      };

      await handleMessage(mockWebview, { command: 'reauthOrg', username: orgData });

      expect(mockSfdxExecutor.reauthenticateOrg).toHaveBeenCalledWith(
        'test@example.com',
        null
      );
    });

    it('should show error on failure', async () => {
      mockSfdxExecutor.reauthenticateOrg.mockResolvedValue({
        success: false,
        message: 'Reauth failed',
      });

      await handleMessage(mockWebview, { command: 'reauthOrg', username: 'test@example.com' });

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalled();
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'reauth',
          success: false,
        })
      );
    });
  });

  describe('handleMessage - logoutOrg', () => {
    it('should logout after user confirmation', async () => {
      mockVscode.window.showWarningMessage.mockResolvedValue('Yes, Logout');
      mockSfdxExecutor.logoutOrg.mockResolvedValue({
        success: true,
        message: 'Logged out',
      });
      mockSfdxExecutor.listAllOrgs.mockResolvedValue([]);
      mockOrgCache.getOrgListCache.mockReturnValue(null);

      await handleMessage(mockWebview, { command: 'logoutOrg', username: 'test@example.com' });

      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('test@example.com'),
        { modal: true },
        'Yes, Logout'
      );
      expect(mockSfdxExecutor.logoutOrg).toHaveBeenCalledWith('test@example.com');
      expect(mockOrgCache.clearOrgListCache).toHaveBeenCalled();
    });

    it('should cancel logout when user declines', async () => {
      mockVscode.window.showWarningMessage.mockResolvedValue(undefined);

      await handleMessage(mockWebview, { command: 'logoutOrg', username: 'test@example.com' });

      expect(mockSfdxExecutor.logoutOrg).not.toHaveBeenCalled();
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'operationComplete',
        operation: 'logout',
        success: false,
        message: 'Logout cancelled',
      });
    });

    it('should show error on logout failure', async () => {
      mockVscode.window.showWarningMessage.mockResolvedValue('Yes, Logout');
      mockSfdxExecutor.logoutOrg.mockResolvedValue({
        success: false,
        message: 'Logout failed',
      });

      await handleMessage(mockWebview, { command: 'logoutOrg', username: 'test@example.com' });

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('handleMessage - setDefaultOrg', () => {
    it('should set default org successfully', async () => {
      mockSfdxExecutor.setDefaultOrg.mockResolvedValue({
        success: true,
        message: 'Set as default',
      });
      mockSfdxExecutor.listAllOrgs.mockResolvedValue([]);
      mockOrgCache.getOrgListCache.mockReturnValue(null);

      await handleMessage(mockWebview, { command: 'setDefaultOrg', username: 'test@example.com' });

      expect(mockSfdxExecutor.setDefaultOrg).toHaveBeenCalledWith('test@example.com');
      expect(mockOrgCache.clearOrgListCache).toHaveBeenCalled();
      expect(mockVscode.window.showInformationMessage).toHaveBeenCalled();
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'setDefault',
          success: true,
        })
      );
    });

    it('should show error on failure', async () => {
      mockSfdxExecutor.setDefaultOrg.mockResolvedValue({
        success: false,
        message: 'Set default failed',
      });

      await handleMessage(mockWebview, { command: 'setDefaultOrg', username: 'test@example.com' });

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('handleMessage - getAccessToken', () => {
    it('should get token and copy to clipboard', async () => {
      mockSfdxExecutor.getAccessToken.mockResolvedValue({
        success: true,
        accessToken: '00DXXXXXXXXXXXXXXXXXXXXXXXXX',
        instanceUrl: 'https://test.salesforce.com',
        username: 'test@example.com',
      });

      await handleMessage(mockWebview, { command: 'getAccessToken', username: 'test@example.com' });

      expect(mockVscode.env.clipboard.writeText).toHaveBeenCalledWith('00DXXXXXXXXXXXXXXXXXXXXXXXXX');
      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('clipboard')
      );
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'accessTokenResponse',
        success: true,
        accessToken: '00DXXXXXXXXXXXXXXXXXXXXXXXXX',
        instanceUrl: 'https://test.salesforce.com',
        username: 'test@example.com',
      });
    });

    it('should show error on failure', async () => {
      mockSfdxExecutor.getAccessToken.mockResolvedValue({
        success: false,
        message: 'Token error',
      });

      await handleMessage(mockWebview, { command: 'getAccessToken', username: 'test@example.com' });

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalled();
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'accessTokenResponse',
        success: false,
        message: 'Token error',
      });
    });
  });

  describe('handleMessage - authenticateNewOrg', () => {
    it('should prompt for environment type and authenticate', async () => {
      mockVscode.window.showQuickPick.mockResolvedValue({
        label: 'Production',
        value: 'https://login.salesforce.com',
      });
      mockVscode.window.showInputBox.mockResolvedValue('myNewOrg');
      mockSfdxExecutor.authenticateNewOrg.mockResolvedValue({
        success: true,
        message: 'Authenticated',
        username: 'new@example.com',
      });
      mockSfdxExecutor.listAllOrgs.mockResolvedValue([]);
      mockOrgCache.getOrgListCache.mockReturnValue(null);

      await handleMessage(mockWebview, { command: 'authenticateNewOrg' });

      expect(mockVscode.window.showQuickPick).toHaveBeenCalled();
      expect(mockSfdxExecutor.authenticateNewOrg).toHaveBeenCalledWith(
        'myNewOrg',
        'https://login.salesforce.com'
      );
      expect(mockOrgCache.clearOrgListCache).toHaveBeenCalled();
    });

    it('should prompt for custom domain when selected', async () => {
      mockVscode.window.showQuickPick.mockResolvedValue({
        label: 'Custom Domain',
        value: 'custom',
      });
      mockVscode.window.showInputBox
        .mockResolvedValueOnce('https://my-company.my.salesforce.com') // Custom URL
        .mockResolvedValueOnce('myAlias'); // Alias
      mockSfdxExecutor.authenticateNewOrg.mockResolvedValue({
        success: true,
        message: 'Authenticated',
      });
      mockSfdxExecutor.listAllOrgs.mockResolvedValue([]);
      mockOrgCache.getOrgListCache.mockReturnValue(null);

      await handleMessage(mockWebview, { command: 'authenticateNewOrg' });

      expect(mockSfdxExecutor.authenticateNewOrg).toHaveBeenCalledWith(
        'myAlias',
        'https://my-company.my.salesforce.com'
      );
    });

    it('should cancel when user cancels environment selection', async () => {
      mockVscode.window.showQuickPick.mockResolvedValue(undefined);

      await handleMessage(mockWebview, { command: 'authenticateNewOrg' });

      expect(mockSfdxExecutor.authenticateNewOrg).not.toHaveBeenCalled();
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'operationComplete',
        operation: 'authenticateNewOrg',
        success: false,
        message: 'Authentication cancelled',
      });
    });

    it('should cancel when user cancels custom domain input', async () => {
      mockVscode.window.showQuickPick.mockResolvedValue({
        label: 'Custom Domain',
        value: 'custom',
      });
      mockVscode.window.showInputBox.mockResolvedValue(undefined);

      await handleMessage(mockWebview, { command: 'authenticateNewOrg' });

      expect(mockSfdxExecutor.authenticateNewOrg).not.toHaveBeenCalled();
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Authentication cancelled',
        })
      );
    });

    it('should use provided instanceUrl without prompting', async () => {
      mockVscode.window.showInputBox.mockResolvedValue('providedAlias');
      mockSfdxExecutor.authenticateNewOrg.mockResolvedValue({
        success: true,
        message: 'Authenticated',
      });
      mockSfdxExecutor.listAllOrgs.mockResolvedValue([]);
      mockOrgCache.getOrgListCache.mockReturnValue(null);

      await handleMessage(mockWebview, {
        command: 'authenticateNewOrg',
        instanceUrl: 'https://provided.salesforce.com',
      });

      expect(mockVscode.window.showQuickPick).not.toHaveBeenCalled();
      expect(mockSfdxExecutor.authenticateNewOrg).toHaveBeenCalledWith(
        'providedAlias',
        'https://provided.salesforce.com'
      );
    });
  });

  describe('handleMessage - refreshOrgs', () => {
    it('should clear cache and force refresh', async () => {
      const freshOrgs = [{ username: 'fresh@example.com' }];
      mockSfdxExecutor.listAllOrgs.mockResolvedValue(freshOrgs);

      await handleMessage(mockWebview, { command: 'refreshOrgs' });

      expect(mockOrgCache.clearOrgListCache).toHaveBeenCalled();
      expect(mockSfdxExecutor.listAllOrgs).toHaveBeenCalled();
    });
  });

  describe('handleMessage - unknown command', () => {
    it('should log warning for unknown command', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await handleMessage(mockWebview, { command: 'unknownCommand' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown command')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('handleMessage - error handling', () => {
    it('should catch and report errors within handler functions', async () => {
      // Force an error by making getOrgListCache throw
      // The error is caught within handleListOrgs and returns a specific response
      mockOrgCache.getOrgListCache.mockImplementation(() => {
        throw new Error('Unexpected cache error');
      });

      await handleMessage(mockWebview, { command: 'listOrgs' });

      // The error is caught inside handleListOrgs and returns an error response
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'orgsListResponse',
        data: [],
        success: false,
        message: 'Failed to list orgs. Make sure Salesforce CLI is installed.',
      });
    });

    it('should send error to webview when unhandled exception occurs', async () => {
      // Force an unhandled error in handleOpenOrg by throwing after initial checks
      mockSfdxExecutor.openOrgInBrowser.mockImplementation(() => {
        throw new Error('Unhandled exception');
      });

      await handleMessage(mockWebview, { command: 'openOrg', username: 'test@example.com' });

      // The error is caught in handleOpenOrg's try/catch
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        command: 'operationComplete',
        operation: 'open',
        success: false,
        message: 'Unhandled exception',
      });
    });
  });
});

