import { useEffect, useState } from 'react'
import type { ItemNote, Score, ScoreValue, Topic, TopicEvidenceItem, TopicPhoto, TopicScoreItem } from '../types'
import {
  deleteTopicPhoto,
  getTopicPhotoUrl,
  groupPhotosByItem,
  listTopicPhotos,
  MAX_PHOTOS_PER_ITEM,
  MAX_PHOTO_BYTES,
  uploadTopicPhoto,
} from '../lib/topicPhotos'
import { useConfirm } from './ConfirmProvider'
import Icon from './Icon'

type TopicWithEvidence = Topic & { evidence: TopicEvidenceItem[]; scoreItems: TopicScoreItem[] }
type LevelKey = '-2' | '-1' | '0' | '1' | '2'

const SCORE_COLOR: Record<ScoreValue, string> = {
  0: 'border-amber-500 bg-amber-400 text-white',
  1: 'border-orange-600 bg-orange-500 text-white',
  2: 'border-emerald-600 bg-emerald-500 text-white',
}

export default function TopicScoreCard({
  topic,
  existing,
  readOnly,
  roundId,
  participantId,
  accentColor,
  onSave,
}: {
  topic: TopicWithEvidence
  existing?: Score
  readOnly: boolean
  roundId: string
  participantId: string | null
  accentColor?: string
  onSave: (draft: {
    score: ScoreValue | null
    isNa: boolean
    mustPass: boolean | null
    comment: string
    evidenceChecked: string[]
    itemNotes: Record<string, ItemNote>
  }) => Promise<void>
}) {
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [score, setScore] = useState<ScoreValue | null>(existing?.score ?? null)
  const [isNa, setIsNa] = useState(existing?.is_na ?? false)
  const [mustPass, setMustPass] = useState<boolean | null>(existing?.must_pass ?? null)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [evidenceChecked, setEvidenceChecked] = useState<string[]>(existing?.evidence_checked ?? [])
  const [itemNotes, setItemNotes] = useState<Record<string, ItemNote>>(existing?.item_notes ?? {})
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const [photos, setPhotos] = useState<TopicPhoto[]>([])
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const answered = isNa || score !== null
  const commentCount = Object.values(itemNotes).filter((n) => n.comment?.trim()).length
  const photosByItem = groupPhotosByItem(photos)
  const photoCount = photos.length

  useEffect(() => {
    listTopicPhotos(roundId, topic.id)
      .then(setPhotos)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, topic.id])

  async function save(
    next: Partial<{
      score: ScoreValue | null
      isNa: boolean
      mustPass: boolean | null
      comment: string
      evidenceChecked: string[]
      itemNotes: Record<string, ItemNote>
    }>,
  ) {
    if (readOnly) return
    const merged = {
      score: next.score !== undefined ? next.score : score,
      isNa: next.isNa !== undefined ? next.isNa : isNa,
      mustPass: next.mustPass !== undefined ? next.mustPass : mustPass,
      comment: next.comment !== undefined ? next.comment : comment,
      evidenceChecked: next.evidenceChecked !== undefined ? next.evidenceChecked : evidenceChecked,
      itemNotes: next.itemNotes !== undefined ? next.itemNotes : itemNotes,
    }
    setSaving(true)
    try {
      await onSave(merged)
    } finally {
      setSaving(false)
    }
  }

  function toggleEvidence(label: string) {
    const next = evidenceChecked.includes(label) ? evidenceChecked.filter((l) => l !== label) : [...evidenceChecked, label]
    setEvidenceChecked(next)
    save({ evidenceChecked: next })
  }

  function setItemChecked(itemId: string, checked: boolean) {
    const current = itemNotes[itemId] ?? { checked: false, comment: '' }
    const next = { ...itemNotes, [itemId]: { ...current, checked } }
    setItemNotes(next)
    save({ itemNotes: next })
  }

  function updateItemComment(itemId: string, text: string) {
    const current = itemNotes[itemId] ?? { checked: false, comment: '' }
    const next = { ...itemNotes, [itemId]: { ...current, comment: text } }
    setItemNotes(next)
  }

  function commitItemComment() {
    save({ itemNotes })
  }

  function toggleCommentBox(itemId: string) {
    setOpenComments((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  async function handlePhotoChange(itemId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoError(null)
    const currentCount = photosByItem.get(itemId)?.length ?? 0
    if (currentCount >= MAX_PHOTOS_PER_ITEM) {
      setPhotoError(`แนบได้สูงสุด ${MAX_PHOTOS_PER_ITEM} รูปต่อข้อย่อย`)
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 30 MB')
      return
    }
    setUploadingItemId(itemId)
    try {
      const photo = await uploadTopicPhoto({ roundId, topicId: topic.id, itemId, participantId, file })
      setPhotos((prev) => [...prev, photo])
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploadingItemId(null)
    }
  }

  async function handleDeletePhoto(photo: TopicPhoto) {
    const ok = await confirm({ title: 'ลบรูปภาพ', message: 'ลบรูปภาพนี้ออกจากหลักฐานการประเมิน?', confirmLabel: 'ลบ' })
    if (!ok) return
    await deleteTopicPhoto(photo)
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
  }

  const scoreDescriptions = getScoreDescriptions(topic)
  const itemsByLevel = groupItemsByLevel(topic.scoreItems)

  function renderChecklist(items: TopicScoreItem[]) {
    return (
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const note = itemNotes[item.id]
          const checked = note?.checked ?? false
          const commentOpen = openComments.has(item.id)
          const itemPhotos = photosByItem.get(item.id) ?? []
          const hasNote = !!note?.comment || itemPhotos.length > 0
          return (
            <div key={item.id} className="rounded-md bg-slate-50 px-2 py-2">
              <div className="flex items-center gap-2">
                <ToggleSwitch checked={checked} disabled={readOnly} onChange={(v) => setItemChecked(item.id, v)} />
                <span className="flex-1 text-slate-700">{item.item_text}</span>
                <button
                  type="button"
                  title="แนบรูปภาพ/คอมเมนต์"
                  onClick={() => toggleCommentBox(item.id)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                    commentOpen || hasNote ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Icon name="add_comment" className="!text-sm" />
                  {note?.comment ? '1' : ''}
                  <Icon name="add_a_photo" className="!text-sm" />
                  {itemPhotos.length > 0 ? itemPhotos.length : ''}
                </button>
              </div>
              {commentOpen && (
                <div className="mt-1.5 pl-9">
                  <textarea
                    disabled={readOnly}
                    value={note?.comment ?? ''}
                    onChange={(e) => updateItemComment(item.id, e.target.value)}
                    onBlur={() => commitItemComment()}
                    rows={2}
                    placeholder="สิ่งที่กรรมการพบ / ข้อสังเกตเพิ่มเติม..."
                    className="w-full rounded-md border border-slate-300 p-1.5 text-xs"
                  />
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {itemPhotos.map((p) => (
                      <div key={p.id} className="group relative h-14 w-14 overflow-hidden rounded-md border border-slate-200">
                        <img src={getTopicPhotoUrl(p.file_path)} alt={p.file_name ?? ''} className="h-full w-full object-cover" />
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(p)}
                            className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-[10px] text-white"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {!readOnly && itemPhotos.length < MAX_PHOTOS_PER_ITEM && (
                      <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">
                        {uploadingItemId === item.id ? '...' : '+ รูป'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingItemId === item.id}
                          onChange={(e) => handlePhotoChange(item.id, e)}
                        />
                      </label>
                    )}
                  </div>
                  {photoError && <p className="mt-1 text-[10px] text-red-600">{photoError}</p>}
                  <p className="mt-1 text-[10px] text-slate-400">ไฟล์ละไม่เกิน 30 MB · สูงสุด {MAX_PHOTOS_PER_ITEM} รูปต่อข้อย่อย</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
      style={accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : undefined}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-xs font-mono text-slate-400">{topic.code}</p>
          <p className="truncate font-medium text-slate-800">{topic.name_th}</p>
          {(commentCount > 0 || photoCount > 0) && (
            <div className="mt-1 flex gap-2">
              {commentCount > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  <Icon name="add_comment" className="!text-sm" /> {commentCount} คอมเมนต์
                </span>
              )}
              {photoCount > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                  <Icon name="add_a_photo" className="!text-sm" /> {photoCount} รูป
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge answered={answered} isNa={isNa} score={score} />
          <span className="text-slate-300">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4">
          {topic.intent_text && (
            <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <span className="font-semibold">เจตจำนงการประเมิน: </span>
              {topic.intent_text}
            </p>
          )}

          {topic.must_text && (
            <div className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
              <p className="mb-2 text-base font-bold text-amber-900">⚠ เกณฑ์มาตรฐานพื้นฐาน (The Must | ต้องมี)</p>
              {itemsByLevel['-1'].length > 0 ? (
                renderChecklist(itemsByLevel['-1'])
              ) : (
                <p className="text-sm font-semibold text-amber-900">{topic.must_text}</p>
              )}
            </div>
          )}

          {topic.content_text && <p className="mb-3 text-sm text-slate-500">{topic.content_text}</p>}

          <div className="mb-4 flex flex-col gap-3">
            {(['0', '1', '2'] as const).map((lvl) => {
              const items = itemsByLevel[lvl]
              return (
                <div key={lvl} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="mb-2 font-semibold text-slate-600">{lvl} คะแนน</p>
                  {items.length > 0 ? renderChecklist(items) : <p className="whitespace-pre-line text-slate-600">{scoreDescriptions[lvl] || '—'}</p>}
                </div>
              )
            })}
          </div>

          {(itemsByLevel['-2'].length > 0 || topic.evidence.length > 0) && (
            <div className="mb-4">
              <p className="mb-1 text-sm font-semibold text-slate-600">หลักฐานประกอบการประเมิน</p>
              {itemsByLevel['-2'].length > 0 ? (
                renderChecklist(itemsByLevel['-2'])
              ) : (
                <div className="flex flex-col gap-1">
                  {topic.evidence.map((ev) => (
                    <label key={ev.id} className="flex items-start gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        disabled={readOnly}
                        checked={evidenceChecked.includes(ev.label)}
                        onChange={() => toggleEvidence(ev.label)}
                      />
                      <span>{ev.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {topic.must_text && (
            <div className="mb-4">
              <p className="mb-1 text-base font-bold text-slate-800">ผลการประเมิน The Must</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setMustPass(false)
                    save({ mustPass: false })
                  }}
                  className={`flex-1 rounded-2xl border-2 py-3 text-base font-bold ${mustPass === false ? 'border-red-600 bg-red-500 text-white' : 'border-slate-300 text-slate-500'}`}
                >
                  ✗ ไม่ผ่าน
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setMustPass(true)
                    save({ mustPass: true })
                  }}
                  className={`flex-1 rounded-2xl border-2 py-3 text-base font-bold ${mustPass === true ? 'border-emerald-600 bg-emerald-500 text-white' : 'border-slate-300 text-slate-500'}`}
                >
                  ✓ ผ่าน
                </button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <p className="mb-1 text-base font-bold text-slate-800">คะแนน Continuous Improvement</p>
            <div className="grid grid-cols-4 gap-2">
              {([0, 1, 2] as ScoreValue[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setScore(v)
                    setIsNa(false)
                    save({ score: v, isNa: false })
                  }}
                  className={`rounded-2xl border-2 py-3 text-lg font-bold ${!isNa && score === v ? SCORE_COLOR[v] : 'border-slate-300 text-slate-500'}`}
                >
                  {v}
                </button>
              ))}
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setIsNa(true)
                  setScore(null)
                  save({ isNa: true, score: null })
                }}
                className={`rounded-2xl border-2 py-3 text-lg font-bold ${isNa ? 'border-sky-600 bg-sky-500 text-white' : 'border-slate-300 text-slate-500'}`}
              >
                N/A
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-slate-600">เหตุผล / บันทึกเพิ่มเติม</p>
            <textarea
              disabled={readOnly}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => save({ comment })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="ระบุเหตุผลประกอบการให้คะแนน..."
            />
          </div>

          {saving && <p className="mt-2 text-xs text-slate-400">กำลังบันทึก...</p>}
        </div>
      )}
    </div>
  )
}

function ToggleSwitch({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold text-white transition-colors ${
        checked ? 'bg-emerald-500' : 'bg-red-400'
      } disabled:opacity-60`}
    >
      {checked ? 'ใช่' : 'ไม่'}
    </button>
  )
}

function groupItemsByLevel(items: TopicScoreItem[]): Record<LevelKey, TopicScoreItem[]> {
  const grouped: Record<LevelKey, TopicScoreItem[]> = { '-2': [], '-1': [], '0': [], '1': [], '2': [] }
  for (const item of items) {
    grouped[String(item.score_level) as LevelKey].push(item)
  }
  return grouped
}

function getScoreDescriptions(topic: TopicWithEvidence): Record<'0' | '1' | '2', string> {
  if (topic.s3_breakdown) {
    const { staff, system, structure } = topic.s3_breakdown
    const build = (lvl: '0' | '1' | '2') =>
      [staff?.[lvl] && `Staff: ${staff[lvl]}`, system?.[lvl] && `System: ${system[lvl]}`, structure?.[lvl] && `Structure: ${structure[lvl]}`]
        .filter(Boolean)
        .join('\n')
    return { '0': build('0'), '1': build('1'), '2': build('2') }
  }
  return { '0': topic.score0_text ?? '', '1': topic.score1_text ?? '', '2': topic.score2_text ?? '' }
}

function StatusBadge({ answered, isNa, score }: { answered: boolean; isNa: boolean; score: ScoreValue | null }) {
  if (!answered) return null
  if (isNa) return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">N/A</span>
  const color = score === 2 ? 'bg-emerald-100 text-emerald-700' : score === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{score} คะแนน</span>
}
