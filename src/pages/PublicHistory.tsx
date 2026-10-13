import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { AssessmentRound, Facility } from '../types'
import BrandLogo from '../components/BrandLogo'
import { formatThaiDate } from '../lib/thaiDate'

type RoundRow = AssessmentRound & { facility: Facility | null }
const PAGE_SIZE = 10
const control = 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600'
const action = `${control} cursor-pointer font-medium text-sky-700 hover:bg-sky-50 disabled:cursor-default disabled:opacity-40`

export default function PublicHistory() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const date = params.get('date') ?? ''
  const requestedPage = Number(params.get('page'))
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1
  const [rounds, setRounds] = useState<RoundRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [composing, setComposing] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  function update(key: string, value: string) {
    setLoading(true)
    setParams(previous => {
      const next = new URLSearchParams(previous)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    }, { replace: true })
  }

  useEffect(() => {
    if (composing) return
    const controller = new AbortController()
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(false)
      try {
        const name = query.trim()
        let request = supabase.from('assessment_rounds')
          .select(name ? '*, facility:facilities!inner(*)' : '*, facility:facilities(*)', { count: 'exact' })
          .eq('status', 'completed').eq('is_public', true)
        if (name) request = request.ilike('facility.name', `%${name.replace(/[\\%_]/g, '\\$&')}%`)
        if (date) request = request.eq('survey_date', date)
        const { data, error: loadError, count } = await request
          .order('survey_date', { ascending: false, nullsFirst: false })
          .order('id', { ascending: true })
          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
          .abortSignal(controller.signal)
        if (cancelled) return
        if (loadError) throw loadError
        const lastPage = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
        if (page > lastPage) {
          setParams(previous => { const next = new URLSearchParams(previous); next.set('page', String(lastPage)); return next }, { replace: true })
          return
        }
        setRounds((data as unknown as RoundRow[]) ?? [])
        setTotal(count ?? 0)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, query ? 300 : 0)
    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [query, date, page, composing, retry, setParams])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 text-center">
        <BrandLogo className="mx-auto mb-3 h-16 w-auto object-contain" />
        <h1 className="text-xl font-bold text-slate-800">ประวัติการประเมินที่เผยแพร่สู่สาธารณะ</h1>
      </header>

      <div className="mb-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="history-name" className="mb-1 block text-sm font-semibold text-slate-700">ค้นหาชื่อ รพ.สต. / หน่วยบริการ</label>
          <div className="relative">
            <input id="history-name" ref={searchRef} type="search" value={query} placeholder="พิมพ์ชื่อหน่วยบริการ เช่น ป่าอ้อดอนชัย" onChange={e => update('q', e.target.value)} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} className={`${control} w-full pr-12 [&::-webkit-search-cancel-button]:appearance-none`} />
            {query && <button type="button" aria-label="ล้างชื่อที่ค้นหา" onClick={() => { update('q', ''); searchRef.current?.focus() }} className="absolute right-0 top-0 flex h-full w-11 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-600">×</button>}
          </div>
        </div>
        <div>
          <label htmlFor="history-date" className="mb-1 block text-sm font-semibold text-slate-700">วันที่ประเมิน</label>
          <div className="flex flex-wrap gap-2">
            <input id="history-date" type="date" value={date} onChange={e => update('date', e.target.value)} className={`${control} min-w-0 flex-1 sm:w-44`} />
            {date && <button type="button" onClick={() => update('date', '')} className={action}>ล้างวันที่</button>}
          </div>
          <p className="mt-1 text-xs text-slate-500">ไม่เลือกวันที่เพื่อดูทุกวัน</p>
        </div>
      </div>

      <div className="min-h-48 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-busy={loading}>
        {loading ? <p role="status" className="p-8 text-center text-slate-500">กำลังโหลดประวัติการประเมิน...</p>
          : error ? <div role="alert" className="p-8 text-center"><p className="mb-4 text-red-700">โหลดประวัติไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่</p><button type="button" onClick={() => setRetry(value => value + 1)} className={action}>ลองใหม่</button></div>
            : !rounds.length ? <div role="status" className="p-8 text-center text-slate-500"><p>{query || date ? 'ไม่พบผลการประเมินที่ตรงกับชื่อหรือวันที่ที่เลือก' : 'ยังไม่มีผลการประเมินที่เผยแพร่สู่สาธารณะในขณะนี้'}</p>{(query || date) && <button type="button" onClick={() => setParams({}, { replace: true })} className={`${action} mt-4`}>ล้างการค้นหาทั้งหมด</button>}</div>
              : <table className="w-full table-fixed text-left text-sm">
                <caption className="sr-only">รายชื่อหน่วยบริการ วันที่ประเมิน และลิงก์ดูรายงาน</caption>
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr><th scope="col" className="p-3 sm:p-4">หน่วยบริการ / รอบประเมิน</th><th scope="col" className="hidden w-48 p-4 sm:table-cell">วันที่ประเมิน</th><th scope="col" className="w-28 p-3 text-center sm:w-32">รายงาน</th></tr></thead>
                <tbody className="divide-y divide-slate-200">{rounds.map(round => <tr key={round.id} className="hover:bg-sky-50/40">
                  <th scope="row" className="break-words p-3 font-normal sm:p-4"><p className="font-semibold text-slate-800">{round.facility?.name ?? 'ไม่ระบุหน่วยบริการ'}</p><p className="mt-1 text-xs text-slate-500">{round.name}</p><p className="mt-2 text-xs text-slate-600 sm:hidden">วันที่ประเมิน: {formatThaiDate(round.survey_date, 'ไม่ระบุวันที่')}</p></th>
                  <td className="hidden p-4 text-slate-600 sm:table-cell">{formatThaiDate(round.survey_date, 'ไม่ระบุวันที่')}</td>
                  <td className="p-2 text-center sm:p-3"><Link to={`/round/${round.id}/report`} aria-label={`ดูรายงาน ${round.facility?.name ?? 'ไม่ระบุหน่วยบริการ'} ${round.name}`} className="inline-flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">ดูรายงาน</Link></td>
                </tr>)}</tbody>
              </table>}
      </div>
      {!loading && !error && total > 0 && <nav aria-label="หน้าประวัติการประเมิน" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p role="status" className="text-slate-500">แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} จาก {total} รายการ</p>
        <div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => update('page', String(page - 1))} className={action}>ก่อนหน้า</button><span className="text-slate-600">{page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => update('page', String(page + 1))} className={action}>ถัดไป</button></div>
      </nav>}
      <div className="mt-8 text-center"><Link to="/" className="inline-block rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-sky-600">← กลับหน้าแรก</Link></div>
    </div>
  )
}
