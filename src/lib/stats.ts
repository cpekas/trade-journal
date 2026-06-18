import type { Trade } from '../types'

export interface Summary {
  total: number
  closed: number
  winRate: number
  avgR: number
  totalR: number
  totalUsd: number
  hasUsd: boolean
  profitFactor: number | null
  expectancy: number
  bestR: number | null
  worstR: number | null
}

// Completed trades = fully closed (now archived) with a realized result. Legacy 'closed' included.
// Partially-closed trades are still 'open' and don't count until done.
export function closedTrades(trades: Trade[]): Trade[] {
  return trades.filter(
    (t) => (t.status === 'archived' || t.status === 'closed') && t.result != null && t.rMultiple != null,
  )
}

export function summarize(trades: Trade[]): Summary {
  const c = closedTrades(trades)
  const rs = c.map((t) => t.rMultiple as number)
  const wins = c.filter((t) => t.result === 'win').length
  const grossWin = rs.filter((r) => r > 0).reduce((s, r) => s + r, 0)
  const grossLoss = rs.filter((r) => r < 0).reduce((s, r) => s + r, 0)
  const totalR = rs.reduce((s, r) => s + r, 0)
  const usdTrades = c.filter((t) => t.pnlUsd != null)
  const totalUsd = usdTrades.reduce((s, t) => s + (t.pnlUsd as number), 0)
  const avg = c.length ? totalR / c.length : 0
  return {
    total: trades.length,
    closed: c.length,
    winRate: c.length ? Math.round((wins / c.length) * 100) : 0,
    avgR: +avg.toFixed(2),
    totalR: +totalR.toFixed(2),
    totalUsd: +totalUsd.toFixed(2),
    hasUsd: usdTrades.length > 0,
    profitFactor: grossLoss !== 0 ? +(grossWin / Math.abs(grossLoss)).toFixed(2) : grossWin > 0 ? null : 0,
    expectancy: +avg.toFixed(2),
    bestR: rs.length ? Math.max(...rs) : null,
    worstR: rs.length ? Math.min(...rs) : null,
  }
}

export interface GroupStat {
  key: string
  count: number
  winRate: number
  totalR: number
  avgR: number
  totalUsd: number
}

export function byField(trades: Trade[], field: 'setup' | 'session' | 'moodBefore'): GroupStat[] {
  const c = closedTrades(trades)
  const map = new Map<string, Trade[]>()
  for (const t of c) {
    const k = (t[field] as string) || '—'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(t)
  }
  const out: GroupStat[] = []
  for (const [key, list] of map) {
    const rs = list.map((t) => t.rMultiple as number)
    const wins = list.filter((t) => t.result === 'win').length
    const totalR = rs.reduce((s, r) => s + r, 0)
    const totalUsd = list.reduce((s, t) => s + (t.pnlUsd ?? 0), 0)
    out.push({
      key,
      count: list.length,
      winRate: Math.round((wins / list.length) * 100),
      totalR: +totalR.toFixed(2),
      avgR: +(totalR / list.length).toFixed(2),
      totalUsd: +totalUsd.toFixed(2),
    })
  }
  return out.sort((a, b) => b.totalR - a.totalR)
}

export interface MistakeStat {
  tag: string
  count: number
  totalR: number
  totalUsd: number
}

export function costliestMistakes(trades: Trade[]): MistakeStat[] {
  const c = closedTrades(trades)
  const map = new Map<string, { count: number; totalR: number; totalUsd: number }>()
  for (const t of c) {
    for (const m of t.mistakes) {
      const cur = map.get(m) || { count: 0, totalR: 0, totalUsd: 0 }
      cur.count++
      cur.totalR += t.rMultiple as number
      cur.totalUsd += t.pnlUsd ?? 0
      map.set(m, cur)
    }
  }
  return [...map.entries()]
    .map(([tag, v]) => ({ tag, count: v.count, totalR: +v.totalR.toFixed(2), totalUsd: +v.totalUsd.toFixed(2) }))
    .sort((a, b) => a.totalR - b.totalR)
}

export function equityCurve(trades: Trade[]): number[] {
  const c = closedTrades(trades)
    .slice()
    .sort((a, b) => (a.closedAt || a.openedAt).localeCompare(b.closedAt || b.openedAt))
  let cum = 0
  return c.map((t) => {
    cum += t.rMultiple as number
    return +cum.toFixed(2)
  })
}

// ── review lenses ──

function groupStat(key: string, list: Trade[]): GroupStat {
  const rs = list.map((t) => t.rMultiple as number)
  const wins = list.filter((t) => t.result === 'win').length
  const totalR = rs.reduce((s, r) => s + r, 0)
  return {
    key,
    count: list.length,
    winRate: Math.round((wins / list.length) * 100),
    totalR: +totalR.toFixed(2),
    avgR: +(totalR / list.length).toFixed(2),
    totalUsd: +list.reduce((s, t) => s + (t.pnlUsd ?? 0), 0).toFixed(2),
  }
}

