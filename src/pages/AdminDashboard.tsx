import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { AssessmentRound, Facility } from '../types'
import AdminNav from '../components/AdminNav'
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

export default function AdminDashboard() {
  const [rounds, setRounds] = useState<RoundRow[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav title="รอบการประเมิน" />

      <div className="mb-4 flex justify-end">
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
      ) : (
        <div className="flex flex-col gap-3">
          {rounds.map((r) => (
            <Link
              key={r.id}
              to={`/admin/rounds/${r.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-400"
            >
              <div>
                <p className="font-semibold text-slate-800">{r.name}</p>
                <p className="text-sm text-slate-500">
                  {r.facility?.name} · {formatThaiDate(r.survey_date, 'ยังไม่กำหนดวัน')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-sm tracking-widest">{r.join_code}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor[r.status]}`}>{statusLabel[r.status]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
