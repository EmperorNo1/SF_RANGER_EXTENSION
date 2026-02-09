/**
 * Unit Tests for config Module
 *
 * Tests the centralized configuration functionality for SF Ranger Toolkit.
 */

const mockGet = jest.fn();
const mockVscode = {
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: mockGet,
    })),
  },
};

jest.mock('vscode', () => mockVscode, { virtual: true });

const config = require('../../src/utils/config');

describe('config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
  });

  describe('DEFAULTS', () => {
    it('should export default configuration values', () => {
      expect(config.DEFAULTS).toBeDefined();
      expect(config.DEFAULTS.maxBufferSizeMB).toBe(50);
      expect(config.DEFAULTS.orgCacheDurationSeconds).toBe(300);
    });
  });

  describe('getMaxBufferSize', () => {
    it('should return default buffer size when no config is set', () => {
      mockGet.mockReturnValue(undefined);
      expect(config.getMaxBufferSize()).toBe(50 * 1024 * 1024);
    });

    it('should return configured buffer size converted to bytes', () => {
      mockGet.mockReturnValue(100);
      expect(config.getMaxBufferSize()).toBe(100 * 1024 * 1024);
    });

    it('should call workspace.getConfiguration with correct namespace', () => {
      mockGet.mockReturnValue(undefined);
      config.getMaxBufferSize();
      expect(mockVscode.workspace.getConfiguration).toHaveBeenCalledWith(
        'sfRangerToolkit'
      );
    });
  });

  describe('getOrgCacheDuration', () => {
    it('should return default cache duration when no config is set', () => {
      mockGet.mockReturnValue(undefined);
      expect(config.getOrgCacheDuration()).toBe(300 * 1000);
    });

    it('should return configured cache duration converted to milliseconds', () => {
      mockGet.mockReturnValue(120);
      expect(config.getOrgCacheDuration()).toBe(120 * 1000);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully and return default values', () => {
      mockVscode.workspace.getConfiguration.mockImplementation(() => {
        throw new Error('Configuration not available');
      });
      expect(() => config.getMaxBufferSize()).not.toThrow();
    });
  });
});
