import type { Trade } from '../types'
import { tradesRepo } from './repo'
import { gradeOf, executionScore, trendAlignment } from './stats'
import { reviewsRepo } from './reviews'
import { getRiskCap, configRepo } from './repo'

function esc(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function dt(iso?: string): string {
  if (!iso) return ''
  // sortable, Excel-friendly: YYYY-MM-DD HH:mm
  return iso.slice(0, 16).replace('T', ' ')
}

const COLUMNS: { label: string; get: (t: Trade) => unknown }[] = [
  { label: 'باز شده', get: (t) => dt(t.openedAt) },
  { label: 'بسته شده', get: (t) => dt(t.closedAt) },
  { label: 'نماد', get: (t) => t.symbol },
  { label: 'جهت', get: (t) => (t.direction === 'long' ? 'Long' : t.direction === 'short' ? 'Short' : '') },
  { label: 'سشن', get: (t) => t.session },
  { label: 'ستاپ', get: (t) => t.setup },
  { label: 'تایم‌فریم', get: (t) => t.timeframe },
  { label: 'وضعیت', get: (t) => (t.status === 'open' ? 'باز' : t.result != null ? 'بسته' : 'آرشیو') },
  { label: 'ورود', get: (t) => t.entry },
  { label: 'حد ضرر', get: (t) => t.stopLoss },
  { label: 'حد سود', get: (t) => t.takeProfit },
  { label: 'خروج', get: (t) => t.exit },
  { label: 'حجم $', get: (t) => t.positionUsd },
  { label: 'ریسک %', get: (t) => t.riskPercent },
  { label: 'ریسک $', get: (t) => t.riskUsd },
  { label: 'اهرم', get: (t) => t.leverage },
  { label: 'R:R پلن', get: (t) => t.plannedRR },
  { label: 'R', get: (t) => t.rMultiple },
  { label: 'نتیجه', get: (t) => (t.result === 'win' ? 'سود' : t.result === 'loss' ? 'ضرر' : t.result === 'be' ? 'سربه‌سر' : '') },
  { label: 'P/L %', get: (t) => t.pnlPercent },
  { label: 'P/L $', get: (t) => t.pnlUsd },
  { label: 'پایبند به پلن', get: (t) => (t.followedPlan == null ? '' : t.followedPlan ? 'بله' : 'خیر') },
  { label: 'روتین کامل بود', get: (t) => (t.routineReadyAtEntry == null ? '' : t.routineReadyAtEntry ? 'بله' : 'خیر') },
  { label: 'هم‌جهت با ترند', get: (t) => { const a = trendAlignment(t.direction, t.routineTrendAtEntry?.[configRepo.getSync().trendRefCadence]); return a === 'aligned' ? 'هم‌جهت' : a === 'counter' ? 'خلاف' : a === 'range' ? 'رنج' : '' } },
  { label: 'اشتباهات', get: (t) => (t.mistakes || []).join('، ') },
  { label: 'چی خوب بود', get: (t) => (t.didWell || []).join('، ') },
  { label: 'حال قبل', get: (t) => t.moodBefore },
  { label: 'حال بعد', get: (t) => t.moodAfter },
  { label: 'درس', get: (t) => t.lesson },
  { label: 'اسکرین‌شات', get: (t) => (t.screenshot ? 'دارد' : '') },
  { label: 'بستن‌ها', get: (t) => (t.closes || []).map((c) => `$${c.sizeUsd}@${c.exit}`).join(' | ') },
  { label: 'نمرهٔ A/B/C', get: (t) => (t.result != null ? gradeOf(t) : '') },
  { label: 'نمرهٔ اجرا (0-100)', get: (t) => executionScore(t, getRiskCap()) ?? '' },
  { label: 'مرور شد', get: (t) => (t.reviewed ? 'بله' : '') },
  { label: 'یادداشت مرور', get: (t) => t.reviewNote },
]

export function exportTradesCsv(opts: { from?: string; to?: string } = {}): number {
  let trades = tradesRepo.all()
  if (opts.from) {
    const f = new Date(opts.from).getTime()
    trades = trades.filter((t) => new Date(t.openedAt).getTime() >= f)
  }
  if (opts.to) {
    const to = new Date(opts.to).getTime() + 86400000 // include the whole "to" day
    trades = trades.filter((t) => new Date(t.openedAt).getTime() < to)
  }

  const header = COLUMNS.map((c) => esc(c.label)).join(',')
  const rows = trades.map((t) => COLUMNS.map((c) => esc(c.get(t))).join(','))
  triggerDownload(`trades-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + [header, ...rows].join('\r\n'))
  return trades.length
}

function triggerDownload(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Per-period review entries (weekly/daily): focus note, if-then rule, self-score.
const SCORE_FA: Record<string, string> = { kept: 'رعایت شد', partial: 'تا حدی', missed: 'نشد' }

export function exportReviewNotesCsv(): number {
  const all = reviewsRepo.getAll()
  const entries = Object.entries(all)
    .filter(([, v]) => v.focus || (v.if && v.then))
    .sort((a, b) => b[0].localeCompare(a[0]))
  if (!entries.length) return 0
  const kind = (k: string) => (k.startsWith('w:') ? 'هفته' : k.startsWith('d:') ? 'روز' : '')
  const rawKey = (k: string) => k.replace(/^[wd]:/, '')
  const header = ['نوع', 'دوره (تاریخ شروع)', 'قانون (اگر-آنگاه)', 'تمرکز / یادداشت', 'خودارزیابی'].map(esc).join(',')
  const rows = entries.map(([k, v]) =>
    [esc(kind(k)), esc(rawKey(k)), esc(v.if && v.then ? `اگر ${v.if}، آنگاه ${v.then}` : ''), esc(v.focus), esc(v.score ? SCORE_FA[v.score] : '')].join(','),
  )
  triggerDownload(`review-notes-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + [header, ...rows].join('\r\n'))
  return entries.length
}
