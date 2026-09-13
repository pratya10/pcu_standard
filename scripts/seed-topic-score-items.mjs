// Seeds the per-topic checklist items (topic_score_items) used by the
// itemized checklist UI: Must criteria (-1), evidence (-2, pulled from the
// standard's `evidence` arrays), and Continuous Improvement criteria (0-2).
// Run AFTER seed-standard.mjs and AFTER migrations 0009-0011 have been applied.
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

const itemsPath = join(__dirname, '..', 'supabase', 'seed', 'topic-score-items.json')
const standardPath = join(__dirname, '..', 'supabase', 'seed', 'standard-2571-2573.json')
const itemsData = JSON.parse(readFileSync(itemsPath, 'utf-8'))
const standardData = JSON.parse(readFileSync(standardPath, 'utf-8'))

// Merge in each topic's `evidence` array as score_level -2 checklist items.
const byCode = { ...itemsData }
function collectEvidence(topics) {
  for (const t of topics ?? []) {
    const evidence = t.evidence ?? []
    if (evidence.length === 0) continue
    byCode[t.code] = { ...(byCode[t.code] ?? {}), '-2': evidence }
  }
}
for (const cat of standardData.categories) {
  collectEvidence(cat.topics)
  for (const g of cat.groups ?? []) collectEvidence(g.topics)
}

async function main() {
  for (const [topicCode, byLevel] of Object.entries(byCode)) {
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
