import { useState } from 'react'
import type { Score, ScoreValue, Topic, TopicEvidenceItem } from '../types'

type TopicWithEvidence = Topic & { evidence: TopicEvidenceItem[] }

export default function TopicScoreCard({
  topic,
  index,
  existing,
  readOnly,
  onSave,
}: {
  topic: TopicWithEvidence
  index: number
  existing?: Score
  readOnly: boolean
  onSave: (draft: {
    score: ScoreValue | null
    isNa: boolean
    mustPass: boolean | null
    comment: string
    evidenceChecked: string[]
  }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [score, setScore] = useState<ScoreValue | null>(existing?.score ?? null)
  const [isNa, setIsNa] = useState(existing?.is_na ?? false)
  const [mustPass, setMustPass] = useState<boolean | null>(existing?.must_pass ?? null)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [evidenceChecked, setEvidenceChecked] = useState<string[]>(existing?.evidence_checked ?? [])
  const [saving, setSaving] = useState(false)

  const answered = isNa || score !== null

  async function save(next: Partial<{ score: ScoreValue | null; isNa: boolean; mustPass: boolean | null; comment: string; evidenceChecked: string[] }>) {
    if (readOnly) return
    const merged = {
      score: next.score !== undefined ? next.score : score,
      isNa: next.isNa !== undefined ? next.isNa : isNa,
      mustPass: next.mustPass !== undefined ? next.mustPass : mustPass,
      comment: next.comment !== undefined ? next.comment : comment,
      evidenceChecked: next.evidenceChecked !== undefined ? next.evidenceChecked : evidenceChecked,
    }
    setSaving(true)
    try {
      await onSave(merged)
    } finally {
      setSaving(false)
    }
  }

  function toggleEvidence(label: string) {
    const next = evidenceChecked.includes(label) ? evidenceChecked.filter((l) => l !== label) : [...evidenceChecked, label]
    setEvidenceChecked(next)
    save({ evidenceChecked: next })
  }

  const scoreDescriptions = getScoreDescriptions(topic)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-xs font-mono text-slate-400">
            #{index} · {topic.code}
          </p>
          <p className="truncate font-medium text-slate-800">{topic.name_th}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge answered={answered} isNa={isNa} score={score} />
          <span className="text-slate-300">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4">
          {topic.intent_text && (
            <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <span className="font-semibold">เจตจำนงการประเมิน: </span>
              {topic.intent_text}
            </p>
          )}
          {topic.must_text && (
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <span className="font-semibold">เกณฑ์ The Must: </span>
              {topic.must_text}
            </p>
          )}
          {topic.content_text && <p className="mb-3 text-sm text-slate-500">{topic.content_text}</p>}

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(['0', '1', '2'] as const).map((lvl) => (
              <div key={lvl} className="rounded-lg border border-slate-200 p-2 text-xs">
                <p className="mb-1 font-semibold text-slate-500">{lvl} คะแนน</p>
                <p className="whitespace-pre-line text-slate-600">{scoreDescriptions[lvl] || '—'}</p>
              </div>
            ))}
          </div>

          {topic.evidence.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-sm font-semibold text-slate-600">หลักฐานประกอบการประเมิน</p>
              <div className="flex flex-col gap-1">
                {topic.evidence.map((ev) => (
                  <label key={ev.id} className="flex items-start gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      disabled={readOnly}
                      checked={evidenceChecked.includes(ev.label)}
                      onChange={() => toggleEvidence(ev.label)}
                    />
                    <span>{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {topic.must_text && (
            <div className="mb-4">
              <p className="mb-1 text-sm font-semibold text-slate-600">ผลการประเมิน The Must</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setMustPass(true)
                    save({ mustPass: true })
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${mustPass === true ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500'}`}
                >
                  ผ่าน
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setMustPass(false)
                    save({ mustPass: false })
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${mustPass === false ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-300 text-slate-500'}`}
                >
                  ไม่ผ่าน
                </button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <p className="mb-1 text-sm font-semibold text-slate-600">คะแนน Continuous Improvement</p>
            <div className={`grid gap-2 ${topic.allow_na ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {([0, 1, 2] as ScoreValue[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setScore(v)
                    setIsNa(false)
                    save({ score: v, isNa: false })
                  }}
                  className={`rounded-lg border py-2 text-sm font-semibold ${!isNa && score === v ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 text-slate-600'}`}
                >
                  {v}
                </button>
              ))}
              {topic.allow_na && (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setIsNa(true)
                    setScore(null)
                    save({ isNa: true, score: null })
                  }}
                  className={`rounded-lg border py-2 text-sm font-semibold ${isNa ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-300 text-slate-600'}`}
                >
                  N/A
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-slate-600">เหตุผล / บันทึกเพิ่มเติม</p>
            <textarea
              disabled={readOnly}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => save({ comment })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="ระบุเหตุผลประกอบการให้คะแนน..."
            />
          </div>

          {saving && <p className="mt-2 text-xs text-slate-400">กำลังบันทึก...</p>}
        </div>
      )}
    </div>
  )
}

function getScoreDescriptions(topic: TopicWithEvidence): Record<'0' | '1' | '2', string> {
  if (topic.s3_breakdown) {
    const { staff, system, structure } = topic.s3_breakdown
    const build = (lvl: '0' | '1' | '2') =>
      [staff?.[lvl] && `Staff: ${staff[lvl]}`, system?.[lvl] && `System: ${system[lvl]}`, structure?.[lvl] && `Structure: ${structure[lvl]}`]
        .filter(Boolean)
        .join('\n')
    return { '0': build('0'), '1': build('1'), '2': build('2') }
  }
  return { '0': topic.score0_text ?? '', '1': topic.score1_text ?? '', '2': topic.score2_text ?? '' }
}

function StatusBadge({ answered, isNa, score }: { answered: boolean; isNa: boolean; score: ScoreValue | null }) {
  if (!answered) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">ยังไม่ประเมิน</span>
  if (isNa) return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">N/A</span>
  const color = score === 2 ? 'bg-emerald-100 text-emerald-700' : score === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{score} คะแนน</span>
}
