import { useState } from 'react'
import type { JournalConfig, Cadence } from '../lib/repo'
import { routinesRepo, type Bias } from '../lib/routines'
import { routineStatus } from '../lib/stats'

const BIAS: Record<Bias, { label: string; icon: string; cls: string }> = {
  up: { label: 'صعودی', icon: '📈', cls: 'good' },
  down: { label: 'نزولی', icon: '📉', cls: 'bad' },
  range: { label: 'رنج', icon: '↔️', cls: '' },
}
const BIAS_ORDER: Bias[] = ['up', 'down', 'range']

function ago(iso?: string): string {
  if (!iso) return 'هنوز نزدی'
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600e3)
  if (h <= 0) return 'همین حالا'
  if (h < 24) return `${h} ساعت پیش`
  return `${Math.floor(h / 24)} روز پیش`
}

function periodLabel(cad: Cadence, period: string): string {
  try {
    const p = period.split('-').map(Number)
    // build from LOCAL components to match how the keys were created (avoid UTC off-by-one)
    if (cad === 'monthly') return new Date(p[0], p[1] - 1, 1).toLocaleDateString('fa-IR', { year: '2-digit', month: 'short' })
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })
  } catch {
    return period
  }
}

export default function Routine({ config, onChange }: { config: JournalConfig; onChange?: () => void }) {
  const [, setV] = useState(0)
  const bump = () => { setV((v) => v + 1); onChange?.() }
  const status = routineStatus(config)
  const all = routinesRepo.getAll()
  const anyDefined = status.cadences.some((c) => c.total > 0)

  const histFor = (cad: Cadence) => {
    const curKey = status.cadences.find((c) => c.cadence === cad)?.key // exclude the still-editable current period
    return Object.entries(all)
      .filter(([k, r]) => k.startsWith(cad + ':') && k !== curKey && (r.bias || (r.done && r.done.length)))
      .map(([k, r]) => ({ period: k.slice(cad.length + 1), bias: r.bias, done: r.done?.length ?? 0, total: r.total }))
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 8)
  }
  const order: Cadence[] = ['monthly', 'weekly', 'daily', 'h4']
  const anyHistory = order.some((c) => histFor(c).length)

  return (
    <div className="routine">
      <div className="card">
        <h2>🧭 روتین آماده‌سازی <span className="tag">تاپ‌داون</span></h2>
        <p className="muted hint" style={{ marginTop: 0 }}>
          از بالا به پایین — برای هر تایم‌فریم ترند رو مشخص کن و نشانه‌هایی که دیدی رو تیک بزن.
        </p>
        <div className={'routine-summary ' + (anyDefined ? status.level : 'partial')}>
          {!anyDefined
            ? 'هنوز روتینی تعریف نشده — از ⚙ تنظیمات اضافه کن'
            : status.level === 'ready'
              ? '✅ همهٔ ترندها مشخص شده'
              : status.reasons.join(' · ')}
        </div>
        <button className="act" style={{ marginTop: 10 }} onClick={() => { status.cadences.forEach((c) => routinesRepo.reset(c.key, c.total)); bump() }}>
          🔄 شروع جلسهٔ جدید (ریست همه)
        </button>
      </div>

      {status.cadences.map((cs) => {
        const steps = config.routines[cs.cadence] ?? []
        const rec = routinesRepo.get(cs.key)
        const doneSet = new Set(rec.total === steps.length ? rec.done : [])
        return (
          <div className="card" key={cs.cadence}>
            <h2>
              {cs.label}{' '}
              <span className={'tag' + (cs.bias ? ' ' + BIAS[cs.bias].cls : cs.stale ? ' bad' : '')}>
                {steps.length === 0 ? 'تعریف‌نشده' : cs.bias ? `${BIAS[cs.bias].icon} ${BIAS[cs.bias].label}` : cs.stale ? 'کهنه — دوباره' : 'ترند نزده'}
              </span>
            </h2>
            {steps.length === 0 ? (
              <p className="muted hint" style={{ margin: 0 }}>هنوز تعریف نشده — از ⚙ تنظیمات اضافه کن.</p>
            ) : (
              <>
                <div className="lbl">ترند این تایم‌فریم</div>
                <div className="chips">
                  {BIAS_ORDER.map((b) => (
                    <button
                      key={b}
                      type="button"
                      className={'chip' + (cs.bias === b ? ' active' : '')}
                      onClick={() => { routinesRepo.setBias(cs.key, b, steps.length); bump() }}
                    >
                      {BIAS[b].icon} {BIAS[b].label}
                    </button>
                  ))}
                </div>

                <div className="lbl" style={{ marginTop: 10 }}>نشانه‌ها <span className="muted">(اختیاری — چی دیدی؟)</span></div>
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

                <div className="rowbox" style={{ marginTop: 8, marginBottom: 0 }}>
                  <span className="muted">{cs.cadence === 'h4' ? `آخرین بررسی: ${ago(cs.lastCompletedAt)}${rec.runs ? ` · امروز ${rec.runs} بار` : ''}` : ''}</span>
                  <button className="ghost" onClick={() => { routinesRepo.reset(cs.key, steps.length); bump() }}>ریست این تایم‌فریم</button>
                </div>
              </>
            )}
          </div>
        )
      })}

      <div className="card routine-hist">
        <h2>📜 سابقهٔ روتین <span className="tag">ترندِ گذشته</span></h2>
        {!anyHistory ? (
          <p className="muted hint" style={{ margin: 0 }}>هنوز چیزی ثبت نشده — بالا ترندها رو بزن تا این‌جا بمونه.</p>
        ) : (
          order.map((cad) => {
            const h = histFor(cad)
            if (!h.length) return null
            const label = status.cadences.find((c) => c.cadence === cad)?.label ?? cad
            return (
              <div className="hrow" key={cad}>
                <span className="hcad">{label}</span>
                {h.map((r) => (
                  <span key={r.period} className={'hbias' + (r.bias ? ' ' + BIAS[r.bias].cls : '')}>
                    {periodLabel(cad, r.period)} {r.bias ? BIAS[r.bias].icon : '—'}
                  </span>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
