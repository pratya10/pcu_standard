// Seeds (or updates) the PCU standard structure into Supabase.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-standard.mjs
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

const dataPath = join(__dirname, '..', 'supabase', 'seed', 'standard-2571-2573.json')
const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

async function main() {
  const { standard_version, categories } = data

  const { data: sv, error: svErr } = await supabase
    .from('standard_versions')
    .upsert(standard_version, { onConflict: 'code' })
    .select()
    .single()
  if (svErr) throw svErr
  console.log('standard_version:', sv.id, sv.name)

  for (const cat of categories) {
    const { data: catRow, error: catErr } = await supabase
      .from('categories')
      .upsert(
        {
          standard_version_id: sv.id,
          code: cat.code,
          name_th: cat.name_th,
          description: cat.description ?? null,
          sort_order: cat.sort_order ?? 0,
        },
        { onConflict: 'standard_version_id,code' },
      )
      .select()
      .single()
    if (catErr) throw catErr
    console.log(' category', catRow.code, catRow.name_th)

    // Bare topics directly under the category (no group), e.g. หมวด 1 and หมวด 3
    for (const topic of cat.topics ?? []) {
      await upsertTopic(catRow.id, null, topic)
    }

    // Grouped topics (หมวด 2: 2.1 / 2.2 / 2.3 / 2.4)
    for (const group of cat.groups ?? []) {
      const { data: groupRow, error: groupErr } = await supabase
        .from('topic_groups')
        .upsert(
          {
            category_id: catRow.id,
            code: group.code,
            name_th: group.name_th,
            description: group.description ?? null,
            sort_order: group.sort_order ?? 0,
          },
          { onConflict: 'category_id,code' },
        )
        .select()
        .single()
      if (groupErr) throw groupErr
      console.log('   group', groupRow.code, groupRow.name_th)

      for (const topic of group.topics ?? []) {
        await upsertTopic(catRow.id, groupRow.id, topic)
      }
    }
  }

  console.log('Done.')
}

async function upsertTopic(categoryId, groupId, topic) {
  const { data: topicRow, error: topicErr } = await supabase
    .from('topics')
    .upsert(
      {
        category_id: categoryId,
        topic_group_id: groupId,
        code: topic.code,
        name_th: topic.name_th,
        intent_text: topic.intent_text ?? null,
        must_text: topic.must_text ?? null,
        score0_text: topic.score0_text ?? null,
        score1_text: topic.score1_text ?? null,
        score2_text: topic.score2_text ?? null,
        content_text: topic.content_text ?? null,
        s3_breakdown: topic.s3_breakdown ?? null,
        is_optional: topic.is_optional ?? false,
        allow_na: topic.allow_na ?? false,
      },
      { onConflict: 'category_id,code' },
    )
    .select()
    .single()
  if (topicErr) throw topicErr
  console.log('     topic', topicRow.code, topicRow.name_th)

  // Replace evidence items for this topic
  await supabase.from('topic_evidence_items').delete().eq('topic_id', topicRow.id)
  const items = (topic.evidence ?? []).map((label, i) => ({
    topic_id: topicRow.id,
    label,
    sort_order: i,
  }))
  if (items.length) {
    const { error: evErr } = await supabase.from('topic_evidence_items').insert(items)
    if (evErr) throw evErr
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
