/**
 * Unit Tests for orgCache Module
 *
 * Tests the in-memory caching functionality for org list data.
 */

// Mock config module before requiring orgCache
jest.mock('../../src/utils/config', () => ({
  getOrgCacheDuration: jest.fn(() => 60000), // 60 seconds default
}));

const orgCache = require('../../src/utils/orgCache');
const config = require('../../src/utils/config');

describe('orgCache', () => {
  // Reset cache before each test
  beforeEach(() => {
    orgCache.clearOrgListCache();
    jest.clearAllMocks();
  });

  describe('setOrgListCache', () => {
    it('should cache an array of orgs', () => {
      const mockOrgs = [
        { username: 'user1@example.com', alias: 'org1' },
        { username: 'user2@example.com', alias: 'org2' },
      ];

      const version = orgCache.setOrgListCache(mockOrgs);

      expect(version).toBeGreaterThan(0);
      expect(orgCache.getOrgListCache()).toEqual(mockOrgs);
    });

    it('should cache an empty array', () => {
      const version = orgCache.setOrgListCache([]);

      expect(version).toBeGreaterThan(0);
      expect(orgCache.getOrgListCache()).toEqual([]);
    });

    it('should increment version on each set', () => {
      const version1 = orgCache.setOrgListCache([{ username: 'a' }]);
      const version2 = orgCache.setOrgListCache([{ username: 'b' }]);

      expect(version2).toBe(version1 + 1);
    });
  });

  describe('getOrgListCache', () => {
    it('should return null when cache is empty', () => {
      expect(orgCache.getOrgListCache()).toBeNull();
    });

    it('should return cached data when valid', () => {
      const mockOrgs = [{ username: 'test@example.com' }];
      orgCache.setOrgListCache(mockOrgs);

      expect(orgCache.getOrgListCache()).toEqual(mockOrgs);
    });

    it('should return null when cache expires', async () => {
      // Set cache duration to 1ms (nearly immediate expiration)
      config.getOrgCacheDuration.mockReturnValue(1);

      const mockOrgs = [{ username: 'test@example.com' }];
      orgCache.setOrgListCache(mockOrgs);

      // Allow some time to pass (2ms to ensure expiration)
      await new Promise(resolve => setTimeout(resolve, 5));
      
      expect(orgCache.getOrgListCache()).toBeNull();
    });

    it('should return data when within cache duration', () => {
      // Set cache duration to 1 hour
      config.getOrgCacheDuration.mockReturnValue(3600000);

      const mockOrgs = [{ username: 'test@example.com' }];
      orgCache.setOrgListCache(mockOrgs);

      expect(orgCache.getOrgListCache()).toEqual(mockOrgs);
    });
  });

  describe('clearOrgListCache', () => {
    it('should clear cached data', () => {
      const mockOrgs = [{ username: 'test@example.com' }];
      orgCache.setOrgListCache(mockOrgs);

      expect(orgCache.getOrgListCache()).not.toBeNull();

      orgCache.clearOrgListCache();

      expect(orgCache.getOrgListCache()).toBeNull();
    });

    it('should increment version on clear', () => {
      const versionBeforeClear = orgCache.getCacheVersion();
      orgCache.clearOrgListCache();
      const versionAfterClear = orgCache.getCacheVersion();

      expect(versionAfterClear).toBe(versionBeforeClear + 1);
    });

    it('should return the new version number', () => {
      orgCache.setOrgListCache([{ username: 'test' }]);
      const version = orgCache.clearOrgListCache();

      expect(version).toBe(orgCache.getCacheVersion());
    });
  });

  describe('getCacheStats', () => {
    it('should return default stats when cache is empty', () => {
      const stats = orgCache.getCacheStats();

      expect(stats).toEqual({
        cached: false,
        size: 0,
        age: 0,
        valid: false,
      });
    });

    it('should return correct stats when cache is populated', () => {
      config.getOrgCacheDuration.mockReturnValue(60000);
      const mockOrgs = [
        { username: 'user1@example.com' },
        { username: 'user2@example.com' },
      ];
      orgCache.setOrgListCache(mockOrgs);

      const stats = orgCache.getCacheStats();

      expect(stats.cached).toBe(true);
      expect(stats.size).toBe(2);
      expect(stats.valid).toBe(true);
      expect(stats.age).toBeGreaterThanOrEqual(0);
      expect(stats.ageSeconds).toBeGreaterThanOrEqual(0);
      expect(stats.expiresIn).toBeGreaterThan(0);
      expect(stats.cacheDuration).toBe(60000);
    });

    it('should show invalid when cache is expired', async () => {
      // Set cache duration to 1ms (nearly immediate expiration)
      config.getOrgCacheDuration.mockReturnValue(1);

      orgCache.setOrgListCache([{ username: 'test' }]);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const stats = orgCache.getCacheStats();

      expect(stats.valid).toBe(false);
      expect(stats.expiresIn).toBe(0);
    });
  });

  describe('getCacheVersion', () => {
    it('should return current version number', () => {
      const version = orgCache.getCacheVersion();
      expect(typeof version).toBe('number');
    });

    it('should track version changes across operations', () => {
      const v1 = orgCache.getCacheVersion();

      orgCache.setOrgListCache([]);
      const v2 = orgCache.getCacheVersion();

      orgCache.clearOrgListCache();
      const v3 = orgCache.getCacheVersion();

      expect(v2).toBe(v1 + 1);
      expect(v3).toBe(v2 + 1);
    });
  });

  describe('getCacheDuration', () => {
    it('should return the configured cache duration', () => {
      config.getOrgCacheDuration.mockReturnValue(120000);

      const duration = orgCache.getCacheDuration();

      expect(duration).toBe(120000);
    });
  });

  describe('race condition handling', () => {
    it('should maintain consistency with rapid set/get operations', () => {
      const orgs1 = [{ username: 'first' }];
      const orgs2 = [{ username: 'second' }];
      const orgs3 = [{ username: 'third' }];

      // Rapid updates
      orgCache.setOrgListCache(orgs1);
      orgCache.setOrgListCache(orgs2);
      orgCache.setOrgListCache(orgs3);

      // Should have the last set value
      expect(orgCache.getOrgListCache()).toEqual(orgs3);
    });

    it('should maintain version consistency', () => {
      const versionsSet = [];
      
      for (let i = 0; i < 10; i++) {
        versionsSet.push(orgCache.setOrgListCache([{ id: i }]));
      }

      // All versions should be unique and sequential
      for (let i = 1; i < versionsSet.length; i++) {
        expect(versionsSet[i]).toBe(versionsSet[i - 1] + 1);
      }
    });
  });
});

