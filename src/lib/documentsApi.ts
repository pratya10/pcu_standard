import { supabase } from './supabaseClient'

export type DocumentItem = {
  id: string
  title: string
  file_name: string
  mime_type: string
  size_bytes: number
  created_at: string
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pcu-doc`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const CHUNK_SIZE = 4 * 1024 * 1024

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ANON_KEY
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await authHeader()
  const res = await fetch(`${FN_URL}/${path}`, {
    ...init,
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.ok === false) throw new Error(body?.error || `เรียกใช้งานระบบเอกสารไม่สำเร็จ (${res.status})`)
  return body as T
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const body = await call<{ items: DocumentItem[] }>('list')
  return body.items
}

export function documentDownloadUrl(id: string): string {
  return `${FN_URL}/documents/${id}/download`
}

export async function deleteDocument(id: string): Promise<void> {
  await call(`documents/${id}`, { method: 'DELETE' })
}

export type UploadProgress = { loaded: number; total: number }

// อัปโหลดทีละ 4 MB ไปที่ Edge Function (pcu-doc) ซึ่งส่งต่อเข้า resumable session ของ
// Google Drive — ใช้ XMLHttpRequest แทน fetch เพราะต้องอ่านความคืบหน้าของการอัปโหลดจริง
function putChunk(id: string, offset: number, blob: Blob, token: string, onProgress?: (p: UploadProgress) => void): Promise<{ offset: number; done: boolean }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${FN_URL}/documents/${id}/upload/content?offset=${offset}`)
    xhr.setRequestHeader('apikey', ANON_KEY)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.({ loaded: offset + e.loaded, total: offset + e.total })
    }
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && body?.ok) resolve({ offset: body.offset, done: body.done })
        else reject(new Error(body?.error || `อัปโหลดไม่สำเร็จ (${xhr.status})`))
      } catch {
        reject(new Error('อัปโหลดไม่สำเร็จ กรุณาลองใหม่'))
      }
    }
    xhr.onerror = () => reject(new Error('การเชื่อมต่อขาดหาย กรุณาลองใหม่'))
    xhr.send(blob)
  })
}

export async function uploadDocument(file: File, title: string, onProgress?: (p: UploadProgress) => void): Promise<DocumentItem> {
  const token = await authHeader()
  const created = await call<{ item: { id: string } }>('documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, name: file.name, size: file.size, mime: file.type || 'application/octet-stream' }),
  })
  const id = created.item.id

  const begin = await call<{ offset: number; chunk_size: number; done: boolean }>(`documents/${id}/upload`, { method: 'POST' })
  let offset = begin.offset
  onProgress?.({ loaded: offset, total: file.size })
  while (offset < file.size) {
    const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size))
    const result = await putChunk(id, offset, slice, token, onProgress)
    offset = result.offset
    if (result.done) break
  }
  onProgress?.({ loaded: file.size, total: file.size })
  const items = await listDocuments()
  const item = items.find((d) => d.id === id)
  if (!item) throw new Error('อัปโหลดเสร็จแล้วแต่หารายการไม่พบ กรุณารีเฟรชหน้า')
  return item
}
