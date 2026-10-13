import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useConfirm } from '../components/ConfirmProvider'
import { formatThaiDateTime } from '../lib/thaiDate'
import {
  deleteDocument,
  documentDownloadUrl,
  listDocuments,
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

function fileIcon(mime: string): string {
  if (mime.includes('pdf')) return '📕'
  if (mime.includes('image')) return '🖼️'
  if (mime.includes('word') || mime.includes('document')) return '📘'
  if (mime.includes('sheet') || mime.includes('excel')) return '📗'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📙'
  return '📄'
}

type UploadJob = { key: string; file: File; title: string; progress: UploadProgress; status: 'uploading' | 'done' | 'error'; error?: string }

export default function Documents() {
  const confirm = useConfirm()
  const [items, setItems] = useState<DocumentItem[] | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [jobs, setJobs] = useState<UploadJob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function reload() {
    const list = await listDocuments().catch(() => [])
    setItems(list)
  }

  useEffect(() => {
    reload()
    async function checkAdmin(session: unknown) {
      if (!session) return setIsAdmin(false)
      const { data } = await supabase.rpc('is_admin')
      setIsAdmin(Boolean(data))
    }
    supabase.auth.getSession().then(({ data }) => checkAdmin(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => checkAdmin(session))
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
      uploadDocument(job.file, job.title, (progress) => {
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

  async function handleDelete(doc: DocumentItem) {
    const ok = await confirm({ title: 'ลบเอกสาร', message: `ลบ "${doc.title}" ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`, danger: true, confirmLabel: 'ลบเอกสาร' })
    if (!ok) return
    await deleteDocument(doc.id)
    reload()
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
          <p className="mt-2 text-xs text-slate-500">ไฟล์จะถูกเก็บใน Google Drive ของหน่วยงาน · ไฟล์ละไม่เกิน 60 MB · ห้ามอัปโหลดข้อมูลผู้ป่วย</p>

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
          {items.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-2xl">{fileIcon(doc.mime_type)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{doc.title}</p>
                <p className="truncate text-xs text-slate-400">
                  {doc.file_name} · {formatFileSize(doc.size_bytes)} · {formatThaiDateTime(doc.created_at)}
                </p>
              </div>
              <a
                href={documentDownloadUrl(doc.id)}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                ดาวน์โหลด
              </a>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(doc)}
                  className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  ลบ
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
