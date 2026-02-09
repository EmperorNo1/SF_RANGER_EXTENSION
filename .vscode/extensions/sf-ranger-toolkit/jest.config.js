/**
 * Jest configuration for SF Ranger Toolkit
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: [
    'src/utils/**/*.js',
    'src/handlers/**/*.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  verbose: true,
  testTimeout: 10000,
};

