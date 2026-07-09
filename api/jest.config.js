module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 20000,
  setupFiles: ['<rootDir>/tests/jest.setup.ts'],
  setupFilesAfterFramework: [],
  moduleNameMapper: {
    '^expo-server-sdk$': '<rootDir>/tests/__mocks__/expo-server-sdk.js',
  },
  globals: {
    'ts-jest': { tsconfig: { strict: false } }
  }
}
