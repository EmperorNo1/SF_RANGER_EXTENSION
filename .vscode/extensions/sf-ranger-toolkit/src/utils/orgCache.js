/**
 * Org List Cache
 *
 * Caches the org list to avoid repeated SFDX CLI calls.
 * This significantly improves performance when switching between tabs
 * or refreshing the Org Manager view.
 *
 * @module orgCache
 */

const config = require("./config");

/**
 * In-memory cache for org list
 * @type {Array<Object>|null}
 */
let orgListCache = null;

/**
 * Timestamp when the cache was last updated
 * @type {number|null}
 */
let cacheTimestamp = null;

/**
 * Cache version to prevent race conditions
 * Incremented on each update/clear operation
 * @type {number}
 */
let cacheVersion = 0;

/**
 * Cache operation lock to prevent concurrent modifications
 * @type {boolean}
 */
let cacheLock = false;

/**
 * Gets the cache duration from configuration
 * After this time, the cache is considered stale
 * @returns {number} Cache duration in milliseconds
 */
function getCacheDuration() {
  return config.getOrgCacheDuration();
}

/**
 * Sets the org list cache with current timestamp
 * Uses atomic operations to prevent race conditions
 *
 * @param {Array<Object>} orgs - Array of org objects to cache
 * @returns {number} The cache version after update
 *
 * @example
 * setOrgListCache([
 *   { username: "user@example.com", alias: "MyOrg", ... }
 * ]);
 */
function setOrgListCache(orgs) {
  // Atomic update: all fields updated together
  const timestamp = Date.now();
  cacheVersion++;
  const version = cacheVersion;

  orgListCache = orgs;
  cacheTimestamp = timestamp;

  console.log(
    `[OrgCache] Cached ${orgs.length} orgs at ${new Date(timestamp).toISOString()} (v${version})`
  );

  return version;
}

/**
 * Gets the cached org list if it's still valid
 * Returns null if cache is expired or doesn't exist
 *
 * @returns {Array<Object>|null} Cached org list or null if expired/empty
 *
 * @example
 * const cachedOrgs = getOrgListCache();
 * if (cachedOrgs) {
 *   // Use cached data
 * } else {
 *   // Fetch fresh data
 * }
 */
function getOrgListCache() {
  if (!orgListCache || !cacheTimestamp) {
    console.log("[OrgCache] No cache available");
    return null;
  }

  const now = Date.now();
  const cacheAge = now - cacheTimestamp;
  const cacheDuration = getCacheDuration();

  if (cacheAge > cacheDuration) {
    // Cache expired
    console.log(
      `[OrgCache] Cache expired (age: ${cacheAge}ms, limit: ${cacheDuration}ms)`
    );
    orgListCache = null;
    cacheTimestamp = null;
    return null;
  }

  console.log(`[OrgCache] Returning cached data (age: ${cacheAge}ms)`);
  return orgListCache;
}

/**
 * Clears the org list cache
 * Should be called after operations that change org state:
 * - Adding new org
 * - Removing org
 * - Setting default org
 * - Explicit user refresh
 *
 * @returns {number} The cache version after clearing
 *
 * @example
 * // After logout operation
 * await logoutOrg(username);
 * clearOrgListCache(); // Force refresh on next load
 */
function clearOrgListCache() {
  // Atomic clear: increment version and clear all fields together
  cacheVersion++;
  const version = cacheVersion;

  orgListCache = null;
  cacheTimestamp = null;

  console.log(`[OrgCache] Cache cleared (v${version})`);

  return version;
}

/**
 * Gets cache statistics for debugging
 *
 * @returns {Object} Cache stats including size, age, and validity
 */
function getCacheStats() {
  if (!orgListCache || !cacheTimestamp) {
    return {
      cached: false,
      size: 0,
      age: 0,
      valid: false,
    };
  }

  const now = Date.now();
  const age = now - cacheTimestamp;
  const cacheDuration = getCacheDuration();
  const valid = age <= cacheDuration;

  return {
    cached: true,
    size: orgListCache.length,
    age: age,
    ageSeconds: Math.round(age / 1000),
    valid: valid,
    expiresIn: valid ? cacheDuration - age : 0,
    cacheDuration: cacheDuration,
  };
}

/**
 * Gets the current cache version
 * Useful for detecting if cache was updated/cleared
 *
 * @returns {number} Current cache version
 */
function getCacheVersion() {
  return cacheVersion;
}

module.exports = {
  setOrgListCache,
  getOrgListCache,
  clearOrgListCache,
  getCacheStats,
  getCacheVersion,
  getCacheDuration, // Export for external use
};
