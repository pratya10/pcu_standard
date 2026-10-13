// เอกสารที่ admin อัปโหลดในหน้า "เอกสารการประเมิน" เก็บใน Google Drive บัญชีระบบกลาง
// เดียวกับที่ msh-organize ใช้ (mshprimary/supabase/functions/msh-doc/drive.mjs) — อ่าน
// client_id/client_secret/refresh_token จากตาราง public.system_google_credentials เดิม
// (ไม่สร้าง OAuth ใหม่) แต่เก็บไฟล์แยกโฟลเดอร์ของตัวเอง ("PCU Standard เอกสารการประเมิน")
// กันชนกับโฟลเดอร์เอกสารของหน่วยงานใน organize
//
// รูปแบบเดียวกับต้นฉบับ: เบราว์เซอร์ส่งไฟล์ทีละ 4 MB ผ่านฟังก์ชัน → ฟังก์ชันส่งต่อเข้า
// resumable session ของ Drive ขาดกลางทางเริ่มต่อจากตำแหน่งเดิมได้ ดาวน์โหลดผ่านฟังก์ชัน
// เท่านั้น drive_file_id / drive_upload_url ห้ามส่งออกไปหน้าเว็บ (ตัดออกใน index.ts)
export const DRIVE_ACCOUNT = 'fammedmaesai@gmail.com'
export const CHUNK_SIZE = 4 * 1024 * 1024
export const MAX_FILE_SIZE = 60 * 1024 * 1024
const BASE = 'https://www.googleapis.com/drive/v3'
const SETTING = 'pcu_standard_doc_files_drive'
const FOLDER_NAME = 'PCU Standard เอกสารการประเมิน'
const MARK = 'pcu_standard_doc_file'

type ApiError = Error & { status?: number }
const err = (message: string, status = 502): never => {
  throw Object.assign(new Error(message), { status }) as ApiError
}

export type UploadInput = { name: string; size: number; mime: string }

export function validateUpload(input: { name?: unknown; size?: unknown; mime?: unknown }): UploadInput {
  const name = String(input?.name || '')
    .trim()
    .replace(/[\\/\u0000-\u001f]/g, '_')
  const size = Number(input?.size)
  const mime = String(input?.mime || '').toLowerCase()
  if (!name || name.length > 255) err('ชื่อไฟล์ต้องมี 1–255 ตัวอักษร', 400)
  if (!Number.isSafeInteger(size) || size < 1) err('ไฟล์ว่าง หรืออ่านขนาดไฟล์ไม่ได้', 400)
  if (size > MAX_FILE_SIZE) err('ไฟล์ต้องมีขนาดไม่เกิน 60 MB', 400)
  return { name, size, mime: /^[\w.+-]+\/[\w.+-]+$/.test(mime) ? mime.slice(0, 120) : 'application/octet-stream' }
}

export function validSession(value: string): string {
  const u = new URL(value)
  if (u.origin !== 'https://www.googleapis.com' || u.pathname !== '/upload/drive/v3/files' || !u.searchParams.get('upload_id'))
    err('การเชื่อมต่ออัปโหลดไม่ถูกต้อง')
  return u.toString()
}

export function uploadedOffset(response: Response, total: number): number {
  if (response.ok) return total
  if (response.status !== 308) err('อัปโหลด Google Drive ไม่สำเร็จ กรุณาลองใหม่')
  const range = response.headers.get('range')
  return range ? Number(range.match(/^bytes=0-(\d+)$/)?.[1] ?? -1) + 1 : 0
}

type DriveMeta = {
  id?: string
  trashed?: boolean
  size?: string | number
  owners?: { emailAddress?: string }[]
  parents?: string[]
  appProperties?: Record<string, string>
}
type DocFile = { drive_file_id?: string | null; size_bytes: number }

export function verifyFile(meta: DriveMeta | null, docId: string, file: DocFile, folder: string): DriveMeta {
  if (
    !meta ||
    meta.trashed ||
    meta.id !== file?.drive_file_id ||
    Number(meta.size) !== Number(file?.size_bytes) ||
    !meta.owners?.some((o) => o.emailAddress?.toLowerCase() === DRIVE_ACCOUNT) ||
    !meta.parents?.includes(folder) ||
    meta.appProperties?.[MARK] !== docId
  )
    err('ข้อมูลไฟล์บน Drive ไม่ตรงกับเอกสาร', 409)
  return meta
}

const asciiName = (name: string) =>
  String(name || 'file')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')

type Db = (path: string, options?: RequestInit) => Promise<any>
type SaveFile = (docId: string, patch: Record<string, unknown>) => Promise<any>

