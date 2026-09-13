// One-off helper: creates the `branding` storage bucket if needed and
// uploads a logo file to the well-known path `logo`.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-logo.mjs /path/to/logo.png
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const filePath = process.argv[2]

if (!url || !key || !filePath) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-logo.mjs <path-to-image>')
  process.exit(1)
}

const supabase = createClient(url, key)

const ext = filePath.split('.').pop()?.toLowerCase()
const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png'

async function main() {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.id === 'branding')) {
    const { error } = await supabase.storage.createBucket('branding', { public: true })
    if (error) throw error
    console.log('Created bucket: branding')
  }

  const file = readFileSync(filePath)
  const { error } = await supabase.storage.from('branding').upload('logo', file, {
    contentType,
    upsert: true,
  })
  if (error) throw error

  const { data: pub } = supabase.storage.from('branding').getPublicUrl('logo')
  console.log('Uploaded. Public URL:', pub.publicUrl)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
