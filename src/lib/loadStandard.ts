import { supabase } from './supabaseClient'
import type { Category, FullStandard, StandardVersion, Topic, TopicEvidenceItem, TopicGroup, TopicScoreItem } from '../types'

export async function loadLatestStandard(): Promise<FullStandard> {
  const { data: versions, error: vErr } = await supabase
    .from('standard_versions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
  if (vErr) throw vErr
  const standardVersion = versions?.[0] as StandardVersion | undefined
  if (!standardVersion) throw new Error('ยังไม่มีมาตรฐานในระบบ กรุณารัน seed script ก่อน')

  return loadStandardByVersionId(standardVersion.id)
}

export async function loadStandardByVersionId(standardVersionId: string): Promise<FullStandard> {
  const [{ data: versionRow, error: vErr }, { data: cats, error: cErr }, { data: groups, error: gErr }, { data: topics, error: tErr }] =
    await Promise.all([
      supabase.from('standard_versions').select('*').eq('id', standardVersionId).single(),
      supabase.from('categories').select('*').eq('standard_version_id', standardVersionId).order('sort_order'),
      supabase.from('topic_groups').select('*'),
      supabase.from('topics').select('*').order('sort_order'),
    ])
  if (vErr) throw vErr
  if (cErr) throw cErr
  if (gErr) throw gErr
  if (tErr) throw tErr

  const catIds = new Set((cats as Category[]).map((c) => c.id))
  const groupsInScope = (groups as TopicGroup[]).filter((g) => catIds.has(g.category_id))
  const topicsInScope = (topics as Topic[]).filter((t) => catIds.has(t.category_id))

  const topicIds = topicsInScope.map((t) => t.id)
  const safeTopicIds = topicIds.length ? topicIds : ['00000000-0000-0000-0000-000000000000']
  const [{ data: evidence, error: eErr }, { data: scoreItems, error: siErr }] = await Promise.all([
    supabase.from('topic_evidence_items').select('*').in('topic_id', safeTopicIds).order('sort_order'),
    supabase.from('topic_score_items').select('*').in('topic_id', safeTopicIds).order('score_level').order('sort_order'),
  ])
  if (eErr) throw eErr
  if (siErr) throw siErr

  const evidenceByTopic = new Map<string, TopicEvidenceItem[]>()
  for (const item of evidence as TopicEvidenceItem[]) {
    const list = evidenceByTopic.get(item.topic_id) ?? []
    list.push(item)
    evidenceByTopic.set(item.topic_id, list)
  }

  const scoreItemsByTopic = new Map<string, TopicScoreItem[]>()
  for (const item of (scoreItems ?? []) as TopicScoreItem[]) {
    const list = scoreItemsByTopic.get(item.topic_id) ?? []
    list.push(item)
    scoreItemsByTopic.set(item.topic_id, list)
  }

  const withEvidence = (t: Topic) => ({
    ...t,
    evidence: evidenceByTopic.get(t.id) ?? [],
    scoreItems: scoreItemsByTopic.get(t.id) ?? [],
  })

  const categories = (cats as Category[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cat) => {
      const groupsForCat = groupsInScope
        .filter((g) => g.category_id === cat.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((g) => ({
          ...g,
          topics: topicsInScope
            .filter((t) => t.topic_group_id === g.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(withEvidence),
        }))
      const bareTopics = topicsInScope
        .filter((t) => t.category_id === cat.id && !t.topic_group_id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(withEvidence)
      return { ...cat, groups: groupsForCat, topics: bareTopics }
    })

  return { standardVersion: versionRow as StandardVersion, categories }
}

export function allTopicsFlat(standard: FullStandard) {
  const list: (Topic & {
    evidence: TopicEvidenceItem[]
    scoreItems: TopicScoreItem[]
    categoryCode: string
    categoryName: string
    groupName?: string
  })[] = []
  for (const cat of standard.categories) {
    for (const t of cat.topics) list.push({ ...t, categoryCode: cat.code, categoryName: cat.name_th })
    for (const g of cat.groups) {
      for (const t of g.topics) list.push({ ...t, categoryCode: cat.code, categoryName: cat.name_th, groupName: g.name_th })
    }
  }
  return list
}
