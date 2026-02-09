/**
 * Unit Tests for sfdxCommandExecutor Module
 *
 * Tests the SFDX CLI command execution and response parsing functionality.
 */

// Mock child_process
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  exec: mockExec,
}));

// Mock config module
jest.mock('../../src/utils/config', () => ({
  getMaxBufferSize: jest.fn(() => 50 * 1024 * 1024),
}));

// Mock vscode module
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
};

jest.mock('vscode', () => mockVscode, { virtual: true });

const sfdxExecutor = require('../../src/utils/sfdxCommandExecutor');

describe('sfdxCommandExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeSfdxCommand', () => {
    it('should execute command and return parsed JSON on success', async () => {
      const mockResponse = { status: 0, result: { username: 'test@example.com' } };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.executeSfdxCommand('sf org display --json');

      expect(result).toEqual(mockResponse);
      expect(mockExec).toHaveBeenCalledWith(
        'sf org display --json',
        expect.objectContaining({
          maxBuffer: 50 * 1024 * 1024,
          cwd: '/mock/workspace',
        }),
        expect.any(Function)
      );
    });

    it('should parse JSON from stdout on command error', async () => {
      const errorResponse = { status: 1, message: 'Auth error' };
      const error = new Error('Command failed');
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(error, JSON.stringify(errorResponse), '');
      });

      const result = await sfdxExecutor.executeSfdxCommand('sf org display --json');

      expect(result).toEqual(errorResponse);
    });

    it('should reject when JSON parsing fails', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, 'not valid json', '');
      });

      await expect(sfdxExecutor.executeSfdxCommand('sf org display --json'))
        .rejects.toThrow('Failed to parse SFDX output');
    });

    it('should reject on command error when JSON parsing fails', async () => {
      const error = new Error('Command failed');
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(error, 'invalid', 'invalid');
      });

      await expect(sfdxExecutor.executeSfdxCommand('sf org display --json'))
        .rejects.toThrow('Command failed');
    });
  });

  describe('checkSfdxConnection', () => {
    it('should return connection info on success', async () => {
      const mockOrgInfo = {
        status: 0,
        result: {
          username: 'test@example.com',
          instanceUrl: 'https://test.salesforce.com',
          apiVersion: '59.0',
        },
      };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockOrgInfo), '');
      });

      const result = await sfdxExecutor.checkSfdxConnection();

      expect(result).toEqual({
        connected: true,
        username: 'test@example.com',
        instanceUrl: 'https://test.salesforce.com',
        apiVersion: '59.0',
      });
    });

    it('should throw error when org info fails', async () => {
      const mockError = { status: 1, message: 'No default org' };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockError), '');
      });

      await expect(sfdxExecutor.checkSfdxConnection())
        .rejects.toThrow('No default org');
    });
  });

  describe('listAllOrgs', () => {
    it('should return combined list of all orgs', async () => {
      const mockResponse = {
        status: 0,
        result: {
          nonScratchOrgs: [
            { username: 'prod@example.com', alias: 'prod', isDefaultUsername: true },
          ],
          scratchOrgs: [
            { username: 'scratch@test.com', alias: 'scratch', isScratchOrg: true },
          ],
        },
      };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.listAllOrgs();

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('prod@example.com');
      expect(result[0].isDefaultUsername).toBe(true);
      expect(result[1].username).toBe('scratch@test.com');
      expect(result[1].isScratchOrg).toBe(true);
    });

    it('should return empty array on error', async () => {
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(new Error('Failed'), '', '');
      });

      const result = await sfdxExecutor.listAllOrgs();

      expect(result).toEqual([]);
    });

    it('should handle missing scratchOrgs array', async () => {
      const mockResponse = {
        status: 0,
        result: {
          nonScratchOrgs: [{ username: 'prod@example.com' }],
        },
      };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.listAllOrgs();

      expect(result).toHaveLength(1);
    });
  });

  describe('openOrgInBrowser', () => {
    it('should return success on successful open', async () => {
      const mockResponse = { status: 0, result: { url: 'https://test.salesforce.com' } };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.openOrgInBrowser('myOrg');

      expect(result.success).toBe(true);
      expect(result.message).toContain('myOrg');
    });

    it('should return failure on error', async () => {
      const mockResponse = { status: 1, message: 'Failed to open' };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.openOrgInBrowser('myOrg');

      expect(result.success).toBe(false);
    });
  });

  describe('reauthenticateOrg', () => {
    it('should reauthenticate without instance URL', async () => {
      const mockResponse = { status: 0, result: { username: 'test@example.com' } };
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).not.toContain('--instance-url');
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.reauthenticateOrg('myOrg', null);

      expect(result.success).toBe(true);
    });

    it('should reauthenticate with instance URL', async () => {
      const mockResponse = { status: 0, result: { username: 'test@example.com' } };
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).toContain('--instance-url');
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.reauthenticateOrg('myOrg', 'https://test.salesforce.com');

      expect(result.success).toBe(true);
    });

    it('should handle "undefined" instance URL string', async () => {
      const mockResponse = { status: 0, result: {} };
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).not.toContain('--instance-url');
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.reauthenticateOrg('myOrg', 'undefined');

      expect(result.success).toBe(true);
    });
  });

  describe('logoutOrg', () => {
    it('should return success on successful logout', async () => {
      const mockResponse = { status: 0 };
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).toContain('--no-prompt');
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.logoutOrg('myOrg');

      expect(result.success).toBe(true);
      expect(result.message).toContain('myOrg');
    });

    it('should return failure message on error', async () => {
      const mockResponse = { status: 1, message: 'Logout failed' };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.logoutOrg('myOrg');

      expect(result.success).toBe(false);
    });
  });

  describe('setDefaultOrg', () => {
    it('should set default org successfully', async () => {
      const mockResponse = { status: 0 };
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).toContain('target-org=');
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.setDefaultOrg('myOrg');

      expect(result.success).toBe(true);
      expect(result.message).toContain('myOrg');
    });

    it('should return failure on error', async () => {
      const mockResponse = { status: 1, message: 'Config failed' };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.setDefaultOrg('myOrg');

      expect(result.success).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('should return access token info on success', async () => {
      const mockResponse = {
        status: 0,
        result: {
          accessToken: '00DXXX123',
          instanceUrl: 'https://test.salesforce.com',
          username: 'test@example.com',
        },
      };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.getAccessToken('myOrg');

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('00DXXX123');
      expect(result.instanceUrl).toBe('https://test.salesforce.com');
      expect(result.username).toBe('test@example.com');
    });

    it('should return failure on error', async () => {
      const mockResponse = { status: 1, message: 'Token error' };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.getAccessToken('myOrg');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Token error');
    });
  });

  describe('authenticateNewOrg', () => {
    it('should authenticate with alias only', async () => {
      const mockResponse = { status: 0, result: { username: 'new@example.com' } };
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).toContain('--alias newOrg');
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.authenticateNewOrg('newOrg', null);

      expect(result.success).toBe(true);
      expect(result.username).toBe('new@example.com');
    });

    it('should authenticate with instance URL', async () => {
      const mockResponse = { status: 0, result: { username: 'new@example.com' } };
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).toContain('--instance-url https://test.salesforce.com');
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.authenticateNewOrg(null, 'https://test.salesforce.com');

      expect(result.success).toBe(true);
    });

    it('should authenticate without any options', async () => {
      const mockResponse = { status: 0, result: {} };
      mockExec.mockImplementation((cmd, options, callback) => {
        expect(cmd).toBe('sf org login web --json');
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.authenticateNewOrg();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully authenticated');
    });

    it('should return failure on error', async () => {
      const mockResponse = { status: 1, message: 'Auth failed' };
      mockExec.mockImplementation((cmd, options, callback) => {
        callback(null, JSON.stringify(mockResponse), '');
      });

      const result = await sfdxExecutor.authenticateNewOrg('newOrg');

      expect(result.success).toBe(false);
    });
  });
});

