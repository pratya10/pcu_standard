import { useEffect, useState } from 'react'
import type { ScoreValue, TeamComment, TeamItemNote, TeamScore, Topic, TopicEvidenceItem, TopicPhoto, TopicScoreItem } from '../types'
import {
  deleteTopicPhoto,
  getTopicPhotoUrl,
  groupPhotosByItem,
  listTopicPhotos,
  MAX_PHOTOS_PER_ITEM,
  MAX_PHOTO_BYTES,
  uploadTopicPhoto,
} from '../lib/topicPhotos'
import { logTeamScoreOverwrite, parseTeamComments, serializeTeamComments, upsertTeamScore, type TeamScoreDraft } from '../lib/teamScoresApi'
import { useConfirm } from './ConfirmProvider'
import Icon from './Icon'

type TopicWithEvidence = Topic & { evidence: TopicEvidenceItem[]; scoreItems: TopicScoreItem[] }
type LevelKey = '-2' | '-1' | '0' | '1' | '2'

const SCORE_COLOR: Record<ScoreValue, string> = {
  0: 'border-amber-500 bg-amber-400 text-white',
  1: 'border-orange-600 bg-orange-500 text-white',
  2: 'border-emerald-600 bg-emerald-500 text-white',
}

function formatEntryTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// A note's comments live in the new structured `comments` array going
// forward; `comment` (plain string) only lingers on rows saved before this
// feature existed, so it's read as a single legacy, non-editable entry.
function getNoteComments(note: TeamItemNote | undefined): TeamComment[] {
  if (!note) return []
  return note.comments && note.comments.length > 0 ? note.comments : parseTeamComments(note.comment)
}

