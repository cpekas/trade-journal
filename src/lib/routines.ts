// Per-period routine records (top-down prep): trend bias + checked structures.
// Local-only — mirrors reviews.ts. Past periods accumulate → reviewable history.
const KEY = 'tj.routines.v1'

export type Bias = 'up' | 'down' | 'range'

export interface RoutineCompletion {
  done: number[] // indexes of structures the trader saw (OB/FVG/… — optional notes)
  total: number // step count when last touched (staleness guard against definition edits)
  bias?: Bias // the trend read for that timeframe/period — the routine's conclusion
  lastCompletedAt?: string // ISO, set when bias was last chosen
  runs?: number // how many times a bias was set (h4 re-checks per day)
}

type Routines = Record<string, RoutineCompletion> // key = `${cadence}:${periodKey}`

function read(): Routines {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Routines
  } catch {
    return {}
  }
}
function write(all: Routines) {
  localStorage.setItem(KEY, JSON.stringify(all))
}

export const routinesRepo = {
  getAll(): Routines {
    return read()
  },
  get(key: string): RoutineCompletion {
    return read()[key] || { done: [], total: 0 }
  },
  toggleStep(key: string, idx: number, total: number) {
    const all = read()
    const rec = all[key] || { done: [], total }
    const base = rec.total === total ? rec.done.slice() : [] // definition edit invalidates stale ticks
    const done = base.includes(idx) ? base.filter((i) => i !== idx) : [...base, idx]
    all[key] = { ...rec, total, done }
    write(all)
  },
  setBias(key: string, bias: Bias, total: number) {
    const all = read()
    const rec = all[key] || { done: [], total }
    const done = rec.total === total ? rec.done : [] // revalidate ticks after a definition edit
    const next = rec.bias === bias ? undefined : bias // tap the active one again to clear
    all[key] = {
      done,
      total,
      bias: next,
      lastCompletedAt: next ? new Date().toISOString() : rec.lastCompletedAt,
      runs: next && rec.bias == null ? (rec.runs ?? 0) + 1 : rec.runs,
    }
    write(all)
  },
  reset(key: string, total: number) {
    const all = read()
    all[key] = { done: [], total } // full clear: ticks + bias + timing
    write(all)
  },
}
