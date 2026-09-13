import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { AssessmentRound, Facility, ScoringMode } from '../types'
import AdminLayout from '../components/AdminLayout'
import { formatThaiDate } from '../lib/thaiDate'

type RoundRow = AssessmentRound & { facility?: Facility }

const statusLabel: Record<AssessmentRound['status'], string> = {
  draft: 'ร่าง',
  in_progress: 'กำลังประเมิน',
  completed: 'เสร็จสิ้น',
}
const statusColor: Record<AssessmentRound['status'], string> = {
  draft: 'bg-slate-100 text-slate-500',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
}
const scoringModeLabel: Record<ScoringMode, string> = {
  average: 'ประเมินเดี่ยว',
  collaborative: 'ทีมคณะกรรมช่วยกัน',
}
const scoringModeColor: Record<ScoringMode, string> = {
  average: 'bg-slate-100 text-slate-500',
  collaborative: 'bg-violet-100 text-violet-700',
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [rounds, setRounds] = useState<RoundRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AssessmentRound['status']>('all')
  const [modeFilter, setModeFilter] = useState<'all' | ScoringMode>('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: roundsData, error } = await supabase
        .from('assessment_rounds')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        console.error(error)
        setLoading(false)
        return
      }
      const facilityIds = [...new Set((roundsData as AssessmentRound[]).map((r) => r.facility_id))]
      const { data: facilitiesData } = await supabase.from('facilities').select('*').in('id', facilityIds.length ? facilityIds : [''])
      const facMap = new Map((facilitiesData as Facility[] | null)?.map((f) => [f.id, f]) ?? [])
      setRounds((roundsData as AssessmentRound[]).map((r) => ({ ...r, facility: facMap.get(r.facility_id) })))
      setLoading(false)
    }
    load()
  }, [])

  const filteredRounds = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rounds.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (modeFilter !== 'all' && r.scoring_mode !== modeFilter) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.join_code.toLowerCase().includes(q) ||
        (r.facility?.name ?? '').toLowerCase().includes(q) ||
        (r.facility?.code ?? '').toLowerCase().includes(q) ||
        (r.facility?.pcu_code ?? '').toLowerCase().includes(q) ||
        (r.facility?.affiliation ?? '').toLowerCase().includes(q)
      )
    })
  }, [rounds, search, statusFilter, modeFilter])

  return (
    <AdminLayout title="รอบการประเมิน">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อรอบ, หน่วยบริการ, รหัส PCU, สังกัด, join code"
            className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="draft">ร่าง</option>
            <option value="in_progress">กำลังประเมิน</option>
            <option value="completed">เสร็จสิ้น</option>
          </select>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">ทุกประเภทการประเมิน</option>
            <option value="average">ประเมินเดี่ยว</option>
            <option value="collaborative">ทีมคณะกรรมช่วยกัน</option>
          </select>
        </div>
        <Link to="/admin/rounds/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          + สร้างรอบการประเมินใหม่
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-400">กำลังโหลด...</p>
      ) : rounds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          ยังไม่มีรอบการประเมิน
        </p>
      ) : filteredRounds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          ไม่พบรอบการประเมินที่ตรงกับเงื่อนไขค้นหา
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs whitespace-nowrap text-slate-500">
                <th className="px-3 py-2.5 font-medium">ลำดับที่</th>
                <th className="px-3 py-2.5 font-medium">ชื่อรอบ</th>
                <th className="px-3 py-2.5 font-medium">หน่วยบริการ</th>
                <th className="px-3 py-2.5 font-medium">รหัส PCU</th>
                <th className="px-3 py-2.5 font-medium">ประเภท</th>
                <th className="px-3 py-2.5 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filteredRounds.map((r, i) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/admin/rounds/${r.id}`)}
                  className="cursor-pointer border-b border-slate-100 whitespace-nowrap last:border-0 hover:bg-slate-50"
                >
                  <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-400">{formatThaiDate(r.survey_date, 'ยังไม่กำหนดวัน')}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-slate-600">
                      {r.facility?.name ?? '-'}
                      {r.facility?.code && <span className="text-slate-400"> : {r.facility.code}</span>}
                    </p>
                    <p className="text-xs text-slate-400">{r.facility?.affiliation ?? '-'}</p>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">{r.facility?.pcu_code ?? '-'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${scoringModeColor[r.scoring_mode]}`}>
                      {scoringModeLabel[r.scoring_mode]}
                    </span>
                    <p className="mt-1 font-mono text-base font-bold tracking-widest text-slate-700">{r.join_code}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[r.status]}`}>{statusLabel[r.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
