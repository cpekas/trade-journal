import { useState } from 'react'
import type { JournalConfig, Cadence } from '../lib/repo'
import { routinesRepo, type Bias, type RoutineRun } from '../lib/routines'
import { routineStatus } from '../lib/stats'

const BIAS: Record<Bias, { label: string; icon: string; cls: string }> = {
  up: { label: 'صعودی', icon: '📈', cls: 'good' },
  down: { label: 'نزولی', icon: '📉', cls: 'bad' },
  range: { label: 'رنج', icon: '↔️', cls: '' },
}
const BIAS_ORDER: Bias[] = ['up', 'down', 'range']
const CAD_LABEL: Record<Cadence, string> = { monthly: 'ماهانه', weekly: 'هفتگی', daily: 'روزانه', h4: '۴ساعته' }

function whenLabel(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function Routine({ config, onChange }: { config: JournalConfig; onChange?: () => void }) {
  const [, setV] = useState(0)
  const bump = () => { setV((v) => v + 1); onChange?.() }
  const status = routineStatus(config)
  const defined = status.cadences.filter((c) => c.total > 0)
  const runs = routinesRepo.allRuns().slice().sort((a, b) => b.at.localeCompare(a.at))
  const pending = runs.filter((r) => !r.verdict)
  const graded = runs.filter((r) => r.verdict)
  const accuracy = graded.length ? Math.round((graded.filter((r) => r.verdict === 'right').length / graded.length) * 100) : null
  const readyToLog = defined.some((c) => routinesRepo.getDraft(c.cadence).bias)

  const Run = ({ r }: { r: RoutineRun }) => (
    <div className="run-row" key={r.id}>
      <div className="run-main">
        <span className="hcad">{CAD_LABEL[r.cadence]}</span>
        <span className={'hbias' + (BIAS[r.bias].cls ? ' ' + BIAS[r.bias].cls : '')}>{BIAS[r.bias].icon} {BIAS[r.bias].label}</span>
        <span className="muted run-when">{whenLabel(r.at)}</span>
      </div>
      <div className="run-verdict">
        <button className={'vbtn right' + (r.verdict === 'right' ? ' on' : '')} title="درست بود" onClick={() => { routinesRepo.setVerdict(r.id, 'right'); bump() }}>✅</button>
        <button className={'vbtn wrong' + (r.verdict === 'wrong' ? ' on' : '')} title="غلط بود" onClick={() => { routinesRepo.setVerdict(r.id, 'wrong'); bump() }}>❌</button>
      </div>
    </div>
  )

  return (
    <div className="routine">
      {/* ── composer: one top-down pass ── */}
      <div className="card">
        <h2>🧭 روتین امروز <span className="tag">تاپ‌داون</span></h2>
        {defined.length === 0 ? (
          <p className="muted hint" style={{ margin: 0 }}>هنوز روتینی تعریف نشده — از ⚙ تنظیمات اضافه کن.</p>
        ) : (
          <>
            <p className="muted hint" style={{ marginTop: 0 }}>از بالا به پایین: ترندِ هر تایم‌فریم رو بزن، نشانه‌ها اختیاریه، آخرش «ثبت روتین».</p>
            {defined.map((cs) => {
              const steps = config.routines[cs.cadence] ?? []
              const draft = routinesRepo.getDraft(cs.cadence)
              const seen = new Set(draft.seen)
              return (
                <div className="rt-row" key={cs.cadence}>
                  <div className="rt-head">
                    <span className="rt-cad">{cs.label}</span>
                    <span className={'rt-status' + (cs.complete && cs.bias ? ' ' + BIAS[cs.bias].cls : cs.stale ? ' bad' : '')}>
                      {cs.complete && cs.bias
                        ? `ثبت‌شده: ${BIAS[cs.bias].icon} ${BIAS[cs.bias].label}${cs.runsThisPeriod > 1 ? ` · ${cs.runsThisPeriod}×` : ''}`
                        : cs.stale
                          ? 'کهنه — دوباره ببین'
                          : '— ثبت‌نشده'}
                    </span>
                  </div>
                  <div className="seg">
                    {BIAS_ORDER.map((b) => (
                      <button key={b} type="button" className={'seg-btn' + (draft.bias === b ? ' on ' + b : '')} onClick={() => { routinesRepo.setDraftBias(cs.cadence, b); bump() }}>
                        {BIAS[b].icon}<span>{BIAS[b].label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="rt-seen">
                    {steps.map((label) => (
                      <button key={label} type="button" className={'tagchip' + (seen.has(label) ? ' on' : '')} onClick={() => { routinesRepo.toggleSeen(cs.cadence, label); bump() }}>{label}</button>
                    ))}
                  </div>
                </div>
              )
            })}
            <button className="act primary big" disabled={!readyToLog} onClick={() => { if (routinesRepo.logAll()) bump() }}>✅ ثبت روتین</button>
          </>
        )}
      </div>

      {/* ── evaluate later: trend correctness is time-dependent ── */}
      <div className="card">
        <h2>🎯 ارزیابیِ روتین‌ها {accuracy != null && <span className={'tag ' + (accuracy >= 50 ? 'good' : 'bad')}>دقت {accuracy}%</span>}</h2>
        <p className="muted hint" style={{ marginTop: 0 }}>درستیِ روتین به زمان بستگی داره — <b>بعداً</b> که نتیجه معلوم شد، اینجا ✅/❌ بزن.</p>

        {pending.length > 0 && (
          <>
            <div className="lbl">⏳ در انتظار ارزیابی ({pending.length})</div>
            {pending.slice(0, 50).map((r) => <Run key={r.id} r={r} />)}
            {pending.length > 50 && <p className="muted hint" style={{ marginBottom: 0 }}>+{pending.length - 50} موردِ قدیمی‌تر</p>}
          </>
        )}

        {graded.length > 0 && (
          <>
            <div className="lbl" style={{ marginTop: pending.length ? 12 : 0 }}>ارزیابی‌شده ({graded.length})</div>
            {graded.slice(0, 20).map((r) => <Run key={r.id} r={r} />)}
          </>
        )}

        {runs.length === 0 && <p className="muted hint" style={{ margin: 0 }}>هنوز روتینی ثبت نشده — بالا یه ترند بزن و «ثبت روتین» کن.</p>}
      </div>
    </div>
  )
}
