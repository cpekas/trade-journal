import { useMemo, useState } from 'react'
import type { Trade } from '../types'
import { summarize, byField, costliestMistakes, equityCurve, planSplit, routineSplit, trendSplit, type GroupStat } from '../lib/stats'
import { fmtUsd } from '../lib/time'
import { CADENCE_FA } from '../config'
import type { Cadence } from '../lib/repo'

function Spark({ data }: { data: number[] }) {
  if (data.length < 2) {
    return <div className="muted" style={{ padding: '8px 0' }}>برای نمودار حداقل ۲ معاملهٔ بسته لازمه.</div>
  }
  const w = 300, h = 70, pad = 4
  const min = Math.min(0, ...data)
  const max = Math.max(0, ...data)
  const range = max - min || 1
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2)
  const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2)
  const pts = data.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const last = data[data.length - 1]
  const color = last >= 0 ? '#2fbf71' : '#ff5c5c'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <line x1="0" y1={y(0)} x2={w} y2={y(0)} stroke="#2a2f3a" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  )
}

function Bars({ rows }: { rows: GroupStat[] }) {
  if (!rows.length) return <div className="muted">داده‌ای نیست.</div>
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.totalR)), 1)
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.key}>
          <div className="bar-key">{r.key} <span className="muted">({r.count}، {r.winRate}%)</span></div>
          <div className="bar-track">
            <div className={'bar-fill ' + (r.totalR >= 0 ? 'good-bg' : 'bad-bg')} style={{ width: (Math.abs(r.totalR) / maxAbs) * 100 + '%' }} />
          </div>
          <div className={'bar-val ' + (r.totalR >= 0 ? 'good' : 'bad')}>{r.totalR > 0 ? '+' : ''}{r.totalR}R</div>
        </div>
      ))}
    </div>
  )
}

type Range = 'day' | 'week' | 'month' | 'all'
const RANGE_MS: Record<Range, number> = { day: 864e5, week: 7 * 864e5, month: 30 * 864e5, all: Infinity }
const RANGE_LABEL: Record<Range, string> = { day: 'روز', week: 'هفته', month: 'ماه', all: 'کل' }

