import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createDocDrive, validateUpload } from './drive.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
}
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

// REST ของ Supabase ผ่าน service role — schema เลือกเองต่อการเรียก เพราะ credential ของ
// Google Drive อยู่ใน public.system_google_credentials (ของ msh-organize เดิม) ส่วนตาราง
// เอกสารอยู่ใน pcu_standard.documents (ของแอปนี้เอง)
async function svc(schema: 'public' | 'pcu_standard', path: string, opt: RequestInit = {}) {
  const method = (opt.method || 'GET').toUpperCase()
  const profileHeader = method === 'GET' || method === 'HEAD' ? 'Accept-Profile' : 'Content-Profile'
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opt,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', [profileHeader]: schema, ...(opt.headers || {}) },
  })
  const text = await r.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!r.ok) throw Object.assign(new Error(typeof data === 'string' ? data : (data as any)?.message || (data as any)?.error || `Supabase ${r.status}`), { status: r.status >= 400 && r.status < 600 ? r.status : 502 })
  return data
}
const svcPublic = (path: string, opt?: RequestInit) => svc('public', path, opt)
const svcPcu = (path: string, opt?: RequestInit) => svc('pcu_standard', path, opt)

async function requireAdmin(req: Request): Promise<{ userId: string; email: string }> {
  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) throw Object.assign(new Error('กรุณาเข้าสู่ระบบ'), { status: 401 })
  const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: auth } })
  if (!ur.ok) throw Object.assign(new Error('กรุณาเข้าสู่ระบบ'), { status: 401 })
  const au = await ur.json()
  const email = String(au?.email || '').toLowerCase()
  if (!email) throw Object.assign(new Error('กรุณาเข้าสู่ระบบ'), { status: 401 })
  const rows = await svcPcu(`admin_allowlist?select=email&email=ilike.${encodeURIComponent(email)}&limit=1`)
  if (!Array.isArray(rows) || rows.length === 0) throw Object.assign(new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่อัปโหลด/ลบเอกสารได้'), { status: 403 })
  return { userId: String(au.id), email }
}

const DOC_PUBLIC_FIELDS = 'id,title,file_name,mime_type,size_bytes,created_at'
function publicItem(row: any) {
  return { id: row.id, title: row.title, file_name: row.file_name, mime_type: row.mime_type, size_bytes: Number(row.size_bytes), created_at: row.created_at }
}
async function saveFile(docId: string, patch: Record<string, unknown>) {
  const rows = await svcPcu(`documents?id=eq.${encodeURIComponent(docId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    headers: { Prefer: 'return=representation' },
  })
  return (rows as any[])?.[0]
}
async function oneDoc(id: string) {
  const rows = await svcPcu(`documents?id=eq.${encodeURIComponent(id)}&select=*&limit=1`)
  return (rows as any[])?.[0] || null
}
const drive = createDocDrive(svcPublic, saveFile)

async function routes(req: Request, path: string): Promise<Response> {
  const method = req.method.toUpperCase()

  if (path === 'list' && method === 'GET') {
    const rows = await svcPcu(`documents?uploaded_at=not.is.null&select=${DOC_PUBLIC_FIELDS}&order=created_at.desc&limit=500`)
    const items = (rows as any[]).map(publicItem)
    return out({ ok: true, items })
  }

  if (path === 'documents' && method === 'POST') {
    const admin = await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const file = validateUpload(body)
    await drive.token() // Drive ระบบกลางต้องพร้อมก่อน ไม่งั้นได้เอกสารเปล่าค้างในรายการ
    const title = String(body?.title || '').trim().slice(0, 300) || file.name
    const rows = await svcPcu('documents', {
      method: 'POST',
      body: JSON.stringify({ title, file_name: file.name, mime_type: file.mime, size_bytes: file.size, created_by: admin.userId }),
      headers: { Prefer: 'return=representation' },
    })
    const item = (rows as any[])?.[0]
    return out({ ok: true, item: { id: item.id } }, 201)
  }

  const fileRoute = path.match(/^documents\/([0-9a-f-]{36})\/(upload|upload\/content|download)$/i)
  if (fileRoute) {
    const [, id, action] = fileRoute
    const item = await oneDoc(id)
    if (!item) return out({ ok: false, error: 'ไม่พบเอกสาร หรือเอกสารถูกลบแล้ว' }, 404)
    if (action === 'download' && method === 'GET') return await drive.download(id, item, await drive.token())
    await requireAdmin(req)
    if (action === 'upload' && method === 'POST') return out({ ok: true, ...(await drive.begin(id, item, await drive.token())) })
    if (action === 'upload/content' && method === 'POST') {
      const result = await drive.chunk(req, id, item, await drive.token(), Number(new URL(req.url).searchParams.get('offset')))
      const done = Boolean(result.file?.uploaded_at)
      return out({ ok: true, offset: result.offset, done, ...(done ? { item: publicItem(result.file) } : {}) })
    }
  }

  const single = path.match(/^documents\/([0-9a-f-]{36})$/i)
  if (single && method === 'DELETE') {
    await requireAdmin(req)
    const item = await oneDoc(single[1])
    if (!item) return out({ ok: false, error: 'ไม่พบเอกสาร หรือเอกสารถูกลบแล้ว' }, 404)
    if (item.uploaded_at) await drive.trash(item, await drive.token())
    await svcPcu(`documents?id=eq.${encodeURIComponent(single[1])}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    return out({ ok: true, id: single[1] })
  }

  return out({ ok: false, error: 'ไม่พบรายการที่ร้องขอ' }, 404)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  try {
    const url = new URL(req.url)
    const path = url.pathname.replace(/^\/pcu-doc\/?/, '').replace(/^\/functions\/v1\/pcu-doc\/?/, '') || 'list'
    return await routes(req, path)
  } catch (e) {
    const message = String((e as Error)?.message || e)
    const status = Number((e as any)?.status || 0)
    if (status >= 400 && status < 600) return out({ ok: false, error: message }, status)
    console.error('pcu-doc', message)
    return out({ ok: false, error: 'ระบบเอกสารทำงานไม่สำเร็จ กรุณาลองใหม่' }, 500)
  }
})
