import { useEffect, useState } from 'react'
import type { TiltState, RoutineStatus } from '../lib/stats'

export function TiltStrip({ tilt }: { tilt: TiltState }) {
  if (tilt.level === 'calm' || tilt.reasons.length === 0) return null
  return (
    <div className={'tilt-strip ' + tilt.level}>
      {tilt.level === 'danger' ? '🛑' : '⚠️'} {tilt.reasons.join(' · ')}
    </div>
  )
}

// Soft (non-blocking) reminder that the top-down prep routines aren't complete.
export function RoutineStrip({ status, onOpen }: { status: RoutineStatus; onOpen?: () => void }) {
  if (status.level === 'ready' || status.reasons.length === 0) return null
  return (
    <div className="tilt-strip routine-strip caution" role="button" onClick={onOpen}>
      🧭 {status.reasons.join(' · ')} — برای تکمیل بزن
    </div>
  )
}

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  tilt: TiltState
  onProceed: () => void
  onBack: () => void
}

export default function CooldownGate({ tilt, onProceed, onBack }: Props) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const remaining = tilt.cooldownUntil ? tilt.cooldownUntil - now : 0

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-icon">🛑</div>
        <h2>مدارشکن فعال شد</h2>
        <div className="chips wrap" style={{ justifyContent: 'center' }}>
          {tilt.reasons.map((r) => (
            <span key={r} className="pill bad">{r}</span>
          ))}
        </div>
        {remaining > 0 && (
          <div className="gate-timer">
            <span className="muted">زمان سرد شدن</span>
            <b>{fmtMs(remaining)}</b>
          </div>
        )}
        <p className="muted">
          الان پرخطرترین لحظه برای ورود توئه — دقیقاً همین‌جاست که «عجله» و «انتقام» پول می‌سوزونن.
          پلن خوب فرار نمی‌کنه.
        </p>
        <button className="auth-submit" onClick={onBack}>باشه، صبر می‌کنم</button>
        <button className="auth-toggle" onClick={onProceed}>با مسئولیت خودم ادامه می‌دم</button>
      </div>
    </div>
  )
}
