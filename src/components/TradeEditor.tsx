import { useMemo, useState, type ReactNode } from 'react'
import type { Trade, PartialClose, TrendSnapshot } from '../types'
import { RISK_PERCENTS, MOODS_BEFORE, MOODS_AFTER, MISTAKES, DID_WELL, CADENCE_FA, BIAS_FA } from '../config'
import { plannedRR, riskFromSize, closeMetrics, aggregateCloses, remainingUsd, sumClosedSize } from '../lib/calc'
import { trendAlignment } from '../lib/stats'
import { tradesRepo, type JournalConfig } from '../lib/repo'
import { fmtUsd } from '../lib/time'
import { compressImage } from '../lib/image'
import ChipGroup from './ChipGroup'

function makeDraft(config: JournalConfig, routineReady?: boolean, routineTrends?: TrendSnapshot): Trade {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    status: 'open',
    openedAt: now,
    updatedAt: now,
    confidence: 3,
    checklist: config.checklist.map((c) => ({ id: c.id, label: c.label, checked: false })),
    mistakes: [],
    didWell: [],
    routineReadyAtEntry: routineReady,
    routineTrendAtEntry: routineTrends && Object.keys(routineTrends).length ? routineTrends : undefined,
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      {children}
    </div>
  )
}

interface Props {
  mode: 'new' | 'close' | 'edit'
  initial?: Trade
  config: JournalConfig
  routineReady?: boolean
  routineTrends?: TrendSnapshot
  onSave: () => void
  onCancel: () => void
}

