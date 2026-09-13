import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { AssessmentRound, Facility } from '../types'
import BrandLogo from '../components/BrandLogo'
import { formatThaiDate } from '../lib/thaiDate'

type RoundRow = AssessmentRound & { facility: Facility | null }

export default function PublicHistory() {
  const [rounds, setRounds] = useState<RoundRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('assessment_rounds')
        .select('*, facility:facilities(*)')
        .eq('status', 'completed')
        .eq('is_public', true)
        .order('survey_date', { ascending: false })
      if (!error) setRounds((data as unknown as RoundRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <BrandLogo className="mx-auto mb-3 h-16 w-auto object-contain" />
        <h1 className="text-xl font-bold text-slate-800">ประวัติการประเมินที่เผยแพร่สู่สาธารณะ</h1>
        <p className="mt-1 text-sm text-slate-500">ผลการประเมินมาตรฐานหน่วยบริการปฐมภูมิที่คณะกรรมการดำเนินการเสร็จสิ้นแล้ว</p>
      </div>

      {loading ? (
        <p className="text-center text-slate-400">กำลังโหลด...</p>
      ) : rounds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          ยังไม่มีผลการประเมินที่เผยแพร่สู่สาธารณะในขณะนี้
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rounds.map((r) => (
            <Link
              key={r.id}
              to={`/round/${r.id}/report`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-400"
            >
              <div>
                <p className="font-semibold text-slate-800">{r.facility?.name ?? 'ไม่ระบุหน่วยบริการ'}</p>
                <p className="text-sm text-slate-500">
                  {r.name} · {formatThaiDate(r.survey_date)}
                </p>
              </div>
              <span className="text-sm font-medium text-sky-700">ดูรายงาน →</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-600">
          ← กลับหน้าแรก
        </Link>
      </div>
    </div>
  )
}
