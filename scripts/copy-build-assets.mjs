import { copyFileSync } from 'node:fs'
for (const file of ['index.html', '_headers']) {
  copyFileSync(`dist/pcustandard71/${file}`, `dist/${file}`)
}
