module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['nodes/**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)', 'nodes/**/*TestNode.node.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
