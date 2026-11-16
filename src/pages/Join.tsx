import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { deviceKeyForThisBrowser, saveParticipantSession, unwrapRpc } from '../lib/participantSession'
import { searchCommitteeMembers } from '../lib/committeeSearch'
import VersionFooter from '../components/VersionFooter'
import BrandLogo from '../components/BrandLogo'
import GuideLink from '../components/GuideLink'
import type { CommitteeMember, ParticipantRole } from '../types'

export default function Join() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [name, setName] = useState('')
  const [civilServiceLevel, setCivilServiceLevel] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [role, setRole] = useState<ParticipantRole>('evaluator')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [suggestions, setSuggestions] = useState<CommitteeMember[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedMember, setSelectedMember] = useState<CommitteeMember | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleNameChange(value: string) {
    setName(value)
    if (selectedMember && value.trim() !== selectedMember.name) setSelectedMember(null)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const query = value.trim()
    if (query.length < 3) {
      setSuggestions([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchCommitteeMembers(query)
        setSuggestions(results)
        setShowSuggestions(true)
      } catch (err) {
        console.error(err)
      }
    }, 300)
  }

  function selectSuggestion(m: CommitteeMember) {
    setName(m.name)
    setCivilServiceLevel(m.civil_service_level ?? '')
    setAffiliation(m.affiliation ?? '')
    setSelectedMember(m)
    setSuggestions([])
    setShowSuggestions(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!joinCode.trim() || !name.trim()) {
      setError('กรุณากรอกรหัสเข้าร่วมและชื่อ-สกุล')
      return
    }
    if (role === 'evaluator' && (!civilServiceLevel.trim() || !affiliation.trim())) {
      setError('กรุณากรอกระดับข้าราชการ/ตำแหน่ง และหน่วยงานที่สังกัดให้ครบก่อนเข้าร่วม')
      return
    }
    setLoading(true)
    try {
      const code = joinCode.trim().toUpperCase()
      const { data: found, error: findErr } = await supabase.rpc('find_round', { p_join_code: code })
      if (findErr) throw findErr
      const round = (Array.isArray(found) ? found[0] : found) as { id: string; name: string; status: string } | undefined
      if (!round) {
        setError('ไม่พบรอบการประเมินสำหรับรหัสนี้')
        setLoading(false)
        return
      }
      if (round.status === 'completed' && role !== 'viewer') {
        setError('รอบการประเมินนี้ปิดรับคะแนนแล้ว สามารถเข้าดูผลได้ในโหมดผู้สังเกตการณ์')
        setLoading(false)
        return
      }
      // รอบที่ปิดแล้ว ผู้สังเกตการณ์ดูผลได้เลยโดยไม่ต้องลงชื่อเข้าร่วม
      if (round.status === 'completed') {
        navigate(`/round/${round.id}/live`)
        return
      }

      // ทะเบียนกรรมการแก้ได้เฉพาะผู้ดูแล (หน้าแอดมิน > ทะเบียนกรรมการ) · ที่นี่ใช้ข้อมูลที่กรอกกับรอบนี้เท่านั้น
      // เข้าร่วมผ่าน RPC join_round: เครื่องเดิม (กุญแจเครื่องเดิม) กลับเข้ามาได้ผู้เข้าร่วมคนเดิม คะแนนเดิมไม่หาย
      const trimmedName = name.trim()
      const deviceKey = deviceKeyForThisBrowser()
      const { data: joined, error: joinErr } = await supabase.rpc('join_round', {
        p_join_code: code,
        p_device_key: deviceKey,
        p_name: trimmedName,
        p_role: role,
        p_civil_service_level: civilServiceLevel.trim() || null,
        p_affiliation: affiliation.trim() || null,
      })
      const participant = unwrapRpc<{ ok: boolean; round_id: string; participant_id: string }>(joined, joinErr)

      saveParticipantSession({
        participantId: participant.participant_id,
        roundId: participant.round_id,
        name: trimmedName,
        role,
        joinCode: code,
        deviceKey,
      })

      navigate(role === 'viewer' ? `/round/${round.id}/live` : `/round/${round.id}/score`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <BrandLogo className="mx-auto mb-4 h-16 w-auto object-contain" />
      <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">เข้าร่วมรอบการประเมิน</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="mb-1 block text-lg font-semibold text-slate-700">รหัสเข้าร่วม</label>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="เช่น A7K3ZQ"
            className="w-full rounded-xl border border-slate-300 px-4 py-4 text-center text-3xl font-mono tracking-widest uppercase"
            maxLength={8}
            autoFocus
          />
        </div>
        <div className="relative">
          <label className="mb-1 block text-lg font-semibold text-slate-700">ชื่อ-สกุล</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="ชื่อ-สกุลผู้ประเมิน"
            className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg"
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg">
              {suggestions.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onMouseDown={() => selectSuggestion(m)}
                  className="block w-full border-b border-slate-100 px-4 py-3 text-left text-lg last:border-0 hover:bg-emerald-50"
                >
                  <span className="font-semibold text-slate-800">{m.name}</span>
                  {(m.position || m.affiliation) && (
                    <span className="block text-base text-slate-500">
                      {[m.position, m.affiliation].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        {role === 'evaluator' && (
          <>
            <div>
              <label className="mb-1 block text-lg font-semibold text-slate-700">
                ระดับข้าราชการ / ตำแหน่ง <span className="text-base font-normal text-red-500">*</span>
              </label>
              <input
                value={civilServiceLevel}
                onChange={(e) => setCivilServiceLevel(e.target.value)}
                placeholder="เช่น ชำนาญการพิเศษ"
                className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg"
              />
            </div>
            <div>
              <label className="mb-1 block text-lg font-semibold text-slate-700">
                หน่วยงานที่สังกัด <span className="text-base font-normal text-red-500">*</span>
              </label>
              <input
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
                placeholder="เช่น สสจ.เชียงราย"
                className="w-full rounded-xl border border-slate-300 px-4 py-4 text-lg"
              />
            </div>
          </>
        )}
        <div>
          <label className="mb-1 block text-lg font-semibold text-slate-700">บทบาท</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('evaluator')}
              className={`rounded-xl border px-4 py-4 text-lg font-medium ${role === 'evaluator' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500'}`}
            >
              กรรมการประเมิน
            </button>
            <button
              type="button"
              onClick={() => setRole('viewer')}
              className={`rounded-xl border px-4 py-4 text-lg font-medium ${role === 'viewer' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500'}`}
            >
              ผู้สังเกตการณ์
            </button>
          </div>
        </div>

        {error && <p className="text-lg text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-emerald-600 px-4 py-4 text-xl font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'กำลังเข้าร่วม...' : 'เข้าร่วม'}
        </button>
      </form>

      <div className="mt-5"><GuideLink section="join" /></div>
      <VersionFooter />
    </div>
  )
}
