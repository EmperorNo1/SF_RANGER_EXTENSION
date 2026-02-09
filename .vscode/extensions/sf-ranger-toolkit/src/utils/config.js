/**
 * Extension Configuration
 *
 * Centralized configuration for SF Ranger Toolkit extension.
 *
 * @module config
 */

const vscode = require("vscode");

const DEFAULTS = {
  maxBufferSizeMB: 50,
  orgCacheDurationSeconds: 300, // 5 minutes
};

function getConfig(key, defaultValue) {
  try {
    const config = vscode.workspace.getConfiguration("sfRangerToolkit");
    const value = config.get(key);
    return value !== undefined ? value : defaultValue;
  } catch (error) {
    console.warn(
      `Failed to get config for ${key}, using default:`,
      error.message
    );
    return defaultValue;
  }
}

function getMaxBufferSize() {
  const sizeMB = getConfig("maxBufferSizeMB", DEFAULTS.maxBufferSizeMB);
  return sizeMB * 1024 * 1024; // Convert MB to bytes
}

function getOrgCacheDuration() {
  const seconds = getConfig(
    "orgCacheDurationSeconds",
    DEFAULTS.orgCacheDurationSeconds
  );
  return seconds * 1000; // Convert to milliseconds
}

module.exports = {
  getMaxBufferSize,
  getOrgCacheDuration,
  DEFAULTS,
};