export default function TeamTopicScoreCard({
  topic,
  teamScore,
  readOnly,
  roundId,
  participantId,
  participantName,
  participantNameById,
  accentColor,
  isAdmin,
  onSaved,
}: {
  topic: TopicWithEvidence
  teamScore?: TeamScore
  readOnly: boolean
  roundId: string
  participantId: string
  participantName: string
  participantNameById: Map<string, string>
  accentColor?: string
  isAdmin?: boolean
  onSaved: (updated: TeamScore) => void
}) {
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const [editingItemCommentId, setEditingItemCommentId] = useState<Record<string, string | null>>({})
  const [newTopicComment, setNewTopicComment] = useState('')
  const [editingTopicCommentId, setEditingTopicCommentId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [photos, setPhotos] = useState<TopicPhoto[]>([])
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const score = teamScore?.score ?? null
  const isNa = teamScore?.is_na ?? false
  const mustPass = teamScore?.must_pass ?? null
  const comment = teamScore?.comment ?? ''
  const topicComments = parseTeamComments(comment)
  const itemNotes = teamScore?.item_notes ?? {}
  const answered = isNa || score !== null
  const commentCount = Object.values(itemNotes).filter((n) => getNoteComments(n).length > 0).length
  const photosByItem = groupPhotosByItem(photos)
  const photoCount = photos.length

  useEffect(() => {
    listTopicPhotos(roundId, topic.id)
      .then(setPhotos)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, topic.id])

  function editorName(id: string | null | undefined) {
    if (!id) return 'กรรมการ'
    return participantNameById.get(id) ?? 'กรรมการ'
  }

  async function persist(next: Partial<TeamScoreDraft>, attribution: { ci?: boolean; must?: boolean } = {}) {
    if (readOnly) return
    const merged: TeamScoreDraft = {
      roundId,
      topicId: topic.id,
      score: next.score !== undefined ? next.score : score,
      isNa: next.isNa !== undefined ? next.isNa : isNa,
      mustPass: next.mustPass !== undefined ? next.mustPass : mustPass,
      comment: next.comment !== undefined ? next.comment : comment,
      itemNotes: next.itemNotes !== undefined ? next.itemNotes : itemNotes,
    }
    setSaving(true)
    try {
      const saved = await upsertTeamScore(merged, participantId, attribution)
      onSaved(saved)
    } finally {
      setSaving(false)
    }
  }

  async function applyScore(v: ScoreValue) {
    if (readOnly) return
    const alreadySet = !isNa && score !== null
    if (alreadySet && score !== v) {
      const ok = await confirm({
        title: 'ยืนยันเปลี่ยนคะแนน',
        message: `หัวข้อนี้ถูกให้คะแนน ${score} ไว้แล้วโดย ${editorName(teamScore?.updated_by)}\nต้องการเปลี่ยนเป็น ${v} หรือไม่?`,
        confirmLabel: 'ยืนยันเปลี่ยน',
      })
      if (!ok) return
      await logTeamScoreOverwrite({ roundId, topicId: topic.id, field: 'score', participantId, oldValue: score, newValue: v })
    }
    await persist({ score: v, isNa: false }, { ci: true })
  }

  async function applyNa() {
    if (readOnly) return
    const alreadySet = answered
    if (alreadySet && !isNa) {
      const ok = await confirm({
        title: 'ยืนยันเปลี่ยนเป็น N/A',
        message: `หัวข้อนี้ถูกให้คะแนน ${score} ไว้แล้วโดย ${editorName(teamScore?.updated_by)}\nต้องการเปลี่ยนเป็น N/A หรือไม่?`,
        confirmLabel: 'ยืนยันเปลี่ยน',
      })
      if (!ok) return
      await logTeamScoreOverwrite({ roundId, topicId: topic.id, field: 'score', participantId, oldValue: score, newValue: 'NA' })
    }
    await persist({ isNa: true, score: null }, { ci: true })
  }

  async function applyMustPass(v: boolean) {
    if (readOnly) return
    if (mustPass !== null && mustPass !== v) {
      const ok = await confirm({
        title: 'ยืนยันเปลี่ยนผล The Must',
        message: `หัวข้อนี้ถูกระบุว่า "${mustPass ? 'ผ่าน' : 'ไม่ผ่าน'}" ไว้แล้วโดย ${editorName(teamScore?.must_pass_updated_by)}\nต้องการเปลี่ยนเป็น "${v ? 'ผ่าน' : 'ไม่ผ่าน'}" หรือไม่?`,
        confirmLabel: 'ยืนยันเปลี่ยน',
      })
      if (!ok) return
      await logTeamScoreOverwrite({ roundId, topicId: topic.id, field: 'must_pass', participantId, oldValue: mustPass, newValue: v })
    }
    await persist({ mustPass: v }, { must: true })
  }

  async function applyItemChecked(itemId: string, checked: boolean) {
    if (readOnly) return
    const current = itemNotes[itemId]
    if (current && current.checked !== checked) {
      const ok = await confirm({
        title: 'ยืนยันเปลี่ยนค่า',
        message: `ข้อนี้ถูกตั้งไว้แล้วว่า "${current.checked ? 'ใช่' : 'ไม่ใช่'}" โดย ${editorName(current.checkedBy)}\nต้องการเปลี่ยนเป็น "${checked ? 'ใช่' : 'ไม่ใช่'}" หรือไม่?`,
        confirmLabel: 'ยืนยันเปลี่ยน',
      })
      if (!ok) return
      await logTeamScoreOverwrite({
        roundId,
        topicId: topic.id,
        itemId,
        field: 'item_checked',
        participantId,
        oldValue: current.checked,
        newValue: checked,
      })
    }
    const next = {
      ...itemNotes,
      [itemId]: { checked, checkedBy: participantId, checkedAt: new Date().toISOString(), comments: getNoteComments(current) },
    }
    await persist({ itemNotes: next })
  }

  async function submitItemComment(itemId: string) {
    const text = (newComment[itemId] ?? '').trim()
    if (!text) return
    const current = itemNotes[itemId]
    const existingComments = getNoteComments(current)
    const editingId = editingItemCommentId[itemId]
    const nextComments = editingId
      ? existingComments.map((c) => (c.id === editingId ? { ...c, text } : c))
      : [...existingComments, { id: crypto.randomUUID(), authorId: participantId, author: participantName, text, createdAt: new Date().toISOString() }]
    const next = { ...itemNotes, [itemId]: { checked: current?.checked ?? false, checkedBy: current?.checkedBy, comments: nextComments } }
    setNewComment((prev) => ({ ...prev, [itemId]: '' }))
    setEditingItemCommentId((prev) => ({ ...prev, [itemId]: null }))
    await persist({ itemNotes: next })
  }

  function startEditItemComment(itemId: string, c: TeamComment) {
    setNewComment((prev) => ({ ...prev, [itemId]: c.text }))
    setEditingItemCommentId((prev) => ({ ...prev, [itemId]: c.id }))
  }

  function cancelEditItemComment(itemId: string) {
    setNewComment((prev) => ({ ...prev, [itemId]: '' }))
    setEditingItemCommentId((prev) => ({ ...prev, [itemId]: null }))
  }

  async function deleteItemComment(itemId: string, commentId: string) {
    const ok = await confirm({ title: 'ลบคอมเมนต์', message: 'ลบคอมเมนต์นี้ออก? การลบไม่สามารถย้อนกลับได้', confirmLabel: 'ลบ' })
    if (!ok) return
    const current = itemNotes[itemId]
    const nextComments = getNoteComments(current).filter((c) => c.id !== commentId)
    const next = { ...itemNotes, [itemId]: { checked: current?.checked ?? false, checkedBy: current?.checkedBy, comments: nextComments } }
    if (editingItemCommentId[itemId] === commentId) cancelEditItemComment(itemId)
    await persist({ itemNotes: next })
  }

  async function submitTopicComment() {
    const text = newTopicComment.trim()
    if (!text) return
    const nextComments = editingTopicCommentId
      ? topicComments.map((c) => (c.id === editingTopicCommentId ? { ...c, text } : c))
      : [...topicComments, { id: crypto.randomUUID(), authorId: participantId, author: participantName, text, createdAt: new Date().toISOString() }]
    setNewTopicComment('')
    setEditingTopicCommentId(null)
    await persist({ comment: serializeTeamComments(nextComments) })
  }

  function startEditTopicComment(c: TeamComment) {
    setNewTopicComment(c.text)
    setEditingTopicCommentId(c.id)
  }

  function cancelEditTopicComment() {
    setNewTopicComment('')
    setEditingTopicCommentId(null)
  }

  async function deleteTopicComment(commentId: string) {
    const ok = await confirm({ title: 'ลบคอมเมนต์', message: 'ลบคอมเมนต์นี้ออก? การลบไม่สามารถย้อนกลับได้', confirmLabel: 'ลบ' })
    if (!ok) return
    const nextComments = topicComments.filter((c) => c.id !== commentId)
    if (editingTopicCommentId === commentId) cancelEditTopicComment()
    await persist({ comment: serializeTeamComments(nextComments) })
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

  function toggleCommentBox(itemId: string) {
    setOpenComments((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
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
          const noteComments = getNoteComments(note)
          const hasNote = noteComments.length > 0 || itemPhotos.length > 0
          const editingId = editingItemCommentId[item.id]
          return (
            <div key={item.id} className="rounded-md bg-slate-50 px-2 py-2">
              <div className="flex items-center gap-2">
                <ToggleSwitch checked={checked} disabled={readOnly} onChange={(v) => applyItemChecked(item.id, v)} />
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
                  {noteComments.length > 0 ? noteComments.length : ''}
                  <Icon name="add_a_photo" className="!text-sm" />
                  {itemPhotos.length > 0 ? itemPhotos.length : ''}
                </button>
              </div>
              {note?.checkedBy && (
                <p className="mt-0.5 pl-[52px] text-[10px] text-slate-400">
                  {note.checkedAt && `${formatEntryTime(note.checkedAt)} `}
                  {editorName(note.checkedBy)}
                </p>
              )}
              {commentOpen && (
                <div className="mt-1.5 pl-9">
                  {noteComments.length > 0 && (
                    <div className="mb-1.5 flex flex-col gap-1">
                      {noteComments.map((c) => (
                        <div key={c.id} className="rounded-md bg-white p-1.5 text-xs text-slate-600">
                          <p className="whitespace-pre-line">{c.text}</p>
                          {(c.author || isAdmin) && (
                            <p className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                              <span>
                                {c.author}
                                {c.createdAt && ` · ${formatEntryTime(c.createdAt)}`}
                              </span>
                              <span className="flex shrink-0 gap-2">
                                {!readOnly && c.authorId === participantId && (
                                  <button
                                    type="button"
                                    onClick={() => startEditItemComment(item.id, c)}
                                    className="font-medium text-emerald-600 hover:underline"
                                  >
                                    แก้ไข
                                  </button>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => deleteItemComment(item.id, c.id)}
                                    className="font-medium text-red-600 hover:underline"
                                  >
                                    ลบ
                                  </button>
                                )}
                              </span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!readOnly && (
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end">
                      <textarea
                        value={newComment[item.id] ?? ''}
                        onChange={(e) => setNewComment((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            submitItemComment(item.id)
                          }
                        }}
                        rows={2}
                        placeholder="พิมพ์คอมเมนต์แล้วกด Enter (Shift+Enter ขึ้นบรรทัดใหม่)..."
                        className="w-full resize-y rounded-md border border-slate-300 p-1.5 text-xs"
                      />
                      <div className="flex shrink-0 gap-1">
                        {editingId && (
                          <button
                            type="button"
                            onClick={() => cancelEditItemComment(item.id)}
                            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-500"
                          >
                            ยกเลิก
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => submitItemComment(item.id)}
                          className="flex-1 rounded-md bg-slate-700 px-2 py-1.5 text-xs font-medium text-white sm:flex-none"
                        >
                          {editingId ? 'บันทึก' : 'ส่ง'}
                        </button>
                      </div>
                    </div>
                  )}
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
          <div className="mt-1 flex flex-wrap gap-2">
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
            {teamScore?.updated_by && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                โดย {editorName(teamScore.updated_by)} {formatEntryTime(teamScore.updated_at)}
              </span>
            )}
          </div>
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
              <p className="mb-2 text-base font-bold text-amber-900">⚠ เกณฑ์ The Must (ต้องมี)</p>
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

          {itemsByLevel['-2'].length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-sm font-semibold text-slate-600">หลักฐานประกอบการประเมิน</p>
              {renderChecklist(itemsByLevel['-2'])}
            </div>
          )}

          {/* Sticky action bar: pinned to the bottom of the screen while
              scrolling through this topic's own content above, then
              releases back into normal flow once scroll reaches its real
              position here — letting the next topic's bar take over. The
              small code/name line exists because by the time it's pinned,
              the topic header up top is usually long scrolled out of view. */}
          <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-slate-200 bg-white/95 px-4 pt-2 pb-2.5 backdrop-blur">
            <p className="mb-1 truncate text-[10px] font-medium text-slate-400">
              {topic.code} · {topic.name_th}
            </p>
            <div className="flex gap-3">
              {topic.must_text && (
                <div className="flex-1">
                  <p className="mb-1 text-[11px] font-bold text-slate-600">มาตรฐานพื้นฐาน</p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => applyMustPass(false)}
                      className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold ${mustPass === false ? 'border-red-600 bg-red-500 text-white' : 'border-slate-300 text-slate-500'}`}
                    >
                      ✗ ไม่ผ่าน
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => applyMustPass(true)}
                      className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold ${mustPass === true ? 'border-emerald-600 bg-emerald-500 text-white' : 'border-slate-300 text-slate-500'}`}
                    >
                      ✓ ผ่าน
                    </button>
                  </div>
                  {teamScore?.must_pass_updated_by && mustPass !== null && (
                    <p className="mt-1 truncate text-[10px] text-slate-400">
                      {teamScore.must_pass_updated_at && `${formatEntryTime(teamScore.must_pass_updated_at)} `}
                      {editorName(teamScore.must_pass_updated_by)}
                    </p>
                  )}
                </div>
              )}

              <div className={topic.must_text ? 'flex-[1.5]' : 'flex-1'}>
                <p className="mb-1 text-[11px] font-bold text-slate-600">เกณฑ์การพัฒนาต่อเนื่อง</p>
                <div className={`grid gap-1.5 ${topic.allow_na ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  {([0, 1, 2] as ScoreValue[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      disabled={readOnly}
                      onClick={() => applyScore(v)}
                      className={`rounded-xl border-2 py-2 text-sm font-bold ${!isNa && score === v ? SCORE_COLOR[v] : 'border-slate-300 text-slate-500'}`}
                    >
                      {v}
                    </button>
                  ))}
                  {topic.allow_na && (
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={applyNa}
                      className={`rounded-xl border-2 py-2 text-xs font-bold ${isNa ? 'border-sky-600 bg-sky-500 text-white' : 'border-slate-300 text-slate-500'}`}
                    >
                      N/A
                    </button>
                  )}
                </div>
                {teamScore?.updated_by && answered && (
                  <p className="mt-1 truncate text-[10px] text-slate-400">
                    {teamScore.updated_at && `${formatEntryTime(teamScore.updated_at)} `}
                    {editorName(teamScore.updated_by)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1 text-sm font-semibold text-slate-600">เหตุผล / บันทึกเพิ่มเติม (ช่วยกันคอมเมนต์ได้)</p>
            {topicComments.length > 0 && (
              <div className="mb-1.5 flex flex-col gap-1">
                {topicComments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
                    <p className="whitespace-pre-line">{c.text}</p>
                    {(c.author || isAdmin) && (
                      <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span>
                          {c.author}
                          {c.createdAt && ` · ${formatEntryTime(c.createdAt)}`}
                        </span>
                        <span className="flex shrink-0 gap-2">
                          {!readOnly && c.authorId === participantId && (
                            <button type="button" onClick={() => startEditTopicComment(c)} className="font-medium text-emerald-600 hover:underline">
                              แก้ไข
                            </button>
                          )}
                          {isAdmin && (
                            <button type="button" onClick={() => deleteTopicComment(c.id)} className="font-medium text-red-600 hover:underline">
                              ลบ
                            </button>
                          )}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!readOnly && (
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end">
                <textarea
                  value={newTopicComment}
                  onChange={(e) => setNewTopicComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      submitTopicComment()
                    }
                  }}
                  rows={2}
                  placeholder="พิมพ์แล้วกด Enter เพื่อเพิ่มความเห็น (Shift+Enter ขึ้นบรรทัดใหม่)..."
                  className="w-full resize-y rounded-lg border border-slate-300 p-2 text-sm"
                />
                <div className="flex shrink-0 gap-1.5">
                  {editingTopicCommentId && (
                    <button
                      type="button"
                      onClick={cancelEditTopicComment}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-500"
                    >
                      ยกเลิก
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={submitTopicComment}
                    className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white sm:flex-none"
                  >
                    {editingTopicCommentId ? 'บันทึก' : 'ส่ง'}
                  </button>
                </div>
              </div>
            )}
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
      {checked ? 'ใช่' : 'ไม่ใช่'}
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
