import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

function gitShortHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  base: '/pcustandard71/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __GIT_HASH__: JSON.stringify(gitShortHash()),
  },
  build: {
    // Cloudflare Workers assets resolve a request's full path (including the
    // route prefix) against files inside `assets.directory` in
    // wrangler.jsonc, so the built files must actually live under a
    // `pcustandard71/` folder for the `mshprimary.com/pcustandard71*` route
    // to find them.
    outDir: 'dist/pcustandard71',
  },
  plugins: [react(), tailwindcss()],
})
