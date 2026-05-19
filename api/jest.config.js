module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  setupFilesAfterFramework: [],
  globals: {
    'ts-jest': { tsconfig: { strict: false } }
  }
}
