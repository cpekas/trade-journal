import type { Trade, ChecklistItem, TradeStatus } from '../types'
import { DEFAULT_CONFIG } from '../config'

const TRADES_KEY = 'tj.trades.v2'
const OLD_KEY = 'tj.trades.v1'
const CONFIG_KEY = 'tj.config.v1'
const TOMBSTONES_KEY = 'tj.tombstones.v1'
const SYNC_META_KEY = 'tj.sync.meta.v1'

// ── migration from v1 (flat {createdAt, closed, checklist:{...}}) ──
function migrateOld(o: any): Trade {
  const checklist: ChecklistItem[] = DEFAULT_CONFIG.checklist.map((c) => ({
    id: c.id,
    label: c.label,
    checked: !!(o.checklist && o.checklist[c.id]),
  }))
  return {
    id: o.id,
    status: o.closed ? 'closed' : 'open',
    openedAt: o.createdAt,
    closedAt: o.closed ? o.createdAt : undefined,
    updatedAt: o.createdAt,
    symbol: o.symbol, direction: o.direction, session: o.session, setup: o.setup, timeframe: o.timeframe,
    entry: o.entry, stopLoss: o.stopLoss, takeProfit: o.takeProfit, riskPercent: o.riskPercent,
    plannedRR: o.plannedRR, confidence: o.confidence ?? 3, moodBefore: o.moodBefore, checklist,
    exit: o.exit, result: o.result, rMultiple: o.rMultiple, pnlPercent: o.pnlPercent,
    followedPlan: o.followedPlan, mistakes: o.mistakes || [], didWell: o.didWell || [],
    moodAfter: o.moodAfter, lesson: o.lesson,
  }
}

// Ensure every trade has the fields the UI relies on (guards partial/legacy/server data).
function normalizeTrade(t: any): Trade {
  const now = new Date().toISOString()
  return {
    ...t,
    // a completed trade lives in the archive now; map legacy 'closed' → 'archived'
    status: t.status === 'closed' ? 'archived' : t.status || 'open',
    openedAt: t.openedAt || t.createdAt || now,
    updatedAt: t.updatedAt || t.openedAt || now,
    confidence: t.confidence ?? 3,
    checklist: Array.isArray(t.checklist) ? t.checklist : [],
    mistakes: Array.isArray(t.mistakes) ? t.mistakes : [],
    didWell: Array.isArray(t.didWell) ? t.didWell : [],
  }
}

function readRaw(): Trade[] {
  const cur = localStorage.getItem(TRADES_KEY)
  if (cur) {
    try { return (JSON.parse(cur) as any[]).map(normalizeTrade) } catch { return [] }
  }
  const old = localStorage.getItem(OLD_KEY)
  if (old) {
    try {
      const migrated = (JSON.parse(old) as any[]).map(migrateOld)
      localStorage.setItem(TRADES_KEY, JSON.stringify(migrated))
      return migrated
    } catch { return [] }
  }
  return []
}

function writeRaw(list: Trade[]) {
  localStorage.setItem(TRADES_KEY, JSON.stringify(list))
}

interface Tombstone {
  id: string
  updatedAt: string
}
function readTombstones(): Tombstone[] {
  try {
    return JSON.parse(localStorage.getItem(TOMBSTONES_KEY) || '[]') as Tombstone[]
  } catch {
    return []
  }
}
function writeTombstones(t: Tombstone[]) {
  localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(t))
}

export const tradesRepo = {
  all(): Trade[] {
    return readRaw().sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''))
  },
  get(id: string): Trade | undefined {
    return readRaw().find((t) => t.id === id)
  },
  save(t: Trade) {
    const list = readRaw()
    const i = list.findIndex((x) => x.id === t.id)
    const next = { ...t, updatedAt: new Date().toISOString() }
    if (i >= 0) list[i] = next
    else list.push(next)
    writeRaw(list)
  },
  setStatus(id: string, status: TradeStatus) {
    const list = readRaw()
    const t = list.find((x) => x.id === id)
    if (t) {
      t.status = status
      t.updatedAt = new Date().toISOString()
      writeRaw(list)
    }
  },
  remove(id: string) {
    writeRaw(readRaw().filter((x) => x.id !== id))
    const tombs = readTombstones()
    tombs.push({ id, updatedAt: new Date().toISOString() })
    writeTombstones(tombs)
  },

  // ── sync support ──
  changesForPush() {
    const trades = readRaw().map((t) => ({ id: t.id, data: t, updatedAt: t.updatedAt, deleted: false }))
    const tombs = readTombstones().map((x) => ({ id: x.id, data: {}, updatedAt: x.updatedAt, deleted: true }))
    return [...trades, ...tombs]
  },
  applyServerChanges(changes: Array<{ id: string; data: Trade; deleted: boolean; updatedAt: string }>) {
    const byId = new Map(readRaw().map((t) => [t.id, t]))
    for (const c of changes) {
      if (c.deleted) {
        byId.delete(c.id)
        continue
      }
      const existing = byId.get(c.id)
      const incoming = c.updatedAt || c.data?.updatedAt || ''
      if (!existing || (existing.updatedAt || '') <= incoming) byId.set(c.id, normalizeTrade({ ...c.data, id: c.id }))
    }
    writeRaw([...byId.values()])
  },
  clearTombstones() {
    writeTombstones([])
  },
  getLastPulledAt(): string | null {
    try {
      return (JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}').lastPulledAt as string) ?? null
    } catch {
      return null
    }
  },
  setLastPulledAt(t: string) {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify({ lastPulledAt: t }))
  },
}

