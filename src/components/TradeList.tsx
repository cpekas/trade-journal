import type { Trade } from '../types'
import { fmtDuration } from '../lib/time'

interface Props {
  trades: Trade[]
  now: number
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

export default function TradeList({ trades, now, onSelect, onClose }: Props) {
  if (trades.length === 0) {
    return <p className="muted empty">معامله‌ای اینجا نیست.</p>
  }
  return (
    <div className="tlist">
      {trades.map((t, i) => {
        const open = t.status === 'open'
        const dur = open ? fmtDuration(now - new Date(t.openedAt).getTime()) : null
        return (
          <div className="trade" key={t.id || i} onClick={() => onSelect(t.id)}>
            <div className="trade-main">
              <span className={'pill ' + (t.direction === 'long' ? 'good' : 'bad')}>
                {t.symbol} {t.direction === 'long' ? '▲' : '▼'}
              </span>
              <span className="muted">{t.setup || '—'} · {t.session || '—'}</span>
            </div>
            <div className="trade-side">
              {open ? (
                <>
                  <span className="pill open">{(t.closes?.length ?? 0) > 0 ? 'نیمه‌بسته' : 'باز'} • {dur}</span>
                  <button className="btn-close" onClick={(e) => { e.stopPropagation(); onClose(t.id) }}>
                    بستن
                  </button>
                </>
              ) : (
                <span className={'pill ' + (t.result === 'win' ? 'good' : t.result === 'loss' ? 'bad' : '')}>
                  {t.rMultiple != null ? (t.rMultiple > 0 ? '+' : '') + t.rMultiple + 'R' : '—'}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
