import { defineConfig } from 'vitest/config'
import path from 'path'

// Node environment only — these tests exercise route handlers and guards, not
// components. Matches client-newsroom's setup (no jsdom, no .tsx tests).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
