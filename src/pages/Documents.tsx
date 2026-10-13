import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from '../components/ConfirmProvider'
import FileTypeIcon from '../components/FileTypeIcon'
import { formatThaiDateTime } from '../lib/thaiDate'
import {
  deleteDocument,
  documentDownloadUrl,
  listDocuments,
  reorderDocuments,
  updateDocument,
  uploadDocument,
  type DocumentItem,
  type UploadProgress,
} from '../lib/documentsApi'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

type UploadJob = { key: string; file: File; title: string; progress: UploadProgress; status: 'uploading' | 'done' | 'error'; error?: string }

export default function Documents() {
  const confirm = useConfirm()
  const [items, setItems] = useState<DocumentItem[] | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const dragIndex = useRef<number | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  async function reload() {
    const { items, isAdmin } = await listDocuments().catch(() => ({ items: [], isAdmin: false }))
    setItems(items)
    setIsAdmin(isAdmin)
  }

  useEffect(() => {
    reload()
    const { data: sub } = supabase.auth.onAuthStateChange(() => reload())
    return () => sub.subscription.unsubscribe()
  }, [])

  function pickFiles() {
    fileInputRef.current?.click()
  }

  function startUploads(files: FileList | null) {
    if (!files || files.length === 0) return
    const newJobs: UploadJob[] = Array.from(files).map((file) => ({
      key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      title: file.name.replace(/\.[^.]+$/, ''),
      progress: { loaded: 0, total: file.size },
      status: 'uploading',
    }))
    setJobs((prev) => [...prev, ...newJobs])
    for (const job of newJobs) {
      uploadDocument(job.file, job.title, '', (progress) => {
        setJobs((prev) => prev.map((j) => (j.key === job.key ? { ...j, progress } : j)))
      })
        .then(() => {
          setJobs((prev) => prev.map((j) => (j.key === job.key ? { ...j, status: 'done' } : j)))
          reload()
        })
        .catch((err: Error) => {
          setJobs((prev) => prev.map((j) => (j.key === job.key ? { ...j, status: 'error', error: err.message } : j)))
        })
    }
  }

  function startEdit(doc: DocumentItem) {
    setEditingId(doc.id)
    setEditTitle(doc.title)
    setEditDescription(doc.description ?? '')
  }

  async function saveEdit() {
    if (!editingId || !editTitle.trim()) return
    setSaving(true)
    try {
      await updateDocument(editingId, { title: editTitle.trim(), description: editDescription.trim() })
      setEditingId(null)
      reload()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleHidden(doc: DocumentItem) {
    try {
      await updateDocument(doc.id, { hidden: !doc.hidden })
      reload()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  async function handleDelete(doc: DocumentItem) {
    const ok = await confirm({ title: 'ลบเอกสาร', message: `ลบ "${doc.title}" ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`, danger: true, confirmLabel: 'ลบเอกสาร' })
    if (!ok) return
    await deleteDocument(doc.id)
    reload()
  }

  // ลากสลับตำแหน่งแบบ optimistic ใน state ก่อน แล้วค่อยบันทึก sort_order จริงตอนปล่อยเมาส์
  function handleDragStart(index: number) {
    dragIndex.current = index
  }
  function handleDragOver(e: React.DragEvent, overId: string, overIndex: number) {
    e.preventDefault()
    setDragOverId(overId)
    const from = dragIndex.current
    if (from === null || from === overIndex || !items) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(overIndex, 0, moved)
    dragIndex.current = overIndex
    setItems(next)
  }
  async function handleDrop() {
    setDragOverId(null)
    dragIndex.current = null
    if (!items) return
    try {
      await reorderDocuments(items.map((d) => d.id))
    } catch (err) {
      alert((err as Error).message)
      reload()
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">เอกสารการประเมิน</h1>
        <Link to="/" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
          ← กลับหน้าแรก
        </Link>
      </div>

      {isAdmin && (
        <div className="mb-6 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => startUploads(e.target.files)} />
          <button
            onClick={pickFiles}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + อัปโหลดเอกสารใหม่
          </button>
          <p className="mt-2 text-xs text-slate-500">
            ไฟล์จะถูกเก็บใน Google Drive ของหน่วยงาน · ไฟล์ละไม่เกิน 60 MB · ห้ามอัปโหลดข้อมูลผู้ป่วย · ลากไอคอน ⠿ เพื่อจัดลำดับ
          </p>

          {jobs.length > 0 && (
            <div className="mt-3 space-y-2">
              {jobs.map((job) => {
                const pct = job.progress.total > 0 ? Math.round((job.progress.loaded / job.progress.total) * 100) : 0
                return (
                  <div key={job.key} className="rounded-lg bg-white p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-700">{job.title}</span>
                      <span className={job.status === 'error' ? 'text-red-600' : job.status === 'done' ? 'text-emerald-600' : 'text-slate-400'}>
                        {job.status === 'error' ? 'ล้มเหลว' : job.status === 'done' ? 'เสร็จแล้ว' : `${pct}%`}
                      </span>
                    </div>
                    {job.status === 'uploading' && (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {job.status === 'error' && <p className="mt-1 text-red-500">{job.error}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {items === null ? (
        <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">ยังไม่มีเอกสาร</p>
      ) : (
        <ul className="space-y-2">
          {items.map((doc, index) => (
            <li
              key={doc.id}
              draggable={isAdmin && editingId !== doc.id}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, doc.id, index)}
              onDrop={handleDrop}
              onDragEnd={() => {
                setDragOverId(null)
                dragIndex.current = null
              }}
              className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${
                dragOverId === doc.id ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-slate-200'
              } ${doc.hidden ? 'opacity-50' : ''}`}
            >
              {isAdmin && editingId !== doc.id && (
                <span className="mt-2 shrink-0 cursor-grab select-none text-slate-300" title="ลากเพื่อจัดลำดับ">
                  ⠿
                </span>
              )}
              <FileTypeIcon mime={doc.mime_type} className="h-9 w-9 shrink-0" />
              {editingId === doc.id ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    placeholder="ชื่อเอกสาร"
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="คำอธิบายเอกสาร (ไม่บังคับ)"
                    rows={2}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving || !editTitle.trim()}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      บันทึก
                    </button>
                    <button onClick={() => setEditingId(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500">
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">
                      {doc.title}
                      {doc.hidden && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-normal text-slate-500">ซ่อนอยู่</span>}
                    </p>
                    {doc.description && <p className="mt-0.5 text-sm text-slate-600">{doc.description}</p>}
                    <p className="truncate text-xs text-slate-400">
                      {doc.file_name} · {formatFileSize(doc.size_bytes)} · {formatThaiDateTime(doc.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <a
                      href={documentDownloadUrl(doc.id)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      ดาวน์โหลด
                    </a>
                    {isAdmin && (
                      <>
                        <button onClick={() => startEdit(doc)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                          แก้ไข
                        </button>
                        <button onClick={() => toggleHidden(doc)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                          {doc.hidden ? 'แสดง' : 'ซ่อน'}
                        </button>
                        <button onClick={() => handleDelete(doc)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
                          ลบ
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