export function clearLocalData() {
  // 'tj.reviews.v1' and 'tj.tilt.ack.v1' must go too — otherwise the previous
  // account's weekly rules / tilt acknowledgment leak to the next login
  for (const k of [TRADES_KEY, CONFIG_KEY, TOMBSTONES_KEY, SYNC_META_KEY, 'tj.reviews.v1', 'tj.tilt.ack.v1', 'tj.routines.v1', 'tj.routines.v2', 'tj.nudge.ack.v1']) {
    localStorage.removeItem(k)
  }
}

// ── config: server-defined lists (symbols, sessions, timeframes, setups, checklist) ──
export type Cadence = 'monthly' | 'weekly' | 'daily' | 'h4'
export type RoutineDefs = Record<Cadence, string[]>

export interface JournalConfig {
  symbols: string[]
  sessions: string[]
  timeframes: string[]
  setups: string[]
  leverages: string[]
  checklist: { id: string; label: string }[]
  maxRiskPercent: number
  routines: RoutineDefs
}

function defaultConfig(): JournalConfig {
  return {
    symbols: [...DEFAULT_CONFIG.symbols],
    sessions: [...DEFAULT_CONFIG.sessions],
    timeframes: [...DEFAULT_CONFIG.timeframes],
    setups: [...DEFAULT_CONFIG.setups],
    leverages: [...DEFAULT_CONFIG.leverages],
    checklist: DEFAULT_CONFIG.checklist.map((c) => ({ ...c })),
    maxRiskPercent: DEFAULT_CONFIG.maxRiskPercent,
    routines: {
      monthly: [...DEFAULT_CONFIG.routines.monthly],
      weekly: [...DEFAULT_CONFIG.routines.weekly],
      daily: [...DEFAULT_CONFIG.routines.daily],
      h4: [...DEFAULT_CONFIG.routines.h4],
    },
  }
}

export function getRiskCap(): number {
  const v = configRepo.getSync().maxRiskPercent
  return typeof v === 'number' && v > 0 ? v : DEFAULT_CONFIG.maxRiskPercent
}

// the first v2 shipped placeholder routine steps; auto-upgrade users still on them
const LEGACY_ROUTINES = JSON.stringify({
  monthly: ['روند ماهانه (HTF)', 'سطوح کلیدی ماه', 'بایاس کلی'],
  weekly: ['ساختار هفتگی', 'نقاط نقدینگی', 'پلن هفته'],
  daily: ['بایاس روز', 'سشن‌های مهم', 'سطوح امروز'],
  h4: ['ساختار ۴ساعته', 'تأیید ورود'],
})

export const configRepo = {
  getSync(): JournalConfig {
    try {
      const s = localStorage.getItem(CONFIG_KEY)
      if (s) {
        const parsed = JSON.parse(s)
        const d = defaultConfig()
        // nested merge so an existing user missing a cadence backfills defaults
        const merged = { ...d, ...parsed, routines: { ...d.routines, ...(parsed.routines || {}) } }
        // one-time upgrade: swap the placeholder routines for the real SMC defaults (keeps real edits)
        if (parsed.routines && JSON.stringify(parsed.routines) === LEGACY_ROUTINES) merged.routines = d.routines
        return merged
      }
    } catch {}
    return defaultConfig()
  },
  save(c: JournalConfig) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
    // TODO(phase2): PUT /api/config
  },
}

// Server seam. Phase 2: GET /api/config (per-user), cache locally, fall back to cache offline.
export async function fetchConfig(): Promise<JournalConfig> {
  await new Promise((r) => setTimeout(r, 20))
  return configRepo.getSync()
}