// win rate / avg R by entry confidence (1..5)
export function byConfidence(trades: Trade[]): GroupStat[] {
  const c = closedTrades(trades)
  const map = new Map<number, Trade[]>()
  for (const t of c) {
    const k = t.confidence ?? 0
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(t)
  }
  return [...map.entries()].map(([k, list]) => groupStat(`${k}/5`, list)).sort((a, b) => b.key.localeCompare(a.key))
}

// auto process grade (independent of outcome)
export function autoGrade(t: Trade): 'A' | 'B' | 'C' {
  const checklistOk = !t.checklist?.length || t.checklist.every((c) => c.checked)
  const hasMistake = (t.mistakes || []).length > 0
  if (t.followedPlan === false || hasMistake) return 'C'
  if (t.followedPlan === true && checklistOk) return 'A'
  return 'B'
}

export function gradeOf(t: Trade): 'A' | 'B' | 'C' {
  return t.grade || autoGrade(t)
}

// process quality buckets (outcome vs discipline)
export function processBuckets(trades: Trade[]) {
  const c = closedTrades(trades).filter((t) => t.followedPlan != null)
  return {
    badWins: c.filter((t) => t.result === 'win' && t.followedPlan === false),
    goodLosses: c.filter((t) => t.result === 'loss' && t.followedPlan === true),
    goodWins: c.filter((t) => t.result === 'win' && t.followedPlan === true),
    badLosses: c.filter((t) => t.result === 'loss' && t.followedPlan === false),
  }
}

// closed trades carrying a given mistake tag
export function leakTrades(trades: Trade[], tag: string): Trade[] {
  return closedTrades(trades)
    .filter((t) => (t.mistakes || []).includes(tag))
    .sort((a, b) => (b.closedAt || b.openedAt).localeCompare(a.closedAt || a.openedAt))
}

export function monthlyCount(trades: Trade[]): { month: string; count: number }[] {
  const map = new Map<string, number>()
  for (const t of trades) {
    const m = (t.closedAt || t.openedAt).slice(0, 7)
    map.set(m, (map.get(m) || 0) + 1)
  }
  return [...map.entries()].map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month))
}

// ── execution score (process quality, 0..100, outcome-blind) ──
// 30·checklist% + 30·followedPlan + 20·risk≤cap + 20·no-mistakes; null parts score half.
export function executionScore(t: Trade, riskCap = 2): number | null {
  if (t.result == null) return null
  const ckTotal = t.checklist?.length ?? 0
  const ckRatio = ckTotal ? t.checklist.filter((c) => c.checked).length / ckTotal : 1
  const planPart = t.followedPlan == null ? 0.5 : t.followedPlan ? 1 : 0
  const riskPart = t.riskPercent == null ? 0.5 : t.riskPercent <= riskCap ? 1 : 0
  const cleanPart = (t.mistakes?.length ?? 0) === 0 ? 1 : 0
  return Math.round(30 * ckRatio + 30 * planPart + 20 * riskPart + 20 * cleanPart)
}

export interface ScorePoint {
  when: string
  score: number
  r: number
}
export function scoreSeries(trades: Trade[], riskCap = 2): ScorePoint[] {
  return closedTrades(trades)
    .map((t) => ({ when: t.closedAt || t.openedAt, score: executionScore(t, riskCap) ?? 0, r: t.rMultiple as number }))
    .sort((a, b) => a.when.localeCompare(b.when))
}

// ── plan adherence: followed vs broken expectancy split ──
export interface PlanSide {
  count: number
  avgR: number
  totalR: number
  winRate: number
  totalUsd: number
}
export interface PlanSplit {
  total: number
  adherence: number | null
  followed: PlanSide
  broken: PlanSide
}
export function planSplit(trades: Trade[]): PlanSplit {
  const c = closedTrades(trades).filter((t) => t.followedPlan != null)
  const mk = (list: Trade[]): PlanSide => ({
    count: list.length,
    avgR: list.length ? +(list.reduce((s, t) => s + (t.rMultiple as number), 0) / list.length).toFixed(2) : 0,
    totalR: +list.reduce((s, t) => s + (t.rMultiple as number), 0).toFixed(2),
    winRate: list.length ? Math.round((list.filter((t) => t.result === 'win').length / list.length) * 100) : 0,
    totalUsd: +list.reduce((s, t) => s + (t.pnlUsd ?? 0), 0).toFixed(2),
  })
  const followed = mk(c.filter((t) => t.followedPlan === true))
  const broken = mk(c.filter((t) => t.followedPlan === false))
  return {
    total: c.length,
    adherence: c.length ? Math.round((followed.count / c.length) * 100) : null,
    followed,
    broken,
  }
}

