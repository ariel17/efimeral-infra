module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  setupFiles: ['<rootDir>/.jest/setEnvVars.js'],
    moduleNameMapper: {
    '/opt/nodejs/running-tasks': '<rootDir>/lambdas/layers/running-tasks/nodejs/running-tasks',
  },
};
