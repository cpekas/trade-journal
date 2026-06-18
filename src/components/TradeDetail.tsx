import { useState, type ReactNode } from 'react'
import type { Trade } from '../types'
import { fmtDate, fmtDuration, fmtUsd } from '../lib/time'
import { remainingUsd } from '../lib/calc'
import { executionScore } from '../lib/stats'
import { getRiskCap } from '../lib/repo'

interface Props {
  trade: Trade
  now: number
  onBack: () => void
  onClose: () => void
  onEdit: () => void
  onRestore: () => void
  onDelete: () => void
}

function Row({ k, v, cls }: { k: string; v: ReactNode; cls?: string }) {
  return (
    <div className="drow">
      <span className="muted">{k}</span>
      <span className={cls}>{v}</span>
    </div>
  )
}

export default function TradeDetail({ trade: t, now, onBack, onClose, onEdit, onRestore, onDelete }: Props) {
  const dur =
    t.status === 'open'
      ? fmtDuration(now - new Date(t.openedAt).getTime())
      : t.closedAt
        ? fmtDuration(new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime())
        : '—'
  const isClosed = !!t.result
  const [lightbox, setLightbox] = useState(false)

  return (
    <div className="detail">
      <div className="editor-head">
        <h2>{t.symbol} {t.direction === 'long' ? '▲ لانگ' : '▼ شورت'}</h2>
        <button className="ghost" onClick={onBack}>بازگشت</button>
      </div>

      <div className="card">
        <Row k="وضعیت" v={t.status === 'open' ? ((t.closes?.length ?? 0) > 0 ? 'نیمه‌بسته' : 'باز') : t.result != null ? 'بسته (آرشیو)' : 'آرشیو'} />
        <Row k="باز شده" v={fmtDate(t.openedAt)} />
        {t.closedAt && <Row k="بسته شده" v={fmtDate(t.closedAt)} />}
        <Row k="مدت" v={dur} />
        <Row k="ستاپ / سشن / تایم" v={`${t.setup || '—'} · ${t.session || '—'} · ${t.timeframe || '—'}`} />
      </div>

      <div className="card">
        <h2>پلن</h2>
        <Row k="ورود / SL / TP" v={`${t.entry ?? '—'} / ${t.stopLoss ?? '—'} / ${t.takeProfit ?? '—'}`} />
        <Row k="R:R پلن" v={t.plannedRR ? t.plannedRR + ' : 1' : '—'} />
        <Row
          k="حجم پوزیشن"
          v={t.positionUsd != null
            ? '$' + t.positionUsd.toLocaleString('en-US') + ((t.closes?.length ?? 0) > 0 ? ` · باقی‌مونده $${(remainingUsd(t.positionUsd, t.closes) ?? 0).toLocaleString('en-US')}` : '')
            : '—'}
        />
        <Row k="ریسک" v={`${t.riskPercent != null ? t.riskPercent + '٪' : '—'}${t.riskUsd != null ? ' · $' + t.riskUsd.toLocaleString('en-US') : ''}`} />
        <Row k="اهرم" v={t.leverage != null ? t.leverage + 'x' : '—'} />
        <Row k="اطمینان" v={`${t.confidence}/5`} />
        <Row k="حال قبل" v={t.moodBefore || '—'} />
        {t.checklist.length > 0 && (
          <div className="chips wrap">
            {t.checklist.map((c) => (
              <span key={c.id} className={'pill ' + (c.checked ? 'good' : 'bad')}>{c.checked ? '✓' : '✗'} {c.label}</span>
            ))}
          </div>
        )}
      </div>

      {(t.closes?.length ?? 0) > 0 && (
        <div className="card">
          <h2>بستن‌ها ({t.closes!.length})</h2>
          {t.closes!.map((c, i) => (
            <div className="drow" key={c.id}>
              <span className="muted">#{i + 1} · ${c.sizeUsd.toLocaleString('en-US')} @ {c.exit}</span>
              <span className={c.pnlUsd != null ? (c.pnlUsd >= 0 ? 'good' : 'bad') : ''}>
                {c.rMultiple != null ? (c.rMultiple > 0 ? '+' : '') + c.rMultiple + 'R' : '—'} · {fmtUsd(c.pnlUsd)}
              </span>
            </div>
          ))}
        </div>
      )}

      {isClosed && (
        <div className="card">
          <h2>نتیجهٔ کل</h2>
          <Row k="خروج" v={t.exit ?? '—'} />
          <Row
            k="نتیجه"
            cls={t.result === 'win' ? 'good' : t.result === 'loss' ? 'bad' : ''}
            v={`${t.result === 'win' ? 'سود' : t.result === 'loss' ? 'ضرر' : 'سربه‌سر'} • ${t.rMultiple != null ? (t.rMultiple > 0 ? '+' : '') + t.rMultiple + 'R' : '—'}${t.pnlPercent != null ? ' • ' + t.pnlPercent + '%' : ''}`}
          />
          <Row k="سود/ضرر $" cls={t.pnlUsd != null ? (t.pnlUsd >= 0 ? 'good' : 'bad') : ''} v={fmtUsd(t.pnlUsd)} />
          {t.leverage != null && t.pnlPercent != null && (
            <Row k="بازده با اهرم" cls={t.pnlPercent >= 0 ? 'good' : 'bad'} v={`${t.pnlPercent * t.leverage > 0 ? '+' : ''}${+(t.pnlPercent * t.leverage).toFixed(2)}% (${t.leverage}x)`} />
          )}
          <Row k="پایبند به پلن" v={t.followedPlan == null ? '—' : t.followedPlan ? 'بله' : 'خیر'} />
          {(() => { const sc = executionScore(t, getRiskCap()); return sc != null ? <Row k="نمرهٔ اجرا" cls={sc >= 70 ? 'good' : sc < 50 ? 'bad' : ''} v={`${sc} / 100`} /> : null })()}
          {t.mistakes.length > 0 && <div className="chips wrap">{t.mistakes.map((m) => <span key={m} className="pill bad">{m}</span>)}</div>}
          {t.didWell.length > 0 && <div className="chips wrap">{t.didWell.map((m) => <span key={m} className="pill good">{m}</span>)}</div>}
          <Row k="حال بعد" v={t.moodAfter || '—'} />
          {t.lesson && <Row k="درس" v={t.lesson} />}
        </div>
      )}

      {t.screenshot && (
        <div className="card">
          <h2>اسکرین‌شات</h2>
          <div className="shot-view" onClick={() => setLightbox(true)}>
            <img src={t.screenshot} alt="چارت" />
          </div>
        </div>
      )}

      <div className="actions">
        {t.status === 'open' && <button className="act primary" onClick={onClose}>بستن معامله</button>}
        <button className="act" onClick={onEdit}>ویرایش</button>
        {t.status === 'archived' && <button className="act" onClick={onRestore}>بازگردانی به فعال</button>}
        {t.status === 'open' && <button className="act danger" onClick={onDelete}>حذف</button>}
      </div>

      {lightbox && t.screenshot && (
        <div className="lightbox" onClick={() => setLightbox(false)}>
          <img src={t.screenshot} alt="چارت" />
        </div>
      )}
    </div>
  )
}
