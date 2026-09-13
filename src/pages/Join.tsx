import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { randomDeviceKey, saveParticipantSession } from '../lib/participantSession'
import type { ParticipantRole } from '../types'

export default function Join() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<ParticipantRole>('evaluator')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!joinCode.trim() || !name.trim()) {
      setError('กรุณากรอกรหัสเข้าร่วมและชื่อ-สกุล')
      return
    }
    setLoading(true)
    try {
      const { data: round, error: roundErr } = await supabase
        .from('assessment_rounds')
        .select('id, name, status')
        .eq('join_code', joinCode.trim().toUpperCase())
        .maybeSingle()
      if (roundErr) throw roundErr
      if (!round) {
        setError('ไม่พบรอบการประเมินสำหรับรหัสนี้ กรุณาตรวจสอบอีกครั้ง')
        return
      }
      if (round.status === 'completed' && role !== 'viewer') {
        setError('รอบการประเมินนี้ปิดรับคะแนนแล้ว สามารถเข้าดูผลได้ในโหมดผู้สังเกตการณ์')
        return
      }

      const deviceKey = randomDeviceKey()
      const { data: participant, error: pErr } = await supabase
        .from('participants')
        .insert({ round_id: round.id, name: name.trim(), role, device_key: deviceKey })
        .select()
        .single()
      if (pErr) throw pErr

      saveParticipantSession({ participantId: participant.id, roundId: round.id, name: name.trim(), role })

      navigate(role === 'viewer' ? `/round/${round.id}/live` : `/round/${round.id}/score`)
    } catch (err) {
      console.error(err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-6 text-center text-xl font-bold text-slate-800">เข้าร่วมรอบการประเมิน</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">รหัสเข้าร่วม (Join Code)</label>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="เช่น A7K3ZQ"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-mono tracking-widest uppercase"
            maxLength={8}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ชื่อ-สกุล</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อ-สกุลผู้ประเมิน"
            className="w-full rounded-xl border border-slate-300 px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">บทบาท</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('evaluator')}
              className={`rounded-xl border px-4 py-3 text-sm font-medium ${role === 'evaluator' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500'}`}
            >
              กรรมการประเมิน
            </button>
            <button
              type="button"
              onClick={() => setRole('viewer')}
              className={`rounded-xl border px-4 py-3 text-sm font-medium ${role === 'viewer' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500'}`}
            >
              ผู้สังเกตการณ์
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'กำลังเข้าร่วม...' : 'เข้าร่วม'}
        </button>
      </form>
    </div>
  )
}
