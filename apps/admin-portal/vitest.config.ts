// vitest.config.ts — admin-portal
// pnpm workspace隔离：admin-portal 不直接装 vitest，alias 到 tests/node_modules/vitest
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..', '..')
const testsNodeModules = path.join(root, 'tests', 'node_modules')

/** @type {import('vitest/config').defineConfig.UserConfig} */
const config = {
 resolve: {
 alias: [
 { find: /^vitest$/, replacement: path.join(testsNodeModules, 'vitest') },
 { find: /^@\/tests\/setup/, replacement: path.resolve(root, 'tests', 'setup') },
 { find: /^@fixtures$/, replacement: path.resolve(root, 'tests', 'fixtures') },
 { find: /^@/, replacement: path.resolve(__dirname, 'src') },
 ],
 },
 test: {
 environment: 'happy-dom',
 include: ['src/__tests__/**/*.test.ts'],
 globals: false,
 root: __dirname,
 reporters: ['basic'],
 setupFiles: [path.resolve(root, 'tests', 'setup', 'global-setup.ts')],
 },
}

export default config
