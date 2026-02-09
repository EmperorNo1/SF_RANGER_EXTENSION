/**
 * Jest Test Setup
 *
 * Global mocks and setup for all tests
 */

// Mock VS Code API - variable must be prefixed with 'mock' for jest.mock() to access it
const mockVscode = {
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key) => undefined),
    })),
    workspaceFolders: [
      {
        uri: {
          fsPath: "/mock/workspace",
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
  Uri: {
    file: jest.fn((path) => ({ fsPath: path })),
  },
};

// Make vscode available globally for tests
jest.mock("vscode", () => mockVscode, { virtual: true });

// Silence console.log in tests (optional - comment out for debugging)
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error visible
  error: console.error,
};

// Export for use in tests
module.exports = { vscode: mockVscode };
