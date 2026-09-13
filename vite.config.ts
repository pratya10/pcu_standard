import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/pcustandard71/',
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