export default function TradeEditor({ mode, initial, config, routineReady, routineTrends, onSave, onCancel }: Props) {
  const [t, setT] = useState<Trade>(() => (initial ? structuredClone(initial) : makeDraft(config, routineReady, routineTrends)))
  const set = (p: Partial<Trade>) => setT((prev) => ({ ...prev, ...p }))
  const num = (v: string) => (v === '' ? undefined : parseFloat(v))

  const rem = remainingUsd(t.positionUsd, t.closes)
  const [closeSize, setCloseSize] = useState<number | undefined>(() => rem ?? undefined)

  const preEditable = mode === 'new' || mode === 'edit'
  const isClose = mode === 'close'
  const showReflection = mode === 'close' || (mode === 'edit' && initial?.result != null)

  const rr = useMemo(() => plannedRR(t.entry, t.stopLoss, t.takeProfit), [t.entry, t.stopLoss, t.takeProfit])
  const riskUsd = useMemo(() => riskFromSize(t.positionUsd, t.entry, t.stopLoss), [t.positionUsd, t.entry, t.stopLoss])

  // metrics for the chunk being closed now
  const effSize = t.positionUsd != null ? (closeSize ?? rem ?? undefined) : undefined
  const chunk = useMemo(
    () => closeMetrics(t.entry, t.stopLoss, t.exit, t.direction, effSize),
    [t.entry, t.stopLoss, t.exit, t.direction, effSize],
  )
  const chunkRoe = chunk.pnlPercent != null && t.leverage ? +(chunk.pnlPercent * t.leverage).toFixed(2) : null

  const ckOk = t.checklist.length > 0 && t.checklist.every((c) => c.checked)
  const sizeOk = t.positionUsd == null || (closeSize != null && closeSize > 0 && rem != null && closeSize <= rem + 0.001)
  const canSave = isClose ? t.exit != null && t.exit > 0 && sizeOk : !!t.symbol && !!t.direction && t.entry != null
  const title = mode === 'new' ? 'ثبت معاملهٔ جدید' : isClose ? 'بستن معامله' : 'ویرایش معامله'

  const toggleCk = (id: string) =>
    set({ checklist: t.checklist.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)) })

  const refBias = t.routineTrendAtEntry?.[config.trendRefCadence]
  const trendCounter = trendAlignment(t.direction, refBias) === 'counter'

  const save = () => {
    if (isClose) {
      const exit = t.exit!
      const size = t.positionUsd != null ? closeSize ?? rem ?? 0 : 0
      const m = closeMetrics(t.entry, t.stopLoss, exit, t.direction, t.positionUsd != null ? size : undefined)
      const newClose: PartialClose = {
        id: crypto.randomUUID(),
        sizeUsd: size,
        exit,
        closedAt: new Date().toISOString(),
        rMultiple: m.rMultiple,
        pnlPercent: m.pnlPercent,
        pnlUsd: m.pnlUsd,
      }
      const closes = [...(t.closes || []), newClose]
      const agg = aggregateCloses(closes)
      const closedTotal = sumClosedSize(closes)
      const fullyClosed = t.positionUsd == null || t.positionUsd - closedTotal <= 0.01
      const next: Trade = {
        ...t,
        plannedRR: rr,
        riskUsd: riskUsd ?? undefined,
        closes,
        exit,
        rMultiple: agg.rMultiple,
        pnlPercent: agg.pnlPercent,
        pnlUsd: agg.pnlUsd,
        result: agg.result,
        status: fullyClosed ? 'archived' : 'open',
        closedAt: fullyClosed ? new Date().toISOString() : t.closedAt,
      }
      try { tradesRepo.save(next); onSave() } catch { alert('ذخیره نشد — احتمالاً حافظهٔ مرورگر پره. عکس‌ها رو سبک‌تر کن.') }
      return
    }
    try { tradesRepo.save({ ...t, plannedRR: rr, riskUsd: riskUsd ?? undefined }); onSave() } catch { alert('ذخیره نشد — احتمالاً حافظهٔ مرورگر پره. عکس‌ها رو سبک‌تر کن.') }
  }

  return (
    <div className="form">
      <div className="editor-head">
        <h2>{title}</h2>
        <button className="ghost" onClick={mode === 'new' ? () => setT(makeDraft(config, routineReady, routineTrends)) : onCancel}>
          {mode === 'new' ? 'پاک‌کردن' : 'انصراف'}
        </button>
      </div>

      {isClose && (
        <div className="card summary">
          <div className="srow">
            <span className={'pill ' + (t.direction === 'long' ? 'good' : 'bad')}>{t.symbol} {t.direction === 'long' ? '▲' : '▼'}</span>
            <span className="muted">{t.setup || '—'} · {t.session || '—'} · {t.timeframe || '—'}</span>
          </div>
          <div className="srow"><span className="muted">ورود / SL · اهرم</span><span>{t.entry ?? '—'} / {t.stopLoss ?? '—'} · {t.leverage != null ? t.leverage + 'x' : '—'}</span></div>
          {t.positionUsd != null && (
            <div className="srow"><span className="muted">حجم کل · باقی‌مونده</span><b>${t.positionUsd.toLocaleString('en-US')} · <span className="good">${(rem ?? 0).toLocaleString('en-US')}</span></b></div>
          )}
          {(t.closes?.length ?? 0) > 0 && (
            <div className="srow"><span className="muted">بسته‌شده تا حالا</span><span>{t.closes!.length} بار · {fmtUsd(t.pnlUsd)}</span></div>
          )}
        </div>
      )}

      {preEditable && (
        <div className="card">
          <h2>قبل از ورود <span className="tag">پلن</span></h2>
          <Field label="نماد"><ChipGroup options={config.symbols} value={t.symbol} onChange={(v) => set({ symbol: v as string })} /></Field>
          <Field label="جهت">
            <div className="chips dirbtns">
              <button type="button" data-dir="long" className={'chip' + (t.direction === 'long' ? ' active' : '')} onClick={() => set({ direction: 'long' })}>Long ▲</button>
              <button type="button" data-dir="short" className={'chip' + (t.direction === 'short' ? ' active' : '')} onClick={() => set({ direction: 'short' })}>Short ▼</button>
            </div>
          </Field>
          {trendCounter && refBias && (
            <div className="banner warn">⚠️ خلافِ ترندِ {CADENCE_FA[config.trendRefCadence]}ته ({BIAS_FA[refBias].icon} {BIAS_FA[refBias].label}) — مطمئنی؟</div>
          )}
          <Field label="سشن"><ChipGroup options={config.sessions} value={t.session} onChange={(v) => set({ session: v as string })} /></Field>
          <Field label="ستاپ"><ChipGroup options={config.setups} value={t.setup} onChange={(v) => set({ setup: v as string })} /></Field>
          <Field label="تایم‌فریم"><ChipGroup options={config.timeframes} value={t.timeframe} onChange={(v) => set({ timeframe: v as string })} /></Field>
          <Field label="قیمت‌ها">
            <div className="nums">
              <label>ورود<input type="number" inputMode="decimal" value={t.entry ?? ''} onChange={(e) => set({ entry: num(e.target.value) })} /></label>
              <label>حد ضرر<input type="number" inputMode="decimal" value={t.stopLoss ?? ''} onChange={(e) => set({ stopLoss: num(e.target.value) })} /></label>
              <label>حد سود<input type="number" inputMode="decimal" value={t.takeProfit ?? ''} onChange={(e) => set({ takeProfit: num(e.target.value) })} /></label>
            </div>
          </Field>
          <div className="rowbox"><span className="lbl" style={{ margin: 0 }}>R:R خودکار</span><span className="bigval">{rr ? rr + ' : 1' : '—'}</span></div>
          <Field label="ریسک ٪"><ChipGroup options={RISK_PERCENTS} value={t.riskPercent?.toString()} onChange={(v) => set({ riskPercent: v ? parseFloat(v as string) : undefined })} /></Field>
          <Field label="حجم پوزیشن ($)">
            <input type="number" inputMode="decimal" value={t.positionUsd ?? ''} onChange={(e) => set({ positionUsd: num(e.target.value) })} placeholder="مبلغ دلاری معامله (نوشِنال)" />
          </Field>
          {riskUsd != null && (
            <div className="rowbox"><span className="lbl" style={{ margin: 0 }}>ریسک به دلار (خودکار)</span><span className="bigval" style={{ color: 'var(--warn)' }}>${riskUsd.toLocaleString('en-US')}</span></div>
          )}
          <Field label="اهرم"><ChipGroup options={config.leverages} value={t.leverage?.toString()} onChange={(v) => set({ leverage: v ? parseFloat(v as string) : undefined })} /></Field>
          <Field label={`اطمینان: ${t.confidence}/5`}><input type="range" min={1} max={5} value={t.confidence} onChange={(e) => set({ confidence: +e.target.value })} /></Field>
          <Field label="حال روانی قبل از ورود"><ChipGroup options={MOODS_BEFORE} value={t.moodBefore} onChange={(v) => set({ moodBefore: v as string })} /></Field>
          {t.checklist.length > 0 && (
            <Field label="✅ چک‌لیست ورود">
              <div className="ck-list">
                {t.checklist.map((c) => (
                  <button key={c.id} type="button" className={'chip ck' + (c.checked ? ' active' : '')} onClick={() => toggleCk(c.id)}>
                    <span>{c.label}</span><span>{c.checked ? '✓' : '✗'}</span>
                  </button>
                ))}
              </div>
              {mode === 'new' && (
                <div className={'banner ' + (ckOk ? 'ok' : 'warn')}>
                  {ckOk ? '✅ آمادهٔ ورود — چک‌لیست کامله' : '⚠️ چک‌لیست کامل نیست — بهتره وارد نشی'}
                </div>
              )}
            </Field>
          )}
        </div>
      )}

      {isClose && (
        <div className="card">
          <h2>بستن <span className="tag">{t.positionUsd != null ? 'جزئی یا کامل' : 'نتیجه'}</span></h2>
          <Field label="قیمت خروج"><input type="number" inputMode="decimal" value={t.exit ?? ''} onChange={(e) => set({ exit: num(e.target.value) })} /></Field>
          {t.positionUsd != null && (
            <Field label={`حجم بستن ($) — باقی‌مونده: $${(rem ?? 0).toLocaleString('en-US')}`}>
              <div className="addrow">
                <input type="number" inputMode="decimal" value={closeSize ?? ''} onChange={(e) => setCloseSize(num(e.target.value))} placeholder="چقدر از حجم رو ببندم" />
                <button className="act" type="button" onClick={() => setCloseSize(rem ?? undefined)}>همه</button>
              </div>
            </Field>
          )}
          <div className="stats">
            <div className="stat"><div className="k">نتیجه</div><div className={'v ' + (chunk.result === 'win' ? 'good' : chunk.result === 'loss' ? 'bad' : '')}>{chunk.result ? (chunk.result === 'win' ? 'سود' : chunk.result === 'loss' ? 'ضرر' : 'سربه‌سر') : '—'}</div></div>
            <div className="stat"><div className="k">R</div><div className="v">{chunk.rMultiple != null ? (chunk.rMultiple > 0 ? '+' : '') + chunk.rMultiple : '—'}</div></div>
            <div className="stat"><div className="k">P/L ٪</div><div className="v">{chunk.pnlPercent != null ? (chunk.pnlPercent > 0 ? '+' : '') + chunk.pnlPercent + '%' : '—'}</div></div>
          </div>
          <div className="rowbox">
            <span className="lbl" style={{ margin: 0 }}>سود/ضرر این بستن</span>
            <span className={'bigval ' + (chunk.pnlUsd != null ? (chunk.pnlUsd >= 0 ? 'good' : 'bad') : '')}>{chunk.pnlUsd != null ? fmtUsd(chunk.pnlUsd) : '— (حجم رو بزن)'}</span>
          </div>
          {chunkRoe != null && (
            <div className="rowbox"><span className="lbl" style={{ margin: 0 }}>بازده با اهرم ({t.leverage}x)</span><span className={'bigval ' + (chunkRoe >= 0 ? 'good' : 'bad')}>{(chunkRoe > 0 ? '+' : '') + chunkRoe}%</span></div>
          )}
        </div>
      )}

      {showReflection && (
        <div className="card">
          <h2>مرور</h2>
          {mode === 'edit' && (
            <div className="rowbox"><span className="lbl" style={{ margin: 0 }}>نتیجهٔ کل</span><span className={'bigval ' + (t.result === 'win' ? 'good' : t.result === 'loss' ? 'bad' : '')}>{t.rMultiple != null ? (t.rMultiple > 0 ? '+' : '') + t.rMultiple + 'R' : '—'} · {fmtUsd(t.pnlUsd)}</span></div>
          )}
          <Field label="پایبند به پلن بودی؟">
            <div className="chips">
              <button type="button" className={'chip' + (t.followedPlan === true ? ' active' : '')} onClick={() => set({ followedPlan: true })}>بله</button>
              <button type="button" className={'chip' + (t.followedPlan === false ? ' active' : '')} onClick={() => set({ followedPlan: false })}>خیر</button>
            </div>
          </Field>
          <Field label="اشتباهات (چندتایی)"><ChipGroup multi options={MISTAKES} value={t.mistakes} onChange={(v) => set({ mistakes: v as string[] })} /></Field>
          <Field label="چی خوب بود (چندتایی)"><ChipGroup multi options={DID_WELL} value={t.didWell} onChange={(v) => set({ didWell: v as string[] })} /></Field>
          <Field label="حال روانی حین/بعد"><ChipGroup options={MOODS_AFTER} value={t.moodAfter} onChange={(v) => set({ moodAfter: v as string })} /></Field>
          <Field label="درس امروز (اختیاری)"><input type="text" value={t.lesson ?? ''} onChange={(e) => set({ lesson: e.target.value })} placeholder="یک خط، اگه خواستی" /></Field>
          <Field label="اسکرین‌شات چارت">
            {t.screenshot ? (
              <div className="shot-edit">
                <img src={t.screenshot} alt="چارت" />
                <button type="button" className="ghost" onClick={() => set({ screenshot: undefined })}>حذف عکس</button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    try {
                      set({ screenshot: await compressImage(f) })
                    } catch {
                      alert('عکس بارگذاری نشد.')
                    }
                  }
                }}
              />
            )}
          </Field>
        </div>
      )}

      <button className="save" disabled={!canSave} onClick={save}>
        {mode === 'new' ? 'ذخیرهٔ معاملهٔ باز' : isClose ? (t.positionUsd != null && rem != null && closeSize != null && closeSize < rem - 0.01 ? 'ثبت بستن جزئی' : 'بستن کامل') : 'ذخیرهٔ تغییرات'}
      </button>
    </div>
  )
}
