import { useMemo, useState } from 'react'
import type { Trade } from '../types'
import {
  closedTrades,
  byPeriod,
  processBuckets,
  costliestMistakes,
  leakTrades,
  monthlyCount,
  byConfidence,
  byField,
  gradeOf,
  scoreSeries,
  planSplit,
  startOfWeekKey,
  type GroupStat,
  type ScorePoint,
} from '../lib/stats'
import { fmtUsd } from '../lib/time'
import { reviewsRepo, focusText, type FocusScore } from '../lib/reviews'
import { tradesRepo, type JournalConfig } from '../lib/repo'
import { IF_TRIGGERS, THEN_ACTIONS } from '../config'
import ChipGroup from './ChipGroup'

function TradeRow({ t, onClick }: { t: Trade; onClick: () => void }) {
  return (
    <div className="trade" onClick={onClick}>
      <div className="trade-main">
        <span className={'pill ' + (t.direction === 'long' ? 'good' : 'bad')}>{t.symbol} {t.direction === 'long' ? '▲' : '▼'}</span>
        <span className="muted">{t.setup || '—'} · {t.session || '—'}</span>
      </div>
      <div className="trade-side">
        <span className={'pill ' + (t.result === 'win' ? 'good' : t.result === 'loss' ? 'bad' : '')}>
          {t.rMultiple != null ? (t.rMultiple > 0 ? '+' : '') + t.rMultiple + 'R' : '—'}
        </span>
      </div>
    </div>
  )
}

function CalTable({ rows }: { rows: GroupStat[] }) {
  if (!rows.length) return <div className="muted">داده‌ای نیست.</div>
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.key}>
          <div className="bar-key">{r.key} <span className="muted">({r.count})</span></div>
          <div className="bar-track"><div className={'bar-fill ' + (r.avgR >= 0 ? 'good-bg' : 'bad-bg')} style={{ width: Math.min(100, r.winRate) + '%' }} /></div>
          <div className="bar-val">{r.winRate}% · {r.avgR > 0 ? '+' : ''}{r.avgR}R</div>
        </div>
      ))}
    </div>
  )
}

const SCORE_LABELS: Record<FocusScore, string> = { kept: 'رعایت شد ✅', partial: 'تا حدی 〰', missed: 'نشد ✗' }

