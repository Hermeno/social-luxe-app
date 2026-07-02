module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 20000,
  setupFilesAfterFramework: [],
  moduleNameMapper: {
    '^expo-server-sdk$': '<rootDir>/tests/__mocks__/expo-server-sdk.js',
  },
  globals: {
    'ts-jest': { tsconfig: { strict: false } }
  }
}
