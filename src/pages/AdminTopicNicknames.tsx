import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Category, Topic, TopicGroup } from '../types'
import AdminLayout from '../components/AdminLayout'

type TopicRow = Topic & { categoryLabel: string; groupLabel: string | null }

export default function AdminTopicNicknames() {
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: topicsData }, { data: categoriesData }, { data: groupsData }] = await Promise.all([
        supabase.from('topics').select('*').order('sort_order'),
        supabase.from('categories').select('*'),
        supabase.from('topic_groups').select('*'),
      ])
      const catById = new Map(((categoriesData as Category[]) ?? []).map((c) => [c.id, c]))
      const groupById = new Map(((groupsData as TopicGroup[]) ?? []).map((g) => [g.id, g]))
      const rows: TopicRow[] = ((topicsData as Topic[]) ?? []).map((t) => ({
        ...t,
        categoryLabel: catById.get(t.category_id)?.name_th ?? '-',
        groupLabel: t.topic_group_id ? (groupById.get(t.topic_group_id)?.name_th ?? null) : null,
      }))
      setTopics(rows)
      setDrafts(Object.fromEntries(rows.map((t) => [t.id, t.short_name ?? ''])))
      setLoading(false)
    }
    load()
  }, [])

  async function save(topicId: string) {
    setSavingId(topicId)
    const value = drafts[topicId]?.trim() || null
    const { error } = await supabase.from('topics').update({ short_name: value }).eq('id', topicId)
    setSavingId(null)
    if (error) {
      alert('บันทึกไม่สำเร็จ: ' + error.message)
      return
    }
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, short_name: value } : t)))
  }

  return (
    <AdminLayout title="ชื่อเล่นหัวข้อ" maxWidth="max-w-4xl xl:max-w-5xl">
      <p className="mb-4 text-sm text-slate-500">
        ตั้งชื่อเล่นสั้นๆ ให้แต่ละหัวข้อ เพื่อแสดงในเมนูด้านข้างของหน้ากรอกคะแนนแทนรหัสหัวข้อเปล่าๆ — พิมพ์แล้วคลิกออกจากช่องเพื่อบันทึกอัตโนมัติ
      </p>
      {loading ? (
        <p className="text-slate-400">กำลังโหลด...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {topics.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-sm last:border-0">
              <div className="w-36 shrink-0">
                <p className="font-mono text-xs text-slate-400">{t.code}</p>
                <p className="truncate text-xs text-slate-400">{t.groupLabel ?? t.categoryLabel}</p>
              </div>
              <p className="min-w-0 flex-1 truncate text-slate-700">{t.name_th}</p>
              <input
                value={drafts[t.id] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                onBlur={() => {
                  if ((drafts[t.id] ?? '') !== (t.short_name ?? '')) save(t.id)
                }}
                placeholder="ชื่อเล่น"
                className="w-40 shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <span className="w-16 shrink-0 text-xs text-slate-400">{savingId === t.id ? 'กำลังบันทึก...' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