function WeeklyLoop({ trades, groups }: { trades: Trade[]; groups: ReturnType<typeof byPeriod> }) {
  const [, setRv] = useState(0)
  const bump = () => setRv((v) => v + 1)
  const nowIso = new Date().toISOString()
  const rawCur = startOfWeekKey(nowIso)
  const rawPrev = startOfWeekKey(new Date(Date.now() - 7 * 864e5).toISOString())
  // week entries are namespaced ('w:') so a Saturday daily note can't collide with the week's rule
  const curKey = 'w:' + rawCur
  const prevKey = 'w:' + rawPrev
  const prevEntry = reviewsRepo.get(prevKey)
  const curEntry = reviewsRepo.get(curKey)
  const prevRule = focusText(prevEntry)

  const weekStats = (key: string) => {
    const g = groups.find((x) => x.key === key)
    if (!g) return null
    return {
      mistakes: g.trades.reduce((s, t) => s + (t.mistakes?.length ?? 0), 0),
      adherence: planSplit(g.trades).adherence,
      totalR: g.summary.totalR,
    }
  }
  const prevW = weekStats(rawPrev)
  const curW = weekStats(rawCur)

  return (
    <>
      {prevRule && (
        <div className="card loop-card">
          <h2>🔁 حلقهٔ هفتهٔ قبل</h2>
          <p className="loop-rule">{prevRule}</p>
          {(prevW || curW) && (
            <div className="loop-compare muted">
              خطاها: {prevW?.mistakes ?? '—'} ← {curW?.mistakes ?? '—'} · پایبندی: {prevW?.adherence != null ? prevW.adherence + '%' : '—'} ← {curW?.adherence != null ? curW.adherence + '%' : '—'}
            </div>
          )}
          {prevEntry.score ? (
            <p className="muted" style={{ margin: 0 }}>نتیجهٔ خودارزیابی: <b>{SCORE_LABELS[prevEntry.score]}</b></p>
          ) : (
            <>
              <div className="lbl">چقدر رعایتش کردی؟ (یک تپ)</div>
              <div className="chips">
                {(Object.keys(SCORE_LABELS) as FocusScore[]).map((k) => (
                  <button key={k} className="chip" onClick={() => { reviewsRepo.setEntry(prevKey, { score: k }); bump() }}>
                    {SCORE_LABELS[k]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2>🎯 قانون این هفته <span className="tag">اگر… آنگاه…</span></h2>
        <div className="lbl">اگر…</div>
        <ChipGroup options={IF_TRIGGERS} value={curEntry.if} onChange={(v) => { reviewsRepo.setEntry(curKey, { if: v as string | undefined }); bump() }} />
        <div className="lbl" style={{ marginTop: 10 }}>آنگاه…</div>
        <ChipGroup options={THEN_ACTIONS} value={curEntry.then} onChange={(v) => { reviewsRepo.setEntry(curKey, { then: v as string | undefined }); bump() }} />
        {curEntry.if && curEntry.then && (
          <div className="banner ok" style={{ marginTop: 10 }}>✅ اگر {curEntry.if}، آنگاه {curEntry.then}</div>
        )}
        <p className="muted hint" style={{ marginBottom: 0 }}>هفتهٔ بعد همین‌جا ازت می‌پرسم چقدر رعایتش کردی.</p>
      </div>
    </>
  )
}

function PeriodReview({ trades }: { trades: Trade[] }) {
  const [unit, setUnit] = useState<'week' | 'day'>('week')
  const groups = useMemo(() => byPeriod(trades, unit), [trades, unit])
  return (
    <>
      <div className="rangebar">
        <button className={'chip' + (unit === 'week' ? ' active' : '')} onClick={() => setUnit('week')}>هفتگی</button>
        <button className={'chip' + (unit === 'day' ? ' active' : '')} onClick={() => setUnit('day')}>روزانه</button>
      </div>
      {unit === 'week' && <WeeklyLoop trades={trades} groups={groups} />}
      {groups.length === 0 && <div className="card"><p className="muted" style={{ textAlign: 'center', padding: 10 }}>معاملهٔ بسته‌ای نیست.</p></div>}
      {groups.map((g) => (
        <div className="card" key={g.key}>
          <div className="srow"><b>{g.label}</b><span className="muted">{g.summary.closed} معامله</span></div>
          <div className="stats" style={{ marginTop: 8 }}>
            <div className="stat"><div className="k">نرخ برد</div><div className="v">{g.summary.winRate}%</div></div>
            <div className="stat"><div className="k">R</div><div className={'v ' + (g.summary.totalR >= 0 ? 'good' : 'bad')}>{g.summary.totalR > 0 ? '+' : ''}{g.summary.totalR}</div></div>
            <div className="stat"><div className="k">$</div><div className={'v ' + (g.summary.totalUsd >= 0 ? 'good' : 'bad')}>{g.summary.hasUsd ? fmtUsd(g.summary.totalUsd) : '—'}</div></div>
          </div>
          {g.topMistake && <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>بدترین نشت: <span className="bad">{g.topMistake}</span></p>}
          <input className="focus-input" type="text" placeholder="تمرکز این دوره / درس کلیدی…" defaultValue={reviewsRepo.getFocus((unit === 'week' ? 'w:' : 'd:') + g.key)} onBlur={(e) => reviewsRepo.setFocus((unit === 'week' ? 'w:' : 'd:') + g.key, e.target.value)} />
        </div>
      ))}
    </>
  )
}

function Flashcard({ trades, onChange, onSelectTrade }: { trades: Trade[]; onChange: () => void; onSelectTrade: (id: string) => void }) {
  const [filter, setFilter] = useState<string>('unreviewed')
  const mistakeTags = useMemo(() => costliestMistakes(trades).map((m) => m.tag), [trades])
  const deck = useMemo(() => {
    let d = closedTrades(trades)
    if (filter === 'unreviewed') d = d.filter((t) => !t.reviewed)
    else if (filter !== 'all') d = d.filter((t) => (t.mistakes || []).includes(filter))
    return d.sort((a, b) => (b.closedAt || b.openedAt).localeCompare(a.closedAt || a.openedAt))
  }, [trades, filter])
  const [i, setI] = useState(0)
  const idx = Math.min(i, Math.max(0, deck.length - 1))
  const t = deck[idx]

  const setGrade = (g: 'A' | 'B' | 'C') => {
    if (!t) return
    tradesRepo.save({ ...t, grade: g, reviewed: true })
    onChange()
  }

  return (
    <>
      <div className="filterbar">
        <button className={'chip' + (filter === 'unreviewed' ? ' active' : '')} onClick={() => { setFilter('unreviewed'); setI(0) }}>مرورنشده</button>
        <button className={'chip' + (filter === 'all' ? ' active' : '')} onClick={() => { setFilter('all'); setI(0) }}>همه</button>
        <select value={mistakeTags.includes(filter) ? filter : ''} onChange={(e) => { setFilter(e.target.value || 'all'); setI(0) }}>
          <option value="">یه اشتباه…</option>
          {mistakeTags.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {!t ? (
        <div className="card"><p className="muted" style={{ textAlign: 'center', padding: 16 }}>چیزی برای مرور نیست — همه‌چی مرور شده 👏</p></div>
      ) : (
        <>
          <div className="card flash">
            <div className="srow">
              <span className={'pill ' + (t.direction === 'long' ? 'good' : 'bad')}>{t.symbol} {t.direction === 'long' ? '▲' : '▼'}</span>
              <span className="muted">{t.setup || '—'} · {t.session || '—'} · {t.timeframe || '—'}</span>
            </div>
            <div className="stats" style={{ marginTop: 10 }}>
              <div className="stat"><div className="k">نتیجه</div><div className={'v ' + (t.result === 'win' ? 'good' : t.result === 'loss' ? 'bad' : '')}>{t.result === 'win' ? 'سود' : t.result === 'loss' ? 'ضرر' : 'سربه‌سر'}</div></div>
              <div className="stat"><div className="k">R</div><div className="v">{t.rMultiple != null ? (t.rMultiple > 0 ? '+' : '') + t.rMultiple : '—'}</div></div>
              <div className="stat"><div className="k">$</div><div className={'v ' + ((t.pnlUsd ?? 0) >= 0 ? 'good' : 'bad')}>{fmtUsd(t.pnlUsd)}</div></div>
            </div>
            {t.screenshot && <img className="flash-shot" src={t.screenshot} alt="چارت" onClick={() => onSelectTrade(t.id)} />}
            {(t.mistakes?.length ?? 0) > 0 && <div className="chips wrap" style={{ marginTop: 8 }}>{t.mistakes.map((m) => <span key={m} className="pill bad">{m}</span>)}</div>}
            {(t.didWell?.length ?? 0) > 0 && <div className="chips wrap" style={{ marginTop: 6 }}>{t.didWell.map((m) => <span key={m} className="pill good">{m}</span>)}</div>}
            {t.lesson && <p className="muted" style={{ marginTop: 8 }}>درس: {t.lesson}</p>}

            <div className="lbl" style={{ marginTop: 12 }}>نمرهٔ اجرا (چقدر طبق پلن بود؟)</div>
            <div className="grade-btns">
              {(['A', 'B', 'C'] as const).map((g) => (
                <button key={g} className={'gbtn g-' + g + (gradeOf(t) === g ? ' active' : '')} onClick={() => setGrade(g)}>{g}</button>
              ))}
            </div>
            <input key={t.id} className="focus-input" type="text" placeholder="یادداشت مرور (اختیاری)…" defaultValue={t.reviewNote || ''} onBlur={(e) => { tradesRepo.save({ ...t, reviewNote: e.target.value }); onChange() }} />
            <button className="ghost" style={{ marginTop: 8 }} onClick={() => onSelectTrade(t.id)}>دیدن جزئیات کامل</button>
          </div>

          <div className="flash-nav">
            <button className="act" disabled={idx <= 0} onClick={() => setI(idx - 1)}>قبلی</button>
            <span className="muted">{idx + 1} / {deck.length}</span>
            <button className="act" disabled={idx >= deck.length - 1} onClick={() => setI(idx + 1)}>بعدی</button>
          </div>
        </>
      )}
    </>
  )
}

function ScoreTrend({ points }: { points: ScorePoint[] }) {
  const data = points.slice(-30)
  if (data.length < 2) return null
  const w = 300, h = 60, pad = 4
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2)
  const y = (s: number) => h - pad - (s / 100) * (h - pad * 2)
  const pts = data.map((p, i) => `${x(i)},${y(p.score)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <line x1="0" y1={y(70)} x2={w} y2={y(70)} stroke="#2a2f3a" strokeWidth="1" strokeDasharray="4 4" />
      <polyline points={pts} fill="none" stroke="#4f8cff" strokeWidth="2" />
    </svg>
  )
}

function ScoreScatter({ points }: { points: ScorePoint[] }) {
  if (points.length < 5) {
    return <div className="muted">برای نمودار نمره-نتیجه حداقل ۵ معاملهٔ بسته لازمه.</div>
  }
  const w = 300, h = 150, pad = 12
  const rMin = -3, rMax = 5
  const x = (s: number) => pad + (Math.min(100, Math.max(0, s)) / 100) * (w - pad * 2)
  const y = (r: number) => {
    const rc = Math.min(rMax, Math.max(rMin, r))
    return h - pad - ((rc - rMin) / (rMax - rMin)) * (h - pad * 2)
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <line x1={pad} y1={y(0)} x2={w - pad} y2={y(0)} stroke="#2a2f3a" strokeWidth="1" />
      {points.map((p, i) => (
        <circle key={i} cx={x(p.score)} cy={y(p.r)} r="4" fill={p.r >= 0 ? '#2fbf71' : '#ff5c5c'} fillOpacity="0.8" />
      ))}
    </svg>
  )
}

function ScoreCard({ trades, riskCap }: { trades: Trade[]; riskCap: number }) {
  const series = useMemo(() => scoreSeries(trades, riskCap), [trades, riskCap])
  const now = Date.now()
  const wk = 7 * 864e5
  const avg = (l: ScorePoint[]) => (l.length ? Math.round(l.reduce((s, p) => s + p.score, 0) / l.length) : null)
  const last7 = series.filter((p) => now - new Date(p.when).getTime() < wk)
  const prev7 = series.filter((p) => {
    const age = now - new Date(p.when).getTime()
    return age >= wk && age < 2 * wk
  })
  const a7 = avg(last7)
  const aPrev = avg(prev7)
  const aAll = avg(series)
  const delta = a7 != null && aPrev != null ? a7 - aPrev : null

  if (!series.length) {
    return (
      <div className="card">
        <h2>نمرهٔ اجرا <span className="tag">۰ تا ۱۰۰</span></h2>
        <p className="muted" style={{ margin: 0 }}>بعد از بستن چند معامله فعال می‌شه.</p>
      </div>
    )
  }
  return (
    <div className="card">
      <h2>نمرهٔ اجرا <span className="tag">۰ تا ۱۰۰ · جدا از نتیجه</span></h2>
      <div className="stats">
        <div className="stat"><div className="k">۷ روز اخیر</div><div className={'v ' + (a7 != null && a7 >= 70 ? 'good' : a7 != null && a7 < 50 ? 'bad' : '')}>{a7 ?? '—'}</div></div>
        <div className="stat"><div className="k">نسبت به هفتهٔ قبل</div><div className={'v ' + (delta != null ? (delta >= 0 ? 'good' : 'bad') : '')}>{delta != null ? (delta > 0 ? '+' : '') + delta : '—'}</div></div>
        <div className="stat"><div className="k">میانگین کل</div><div className="v">{aAll}</div></div>
      </div>
      <div className="lbl">روند نمره (هر نقطه یک معامله، خط‌چین = ۷۰)</div>
      <ScoreTrend points={series} />
      <div className="lbl" style={{ marginTop: 10 }}>نمره (از چپ ۰ تا راست ۱۰۰) در برابر R — ثابت می‌کنه اجرای تمیز پول می‌سازه</div>
      <ScoreScatter points={series} />
      <p className="muted hint" style={{ marginBottom: 0 }}>
        فرمول: ۳۰٪ چک‌لیست + ۳۰٪ پایبندی به پلن + ۲۰٪ ریسک ≤ {riskCap}٪ + ۲۰٪ بدون خطا
      </p>
    </div>
  )
}

function ProcessReview({ trades, onSelectTrade, riskCap }: { trades: Trade[]; onSelectTrade: (id: string) => void; riskCap: number }) {
  const b = useMemo(() => processBuckets(trades), [trades])
  const dist = useMemo(() => {
    const d = { A: 0, B: 0, C: 0 }
    closedTrades(trades).forEach((t) => { d[gradeOf(t)]++ })
    return d
  }, [trades])
  return (
    <>
      <ScoreCard trades={trades} riskCap={riskCap} />
      <div className="card">
        <h2>توزیع نمرهٔ A/B/C</h2>
        <div className="stats">
          <div className="stat"><div className="k">A تمیز</div><div className="v good">{dist.A}</div></div>
          <div className="stat"><div className="k">B</div><div className="v">{dist.B}</div></div>
          <div className="stat"><div className="k">C ضعیف</div><div className="v bad">{dist.C}</div></div>
        </div>
      </div>
      <div className="card">
        <h2>🟥 بُردهای بد <span className="tag">سود ولی قانون‌شکنی</span></h2>
        <p className="muted hint">این‌ها خطرناک‌ان: شانس آوردی، عادت بد جا می‌افته.</p>
        {b.badWins.length === 0 ? <div className="muted">نداری 👌</div> : b.badWins.map((t) => <TradeRow key={t.id} t={t} onClick={() => onSelectTrade(t.id)} />)}
      </div>
      <div className="card">
        <h2>🟩 باخت‌های خوب <span className="tag">پلن درست ولی ضرر</span></h2>
        <p className="muted hint">این‌ها خوبن: درست عمل کردی، ضررش طبیعی بازاره.</p>
        {b.goodLosses.length === 0 ? <div className="muted">نداری</div> : b.goodLosses.map((t) => <TradeRow key={t.id} t={t} onClick={() => onSelectTrade(t.id)} />)}
      </div>
    </>
  )
}

function LeaksReview({ trades, onSelectTrade }: { trades: Trade[]; onSelectTrade: (id: string) => void }) {
  const mistakes = useMemo(() => costliestMistakes(trades), [trades])
  const [sel, setSel] = useState<string | null>(null)

  if (sel) {
    const list = leakTrades(trades, sel)
    const months = monthlyCount(list)
    const totalR = +list.reduce((s, t) => s + (t.rMultiple || 0), 0).toFixed(2)
    const totalUsd = +list.reduce((s, t) => s + (t.pnlUsd || 0), 0).toFixed(2)
    return (
      <>
        <div className="editor-head"><h2>نشت: {sel}</h2><button className="ghost" onClick={() => setSel(null)}>همهٔ نشت‌ها</button></div>
        <div className="card">
          <div className="stats">
            <div className="stat"><div className="k">تعداد</div><div className="v">{list.length}</div></div>
            <div className="stat"><div className="k">R کل</div><div className={'v ' + (totalR >= 0 ? 'good' : 'bad')}>{totalR > 0 ? '+' : ''}{totalR}</div></div>
            <div className="stat"><div className="k">$ کل</div><div className={'v ' + (totalUsd >= 0 ? 'good' : 'bad')}>{fmtUsd(totalUsd)}</div></div>
          </div>
          {months.length > 0 && (
            <div className="bars" style={{ marginTop: 10 }}>
              <div className="lbl">روند ماهانه</div>
              {months.map((m) => (
                <div className="bar-row" key={m.month}>
                  <div className="bar-key">{m.month}</div>
                  <div className="bar-track"><div className="bar-fill bad-bg" style={{ width: Math.min(100, m.count * 20) + '%' }} /></div>
                  <div className="bar-val">{m.count}×</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {list.map((t) => <TradeRow key={t.id} t={t} onClick={() => onSelectTrade(t.id)} />)}
      </>
    )
  }

  return (
    <div className="card">
      <h2>🔍 نشت‌ها</h2>
      <p className="muted hint">رو هر اشتباه بزن تا معامله‌هاش و روندش رو ببینی.</p>
      {mistakes.length === 0 ? <div className="muted">اشتباهی تگ نشده 👌</div> : (
        <div className="bars">
          {mistakes.map((m) => (
            <div className="bar-row leak" key={m.tag} onClick={() => setSel(m.tag)}>
              <div className="bar-key">{m.tag} <span className="muted">({m.count}×)</span></div>
              <div className={'bar-val ' + (m.totalR < 0 ? 'bad' : 'good')}>{m.totalR > 0 ? '+' : ''}{m.totalR}R</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Calibration({ trades }: { trades: Trade[] }) {
  const conf = useMemo(() => byConfidence(trades), [trades])
  const mood = useMemo(() => byField(trades, 'moodBefore'), [trades])
  return (
    <>
      <div className="card"><h2>🧠 اطمینان</h2><p className="muted hint">وقتی مطمئن‌تری واقعاً بهتر معامله می‌کنی؟</p><CalTable rows={conf} /></div>
      <div className="card"><h2>😌 حال روانی قبل از ورود</h2><p className="muted hint">با کدوم حال بهتر/بدتر معامله می‌کنی؟</p><CalTable rows={mood} /></div>
    </>
  )
}

const TITLES: Record<string, string> = {
  period: 'بازبینی دوره‌ای',
  flashcard: 'فلش‌کارت',
  process: 'کیفیت اجرا',
  leaks: 'نشت‌ها',
  calibration: 'کالیبراسیون',
}

type View = 'hub' | 'period' | 'flashcard' | 'process' | 'leaks' | 'calibration'

export default function Review({ trades, config, onChange, onSelectTrade }: { trades: Trade[]; config: JournalConfig; onChange: () => void; onSelectTrade: (id: string) => void }) {
  const [view, setView] = useState<View>('hub')
  const unreviewed = useMemo(() => closedTrades(trades).filter((t) => !t.reviewed).length, [trades])

  if (view === 'hub') {
    const items: { k: View; t: string; d: string }[] = [
      { k: 'period', t: '🗓 بازبینی هفتگی/روزانه', d: 'خلاصهٔ دوره + تمرکز بعدی' },
      { k: 'flashcard', t: '🔁 فلش‌کارت', d: unreviewed > 0 ? `${unreviewed} معاملهٔ مرورنشده` : 'همه مرور شده 👏' },
      { k: 'process', t: '🎯 کیفیت اجرا', d: 'بُرد بد / باخت خوب' },
      { k: 'leaks', t: '🔍 نشت‌ها', d: 'دریل رو اشتباه‌ها + روند' },
      { k: 'calibration', t: '🧠 کالیبراسیون', d: 'اطمینان و حال روانی' },
    ]
    return (
      <div className="review">
        {items.map((it) => (
          <button className="review-item" key={it.k} onClick={() => setView(it.k)}>
            <span className="ri-title">{it.t}</span>
            <span className="ri-desc muted">{it.d}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="review">
      <div className="editor-head">
        <h2>{TITLES[view]}</h2>
        <button className="ghost" onClick={() => setView('hub')}>منوی مرور</button>
      </div>
      {view === 'period' && <PeriodReview trades={trades} />}
      {view === 'flashcard' && <Flashcard trades={trades} onChange={onChange} onSelectTrade={onSelectTrade} />}
      {view === 'process' && <ProcessReview trades={trades} onSelectTrade={onSelectTrade} riskCap={config.maxRiskPercent} />}
      {view === 'leaks' && <LeaksReview trades={trades} onSelectTrade={onSelectTrade} />}
      {view === 'calibration' && <Calibration trades={trades} />}
    </div>
  )
}
