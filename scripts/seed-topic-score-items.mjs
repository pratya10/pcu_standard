// Seeds the per-topic checklist items (topic_score_items) used by the
// itemized checklist UI. Run AFTER seed-standard.mjs and AFTER migration
// 0009_topic_checklists_and_evidence.sql has been applied.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-topic-score-items.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const supabase = createClient(url, key)

const dataPath = join(__dirname, '..', 'supabase', 'seed', 'topic-score-items.json')
const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

async function main() {
  for (const [topicCode, byLevel] of Object.entries(data)) {
    const { data: topicRow, error: topicErr } = await supabase
      .from('topics')
      .select('id')
      .eq('code', topicCode)
      .single()
    if (topicErr || !topicRow) {
      console.warn('  skip (topic not found):', topicCode, topicErr?.message)
      continue
    }

    await supabase.from('topic_score_items').delete().eq('topic_id', topicRow.id)

    const rows = []
    for (const [scoreLevel, items] of Object.entries(byLevel)) {
      items.forEach((item_text, i) => {
        rows.push({
          topic_id: topicRow.id,
          score_level: Number(scoreLevel),
          item_text,
          sort_order: i,
        })
      })
    }
    if (rows.length) {
      const { error: insErr } = await supabase.from('topic_score_items').insert(rows)
      if (insErr) throw insErr
    }
    console.log('topic', topicCode, '->', rows.length, 'checklist items')
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
