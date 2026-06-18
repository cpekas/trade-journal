import { useState } from 'react'
import type { JournalConfig } from '../lib/repo'
import { routinesRepo } from '../lib/routines'
import { routineStatus } from '../lib/stats'

function ago(iso?: string): string {
  if (!iso) return 'هنوز نزدی'
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600e3)
  if (h <= 0) return 'همین حالا'
  if (h < 24) return `${h} ساعت پیش`
  return `${Math.floor(h / 24)} روز پیش`
}

export default function Routine({ config, onChange }: { config: JournalConfig; onChange?: () => void }) {
  const [, setV] = useState(0)
  const bump = () => { setV((v) => v + 1); onChange?.() }
  const status = routineStatus(config)

  return (
    <div className="routine">
      <div className="card">
        <h2>🧭 روتین آماده‌سازی <span className="tag">تاپ‌داون</span></h2>
        <p className="muted hint" style={{ marginTop: 0 }}>
          از بالا به پایین — قبل از ترید مطمئن شو روند هر تایم‌فریم رو بررسی کردی.
        </p>
        <div className={'routine-summary ' + status.level}>
          {status.level === 'ready' ? '✅ همهٔ روتین‌ها آماده‌ست' : status.reasons.join(' · ')}
        </div>
      </div>

      {status.cadences.map((cs) => {
        const steps = config.routines[cs.cadence] ?? []
        const rec = routinesRepo.get(cs.key)
        const doneSet = new Set(rec.total === steps.length ? rec.done : [])
        return (
          <div className="card" key={cs.cadence}>
            <h2>
              {cs.label}{' '}
              <span className={'tag' + (cs.complete ? ' good' : cs.stale ? ' bad' : '')}>
                {steps.length === 0 ? 'تعریف‌نشده' : cs.complete ? 'کامل ✓' : cs.stale ? 'کهنه — دوباره بزن' : `${cs.done}/${cs.total}`}
              </span>
            </h2>
            {steps.length === 0 ? (
              <p className="muted hint" style={{ margin: 0 }}>هنوز تعریف نشده — از ⚙ تنظیمات اضافه کن.</p>
            ) : (
              <>
                <div className="ck-list">
                  {steps.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      className={'chip ck' + (doneSet.has(i) ? ' active' : '')}
                      onClick={() => { routinesRepo.toggleStep(cs.key, i, steps.length); bump() }}
                    >
                      <span>{label}</span><span>{doneSet.has(i) ? '✓' : '✗'}</span>
                    </button>
                  ))}
                </div>
                {cs.cadence === 'h4' && (
                  <div className="rowbox" style={{ marginTop: 8, marginBottom: 0 }}>
                    <span className="muted">آخرین بررسی: {ago(cs.lastCompletedAt)}{rec.runs ? ` · امروز ${rec.runs} بار` : ''}</span>
                    <button className="act" onClick={() => { routinesRepo.resetRun(cs.key, steps.length); bump() }}>بررسی مجدد</button>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
