import { useEffect, useState } from 'react'
import type { ItemNote, Score, ScoreValue, Topic, TopicEvidenceItem, TopicPhoto, TopicScoreItem } from '../types'
import { deleteTopicPhoto, getTopicPhotoUrl, listTopicPhotos, MAX_PHOTOS_PER_TOPIC, MAX_PHOTO_BYTES, uploadTopicPhoto } from '../lib/topicPhotos'
import { useConfirm } from './ConfirmProvider'

type TopicWithEvidence = Topic & { evidence: TopicEvidenceItem[]; scoreItems: TopicScoreItem[] }

export default function TopicScoreCard({
  topic,
  index,
  existing,
  readOnly,
  roundId,
  participantId,
  accentColor,
  onSave,
}: {
  topic: TopicWithEvidence
  index: number
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
  const [photosLoaded, setPhotosLoaded] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const answered = isNa || score !== null

  useEffect(() => {
    if (!open || photosLoaded) return
    listTopicPhotos(roundId, topic.id)
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setPhotosLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

  function toggleItemChecked(itemId: string) {
    const current = itemNotes[itemId] ?? { checked: false, comment: '' }
    const next = { ...itemNotes, [itemId]: { ...current, checked: !current.checked } }
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

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoError(null)
    if (photos.length >= MAX_PHOTOS_PER_TOPIC) {
      setPhotoError(`แนบได้สูงสุด ${MAX_PHOTOS_PER_TOPIC} รูปต่อหัวข้อ`)
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('ไฟล์รูปภาพต้องมีขนาดไม่เกิน 30 MB')
      return
    }
    setUploadingPhoto(true)
    try {
      const photo = await uploadTopicPhoto({ roundId, topicId: topic.id, participantId, file })
      setPhotos((prev) => [...prev, photo])
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploadingPhoto(false)
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
          <p className="text-xs font-mono text-slate-400">
            #{index} · {topic.code}
          </p>
          <p className="truncate font-medium text-slate-800">{topic.name_th}</p>
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
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <span className="font-semibold">เกณฑ์ The Must: </span>
              {topic.must_text}
            </p>
          )}
          {topic.content_text && <p className="mb-3 text-sm text-slate-500">{topic.content_text}</p>}

          <div className="mb-4 flex flex-col gap-3">
            {(['0', '1', '2'] as const).map((lvl) => {
              const items = itemsByLevel[lvl]
              return (
                <div key={lvl} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="mb-2 font-semibold text-slate-600">{lvl} คะแนน</p>
                  {items && items.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {items.map((item) => {
                        const note = itemNotes[item.id]
                        const checked = note?.checked ?? false
                        const commentOpen = openComments.has(item.id)
                        return (
                          <div key={item.id} className="rounded-md bg-slate-50 px-2 py-1.5">
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                disabled={readOnly}
                                checked={checked}
                                onChange={() => toggleItemChecked(item.id)}
                              />
                              <span className="flex-1 text-slate-700">{item.item_text}</span>
                              <button
                                type="button"
                                title="แนบรูปภาพ/คอมเมนต์"
                                onClick={() => toggleCommentBox(item.id)}
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs ${
                                  commentOpen || note?.comment ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                                }`}
                              >
                                💬
                              </button>
                            </div>
                            {commentOpen && (
                              <textarea
                                disabled={readOnly}
                                value={note?.comment ?? ''}
                                onChange={(e) => updateItemComment(item.id, e.target.value)}
                                onBlur={() => commitItemComment()}
                                rows={2}
                                placeholder="สิ่งที่กรรมการพบ / ข้อสังเกตเพิ่มเติม..."
                                className="mt-1.5 w-full rounded-md border border-slate-300 p-1.5 text-xs"
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="whitespace-pre-line text-slate-600">{scoreDescriptions[lvl] || '—'}</p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-600">
                รูปภาพประกอบ ({photos.length}/{MAX_PHOTOS_PER_TOPIC})
              </p>
              {!readOnly && photos.length < MAX_PHOTOS_PER_TOPIC && (
                <label className="cursor-pointer rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                  {uploadingPhoto ? 'กำลังอัปโหลด...' : '+ แนบรูป'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={handlePhotoChange} />
                </label>
              )}
            </div>
            {photoError && <p className="mb-2 text-xs text-red-600">{photoError}</p>}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((p) => (
                  <div key={p.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                    <img src={getTopicPhotoUrl(p.file_path)} alt={p.file_name ?? ''} className="h-full w-full object-cover" />
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(p)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1.5 text-xs text-white"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-400">ไฟล์ละไม่เกิน 30 MB · สูงสุด {MAX_PHOTOS_PER_TOPIC} รูปต่อหัวข้อ (ใช้ร่วมกันทั้งคณะกรรมการ)</p>
          </div>

          {topic.evidence.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-sm font-semibold text-slate-600">หลักฐานประกอบการประเมิน</p>
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
            </div>
          )}

          {topic.must_text && (
            <div className="mb-4">
              <p className="mb-1 text-sm font-semibold text-slate-600">ผลการประเมิน The Must</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setMustPass(true)
                    save({ mustPass: true })
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${mustPass === true ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500'}`}
                >
                  ผ่าน
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setMustPass(false)
                    save({ mustPass: false })
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${mustPass === false ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-300 text-slate-500'}`}
                >
                  ไม่ผ่าน
                </button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <p className="mb-1 text-sm font-semibold text-slate-600">คะแนน Continuous Improvement</p>
            <div className={`grid gap-2 ${topic.allow_na ? 'grid-cols-4' : 'grid-cols-3'}`}>
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
                  className={`rounded-lg border py-2 text-sm font-semibold ${!isNa && score === v ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 text-slate-600'}`}
                >
                  {v}
                </button>
              ))}
              {topic.allow_na && (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setIsNa(true)
                    setScore(null)
                    save({ isNa: true, score: null })
                  }}
                  className={`rounded-lg border py-2 text-sm font-semibold ${isNa ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-300 text-slate-600'}`}
                >
                  N/A
                </button>
              )}
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

function groupItemsByLevel(items: TopicScoreItem[]): Record<'0' | '1' | '2', TopicScoreItem[]> {
  const grouped: Record<'0' | '1' | '2', TopicScoreItem[]> = { '0': [], '1': [], '2': [] }
  for (const item of items) {
    grouped[String(item.score_level) as '0' | '1' | '2'].push(item)
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
  if (!answered) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">ยังไม่ประเมิน</span>
  if (isNa) return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">N/A</span>
  const color = score === 2 ? 'bg-emerald-100 text-emerald-700' : score === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{score} คะแนน</span>
}
