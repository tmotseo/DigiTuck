import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['tests/integration/**/*.test.ts'], environment: 'node', fileParallelism: false, hookTimeout: 60000, testTimeout: 30000 } })

