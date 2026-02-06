import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
    coverageDirectory: 'coverage',
    coveragePathIgnorePatterns: ['/node_modules/', '/lib/', '/dist/'],
    environment: 'node',
    include: ['__test__/**/*.test.ts'],
    exclude: ['node_modules/', 'lib/', 'dist/'],
    reporters: ['verbose'],
    globals: true
  }
})