// db(path, options) = REST ของ Supabase (service role, schema ที่เรียกเองกำหนด)
// saveFile(docId, patch) = PATCH แถว pcu_standard.documents แล้วคืนแถวใหม่
export function createDocDrive(dbPublic: Db, saveFile: SaveFile) {
  let cachedToken = ''
  let expiresAt = 0

  async function token(): Promise<string> {
    if (cachedToken && Date.now() < expiresAt) return cachedToken
    const c = (
      await dbPublic('system_google_credentials?select=client_id,client_secret,refresh_token&id=eq.1&limit=1')
    )?.[0]
    if (!c?.refresh_token) err('ยังไม่ได้เชื่อมต่อ Google Drive ระบบกลาง', 503)
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.client_id,
        client_secret: c.client_secret,
        refresh_token: c.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || !data.access_token) err('กรุณาเชื่อมต่อบัญชี Google ระบบกลางใหม่', 503)
    const about = await json(`${BASE}/about?fields=user(emailAddress)`, data.access_token)
    if (about.user?.emailAddress?.toLowerCase() !== DRIVE_ACCOUNT) err(`ต้องใช้ Google Drive ของ ${DRIVE_ACCOUNT} เท่านั้น`, 503)
    cachedToken = data.access_token
    expiresAt = Date.now() + Math.min(300, Math.max(0, Number(data.expires_in || 3600) - 120)) * 1000
    return cachedToken
  }

  const raw = (url: string, t: string, options: RequestInit = {}) =>
    fetch(url, { ...options, headers: { authorization: `Bearer ${t}`, ...options.headers }, redirect: 'manual' })
  async function json(url: string, t: string, options: RequestInit = {}) {
    const r = await raw(url, t, options)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) err('Google Drive ไม่พร้อมใช้งาน กรุณาลองใหม่', r.status === 404 ? 404 : 502)
    return data
  }
  const generatedId = async (t: string) => (await json(`${BASE}/files/generateIds?count=1&space=drive&type=files`, t)).ids[0]

  // โฟลเดอร์ของเอกสาร PCU Standard สร้างครั้งแรกที่มีคนอัปโหลด จองรหัสไว้ใน system_settings
  // ก่อน กันเกิดสองโฟลเดอร์เมื่อมีคนอัปโหลดพร้อมกันครั้งแรก
  async function folderId(): Promise<string> {
    const read = async () => String((await dbPublic(`system_settings?select=value&key=eq.${SETTING}&limit=1`))?.[0]?.value?.folder_id || '')
    let id = await read()
    if (!id) {
      const reserved = await generatedId(await token())
      await dbPublic('system_settings?on_conflict=key', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify({ key: SETTING, value: { folder_id: reserved, account: DRIVE_ACCOUNT }, updated_by: 'pcu-doc' }),
      })
      id = await read()
    }
    if (!id) err('ตั้งค่าโฟลเดอร์เอกสารใน Drive ไม่สำเร็จ')
    return id
  }
  async function folder(t: string): Promise<string> {
    const id = await folderId()
    const existing = await raw(`${BASE}/files/${encodeURIComponent(id)}?fields=id,mimeType,trashed,owners(emailAddress)`, t)
    if (existing.status === 404) {
      const r = await raw(`${BASE}/files?fields=id`, t, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', appProperties: { msh_module: 'pcu_standard_doc' } }),
      })
      if (!r.ok && r.status !== 409) err('สร้างโฟลเดอร์เอกสารใน Drive ไม่สำเร็จ')
    } else {
      const f = await existing.json().catch(() => ({}))
      if (!existing.ok || f.trashed || f.mimeType !== 'application/vnd.google-apps.folder' || !f.owners?.some((o: any) => o.emailAddress?.toLowerCase() === DRIVE_ACCOUNT))
        err('โฟลเดอร์เอกสารไม่อยู่ในบัญชีที่กำหนด', 503)
    }
    return id
  }
  async function metadata(file: DocFile, t: string): Promise<DriveMeta | null> {
    const r = await raw(`${BASE}/files/${encodeURIComponent(String(file.drive_file_id))}?fields=id,name,size,trashed,parents,owners(emailAddress),appProperties`, t)
    if (r.status === 404) return null
    if (!r.ok) err('ตรวจสอบไฟล์บน Drive ไม่สำเร็จ')
    return r.json()
  }
  async function complete(docId: string, file: any, t: string): Promise<any> {
    if (file.uploaded_at) return file
    const meta = file.drive_file_id ? await metadata(file, t) : null
    if (!meta) err('ไฟล์ยังอัปโหลดไม่ครบ', 409)
    verifyFile(meta, docId, file, await folderId())
    return saveFile(docId, { uploaded_at: new Date().toISOString(), drive_upload_url: null })
  }
  // เริ่ม หรือเริ่มต่อ: ตอบว่า Drive รับไปถึงไบต์ที่เท่าไรแล้ว หน้าเว็บส่งต่อจากตรงนั้น
  async function begin(docId: string, fileIn: any, t: string) {
    let file = fileIn
    const done = { offset: Number(file.size_bytes), chunk_size: CHUNK_SIZE, done: true }
    if (file.uploaded_at) return done
    if (file.drive_file_id && (await metadata(file, t))) {
      await complete(docId, file, t)
      return done
    }
    if (file.drive_upload_url) {
      const r = await raw(validSession(file.drive_upload_url), t, {
        method: 'PUT',
        headers: { 'content-range': `bytes */${file.size_bytes}`, 'content-length': '0' },
      })
      if (r.ok) {
        await complete(docId, file, t)
        return done
      }
      if (r.status === 308) return { offset: uploadedOffset(r, Number(file.size_bytes)), chunk_size: CHUNK_SIZE, done: false }
      if (![404, 410].includes(r.status)) err('ตรวจความคืบหน้าอัปโหลดไม่สำเร็จ')
    }
    const parent = await folder(t)
    if (!file.drive_file_id) file = await saveFile(docId, { drive_file_id: await generatedId(t) })
    const r = await raw('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size', t, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-upload-content-type': file.mime_type || 'application/octet-stream',
        'x-upload-content-length': String(file.size_bytes),
      },
      body: JSON.stringify({ id: file.drive_file_id, name: file.file_name, parents: [parent], appProperties: { msh_module: 'pcu_standard_doc', [MARK]: docId } }),
    })
    if (!r.ok || !r.headers.get('location')) err('เริ่มอัปโหลด Google Drive ไม่สำเร็จ')
    await saveFile(docId, { drive_upload_url: validSession(r.headers.get('location')!) })
    return { offset: 0, chunk_size: CHUNK_SIZE, done: false }
  }
  async function chunk(req: Request, docId: string, file: any, t: string, offset: number) {
    if (file.uploaded_at) return { offset: Number(file.size_bytes), file }
    if (!file.drive_upload_url) err('เริ่มการอัปโหลดใหม่ก่อน', 409)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= Number(file.size_bytes) || offset % 262144) err('ตำแหน่งอัปโหลดไม่ถูกต้อง', 400)
    const expected = Math.min(CHUNK_SIZE, Number(file.size_bytes) - offset)
    const reader = req.body?.getReader()
    if (!reader) err('ไม่พบข้อมูลไฟล์', 400)
    const parts: Uint8Array[] = []
    let length = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > expected) {
        await reader.cancel()
        err('ข้อมูลเกินขนาดที่กำหนด', 413)
      }
      parts.push(value)
    }
    if (length !== expected) err('ข้อมูลไฟล์มาไม่ครบ กรุณาลองใหม่', 400)
    const r = await raw(validSession(file.drive_upload_url), t, {
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream', 'content-length': String(length), 'content-range': `bytes ${offset}-${offset + length - 1}/${file.size_bytes}` },
      body: new Blob(parts),
    })
    const next = uploadedOffset(r, Number(file.size_bytes))
    if (next < offset || next > Number(file.size_bytes)) err('ความคืบหน้าอัปโหลดไม่ถูกต้อง')
    if (next === Number(file.size_bytes)) return { offset: next, file: await complete(docId, file, t) }
    return { offset: next, file }
  }
  // ส่งเป็นไฟล์แนบเสมอ หน้าเว็บเปิดดู PDF/รูปเองจาก Blob (ชนิดที่ปลอดภัยเท่านั้น)
  async function download(docId: string, file: any, t: string) {
    if (!file?.uploaded_at) err('ไฟล์ยังอัปโหลดไม่เสร็จ', 409)
    verifyFile(await metadata(file, t), docId, file, await folderId())
    const r = await raw(`${BASE}/files/${encodeURIComponent(file.drive_file_id)}?alt=media`, t)
    if (!r.ok) err('ดาวน์โหลดไฟล์จาก Drive ไม่สำเร็จ')
    return new Response(r.body, {
      headers: {
        'content-type': file.mime_type || 'application/octet-stream',
        'content-length': String(file.size_bytes),
        'content-disposition': `attachment; filename="${asciiName(file.file_name)}"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
        'cache-control': 'private, no-store',
      },
    })
  }
  async function trash(file: any, t: string) {
    if (!file?.drive_file_id) return
    await raw(`${BASE}/files/${encodeURIComponent(file.drive_file_id)}`, t, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    }).catch(() => {})
  }
  return { token, begin, chunk, complete, download, trash }
}