// ── tilt detection (rushing / revenge / loss-streak signals from existing data) ──
export interface TiltState {
  level: 'calm' | 'caution' | 'danger'
  reasons: string[]
  lossStreak: number
  gate: boolean
  cooldownUntil: number | null
  key: string | null
}
export function tiltState(trades: Trade[], now: number = Date.now()): TiltState {
  const closed = closedTrades(trades)
    .slice()
    .sort((a, b) => (b.closedAt || b.openedAt).localeCompare(a.closedAt || a.openedAt))
  const reasons: string[] = []
  let score = 0
  const H12 = 12 * 3600e3
  const H24 = 24 * 3600e3
  const ageOf = (iso?: string) => (iso ? now - new Date(iso).getTime() : Infinity)

  // tilt is about being hot NOW — every signal is time-bounded so a bad day
  // three weeks ago can't keep the gate up forever
  let streak = 0
  for (const t of closed) {
    if (t.result === 'loss') streak++
    else break
  }
  const streakActive = streak >= 2 && ageOf(closed[0]?.closedAt) < H12
  if (streakActive) {
    score += streak
    reasons.push(`${streak} ضرر پشت‌سرهم`)
  }

  const recentClosed = closed.filter((t) => ageOf(t.closedAt) < H24)
  const mistakeCount = recentClosed.reduce((s, t) => s + (t.mistakes?.length ?? 0), 0)
  if (mistakeCount >= 3) {
    score += 2
    reasons.push(`${mistakeCount} خطا در ۲۴ ساعت اخیر`)
  } else if (mistakeCount === 2) {
    score += 1
    reasons.push('۲ خطا در ۲۴ ساعت اخیر')
  }

  // quick re-entry after a loss (revenge signal) among recent entries
  const byOpen = trades
    .filter((t) => ageOf(t.openedAt) < H24)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
    .slice(0, 5)
  let revenge = 0
  for (const t of byOpen) {
    const tOpen = new Date(t.openedAt).getTime()
    const after = closed.find(
      (x) =>
        x.id !== t.id &&
        x.result === 'loss' &&
        x.closedAt &&
        new Date(x.closedAt).getTime() <= tOpen &&
        tOpen - new Date(x.closedAt).getTime() < 30 * 60000,
    )
    if (after) revenge++
  }
  if (revenge > 0) {
    score += revenge
    reasons.push('ورود سریع بعد از ضرر')
  }

  // "today" must follow the user's local clock, not UTC
  const todayStr = new Date(now).toDateString()
  const todayR = +closed
    .filter((t) => t.closedAt && new Date(t.closedAt).toDateString() === todayStr)
    .reduce((s, t) => s + (t.rMultiple ?? 0), 0)
    .toFixed(2)
  if (todayR <= -2) {
    score += 2
    reasons.push(`امروز ${todayR}R`)
  }

  const level: TiltState['level'] = score >= 4 ? 'danger' : score >= 2 ? 'caution' : 'calm'
  const lastLoss = closed.find((t) => t.result === 'loss')
  let cooldownUntil: number | null = null
  if (streakActive && lastLoss?.closedAt) {
    const until = new Date(lastLoss.closedAt).getTime() + 10 * 60000
    if (until > now) cooldownUntil = until
  }
  return {
    level,
    reasons,
    lossStreak: streakActive ? streak : 0,
    gate: streakActive || level === 'danger',
    cooldownUntil,
    key: closed[0]?.id ?? null,
  }
}

// ── period (day/week) grouping ──
// Keys are built ENTIRELY in local time — mixing local day math with toISOString
// shifted keys near midnight (e.g. Tehran UTC+3:30) and split one week in two.
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}
function localDayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function startOfWeek(iso: string): string {
  const d = new Date(iso)
  const diff = (d.getDay() + 1) % 7 // week starts Saturday
  d.setDate(d.getDate() - diff)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function startOfWeekKey(iso: string): string {
  return startOfWeek(iso)
}
function faDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

export interface PeriodGroup {
  key: string
  label: string
  trades: Trade[]
  summary: Summary
  topMistake: string | null
}

export function byPeriod(trades: Trade[], unit: 'day' | 'week'): PeriodGroup[] {
  const c = closedTrades(trades)
  const map = new Map<string, Trade[]>()
  for (const t of c) {
    const when = t.closedAt || t.openedAt
    const key = unit === 'day' ? localDayKey(when) : startOfWeek(when)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      label: unit === 'day' ? faDate(key) : 'هفتهٔ ' + faDate(key),
      trades: list,
      summary: summarize(list),
      topMistake: costliestMistakes(list)[0]?.tag ?? null,
    }))
    .sort((a, b) => b.key.localeCompare(a.key))
}