export default function Dashboard({ trades, trendRef }: { trades: Trade[]; trendRef: Cadence }) {
  const [range, setRange] = useState<Range>('all')

  const filtered = useMemo(() => {
    if (range === 'all') return trades
    const cutoff = Date.now() - RANGE_MS[range]
    return trades.filter((t) => t.closedAt && new Date(t.closedAt).getTime() >= cutoff)
  }, [trades, range])

  const s = useMemo(() => summarize(filtered), [filtered])
  const plan = useMemo(() => planSplit(filtered), [filtered])
  const routine = useMemo(() => routineSplit(filtered), [filtered])
  const trend = useMemo(() => trendSplit(filtered, trendRef), [filtered, trendRef])
  const bySetup = useMemo(() => byField(filtered, 'setup'), [filtered])
  const bySession = useMemo(() => byField(filtered, 'session'), [filtered])
  const mistakes = useMemo(() => costliestMistakes(filtered), [filtered])
  const eq = useMemo(() => equityCurve(filtered), [filtered])

  return (
    <div className="dash">
      <div className="rangebar">
        {(['day', 'week', 'month', 'all'] as Range[]).map((rk) => (
          <button key={rk} className={'chip' + (range === rk ? ' active' : '')} onClick={() => setRange(rk)}>
            {RANGE_LABEL[rk]}
          </button>
        ))}
      </div>

      {s.closed === 0 ? (
        <div className="card">
          <p className="muted" style={{ textAlign: 'center', padding: 10 }}>تو این بازه معاملهٔ بسته‌شده‌ای نیست.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <h2>خلاصه <span className="tag">{s.closed} معاملهٔ بسته</span></h2>
            <div className="stats">
              <div className="stat"><div className="k">نرخ برد</div><div className="v">{s.winRate}%</div></div>
              <div className="stat"><div className="k">میانگین R</div><div className={'v ' + (s.avgR >= 0 ? 'good' : 'bad')}>{s.avgR > 0 ? '+' : ''}{s.avgR}</div></div>
              <div className="stat"><div className="k">مجموع R</div><div className={'v ' + (s.totalR >= 0 ? 'good' : 'bad')}>{s.totalR > 0 ? '+' : ''}{s.totalR}</div></div>
            </div>
            <div className="stats">
              <div className="stat"><div className="k">Profit Factor</div><div className="v">{s.profitFactor ?? '∞'}</div></div>
              <div className="stat"><div className="k">بهترین</div><div className="v good">+{s.bestR}R</div></div>
              <div className="stat"><div className="k">بدترین</div><div className="v bad">{s.worstR}R</div></div>
            </div>
            {s.hasUsd && (
              <div className="rowbox" style={{ marginTop: 4, marginBottom: 0 }}>
                <span className="lbl" style={{ margin: 0 }}>سود/ضرر کل به دلار</span>
                <span className={'bigval ' + (s.totalUsd >= 0 ? 'good' : 'bad')}>{fmtUsd(s.totalUsd)}</span>
              </div>
            )}
          </div>

          <div className="card">
            <h2>🎯 پایبندی به پلن <span className="tag">عدد اصلی</span></h2>
            {plan.adherence == null ? (
              <p className="muted hint" style={{ margin: 0 }}>
                موقع بستن معامله، «پایبند به پلن بودی؟» رو جواب بده تا این کارت فعال شه.
              </p>
            ) : (
              <>
                <div className="adherence-big">
                  <span className={'bigval ' + (plan.adherence >= 85 ? 'good' : plan.adherence >= 60 ? '' : 'bad')}>{plan.adherence}%</span>
                  <span className="muted">از {plan.total} معاملهٔ جواب‌داده</span>
                </div>
                <div className="plan-split">
                  <div className="plan-side good-side">
                    <div className="ps-title">طبق پلن ({plan.followed.count})</div>
                    <div className="ps-main">{plan.followed.avgR > 0 ? '+' : ''}{plan.followed.avgR}R<span className="muted"> / معامله</span></div>
                    <div className="muted">{plan.followed.winRate}% برد · {plan.followed.totalR > 0 ? '+' : ''}{plan.followed.totalR}R کل</div>
                  </div>
                  <div className="plan-side bad-side">
                    <div className="ps-title">خلاف پلن ({plan.broken.count})</div>
                    <div className="ps-main">{plan.broken.avgR > 0 ? '+' : ''}{plan.broken.avgR}R<span className="muted"> / معامله</span></div>
                    <div className="muted">{plan.broken.winRate}% برد · {plan.broken.totalR > 0 ? '+' : ''}{plan.broken.totalR}R کل</div>
                  </div>
                </div>
                {plan.broken.count > 0 && plan.broken.totalR < 0 && (
                  <p className="verdict bad">
                    معامله‌های خلاف پلن تو این بازه {plan.broken.totalR}R{plan.broken.totalUsd ? ` (${fmtUsd(plan.broken.totalUsd)})` : ''} هزینه داشتن.
                  </p>
                )}
                {plan.total < 20 && <p className="muted hint" style={{ marginBottom: 0 }}>نمونه هنوز کمه (n&lt;20) — به‌عنوان فرضیه نگاهش کن، نه نتیجه.</p>}
              </>
            )}
          </div>

          <div className="card">
            <h2>🧭 اجرای روتین قبل از ورود <span className="tag">با روتین در برابر بدون</span></h2>
            {routine.adherence == null ? (
              <p className="muted hint" style={{ margin: 0 }}>
                موقع ثبت معامله، آماده‌بودن روتین ثبت می‌شه — بعد از چند معامله فعال می‌شه.
              </p>
            ) : (
              <>
                <div className="adherence-big">
                  <span className={'bigval ' + (routine.adherence >= 85 ? 'good' : routine.adherence >= 60 ? '' : 'bad')}>{routine.adherence}%</span>
                  <span className="muted">از {routine.total} معامله با روتین کامل وارد شدی</span>
                </div>
                <div className="plan-split">
                  <div className="plan-side good-side">
                    <div className="ps-title">با روتین کامل ({routine.followed.count})</div>
                    <div className="ps-main">{routine.followed.avgR > 0 ? '+' : ''}{routine.followed.avgR}R<span className="muted"> / معامله</span></div>
                    <div className="muted">{routine.followed.winRate}% برد · {routine.followed.totalR > 0 ? '+' : ''}{routine.followed.totalR}R کل</div>
                  </div>
                  <div className="plan-side bad-side">
                    <div className="ps-title">بدون روتین کامل ({routine.broken.count})</div>
                    <div className="ps-main">{routine.broken.avgR > 0 ? '+' : ''}{routine.broken.avgR}R<span className="muted"> / معامله</span></div>
                    <div className="muted">{routine.broken.winRate}% برد · {routine.broken.totalR > 0 ? '+' : ''}{routine.broken.totalR}R کل</div>
                  </div>
                </div>
                {routine.broken.count > 0 && routine.broken.totalR < 0 && (
                  <p className="verdict bad">
                    ورود بدون روتینِ کامل تو این بازه {routine.broken.totalR}R{routine.broken.totalUsd ? ` (${fmtUsd(routine.broken.totalUsd)})` : ''} هزینه داشته.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="card">
            <h2>🧭 هم‌جهت با ترندِ {CADENCE_FA[trendRef]} <span className="tag">روتین در برابر جهت</span></h2>
            {trend.alignedRate == null ? (
              <p className="muted hint" style={{ margin: 0 }}>
                موقع ثبت معامله، ترندِ روتینت ذخیره می‌شه — بعد از چند معاملهٔ جهت‌دار این‌جا فعال می‌شه.
              </p>
            ) : (
              <>
                <div className="adherence-big">
                  <span className={'bigval ' + (trend.alignedRate >= 60 ? 'good' : 'bad')}>{trend.alignedRate}%</span>
                  <span className="muted">هم‌جهت (از {trend.aligned.count + trend.counter.count} معاملهٔ جهت‌دار)</span>
                </div>
                <div className="plan-split">
                  <div className="plan-side good-side">
                    <div className="ps-title">هم‌جهت ({trend.aligned.count})</div>
                    <div className="ps-main">{trend.aligned.avgR > 0 ? '+' : ''}{trend.aligned.avgR}R<span className="muted"> / معامله</span></div>
                    <div className="muted">{trend.aligned.winRate}% برد · {trend.aligned.totalR > 0 ? '+' : ''}{trend.aligned.totalR}R کل</div>
                  </div>
                  <div className="plan-side bad-side">
                    <div className="ps-title">خلاف ترند ({trend.counter.count})</div>
                    <div className="ps-main">{trend.counter.avgR > 0 ? '+' : ''}{trend.counter.avgR}R<span className="muted"> / معامله</span></div>
                    <div className="muted">{trend.counter.winRate}% برد · {trend.counter.totalR > 0 ? '+' : ''}{trend.counter.totalR}R کل</div>
                  </div>
                </div>
                {trend.counter.count > 0 && trend.counter.totalR < 0 && (
                  <p className="verdict bad">
                    تریدِ خلافِ ترند تو این بازه {trend.counter.totalR}R{trend.counter.totalUsd ? ` (${fmtUsd(trend.counter.totalUsd)})` : ''} هزینه داشته.
                  </p>
                )}
                {trend.range.count > 0 && <p className="muted hint" style={{ marginBottom: 0 }}>{trend.range.count} معامله در ترندِ رنج (کنار گذاشته شد).</p>}
              </>
            )}
          </div>

          <div className="card">
            <h2>منحنی سرمایه <span className="tag">R تجمعی</span></h2>
            <Spark data={eq} />
          </div>

          <div className="card">
            <h2>عملکرد بر اساس ستاپ</h2>
            <Bars rows={bySetup} />
          </div>

          <div className="card">
            <h2>عملکرد بر اساس سشن</h2>
            <Bars rows={bySession} />
          </div>

          <div className="card">
            <h2>🎯 گران‌ترین اشتباه‌ها</h2>
            {mistakes.length === 0 ? (
              <div className="muted">هیچ اشتباهی تگ نشده. 👌</div>
            ) : (
              <div className="bars">
                {mistakes.map((m) => (
                  <div className="bar-row" key={m.tag}>
                    <div className="bar-key">{m.tag} <span className="muted">({m.count}×{m.totalUsd ? ' · ' + fmtUsd(m.totalUsd) : ''})</span></div>
                    <div className={'bar-val ' + (m.totalR < 0 ? 'bad' : 'good')}>{m.totalR > 0 ? '+' : ''}{m.totalR}R</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
