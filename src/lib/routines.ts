// Per-period routine completion (top-down prep). Local-only — mirrors reviews.ts.
// Routine *definitions* live in JournalConfig (synced); only the ticks live here.
const KEY = 'tj.routines.v1'

export interface RoutineCompletion {
  done: number[] // ticked step indexes for that period
  total: number // step count when last ticked (staleness guard against definition edits)
  lastCompletedAt?: string // ISO, set when done.length === total
  runs?: number // how many times it reached complete (h4 re-runs per day)
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
    // a definition edit (length change) invalidates stale ticks
    const base = rec.total === total ? rec.done.slice() : []
    const done = base.includes(idx) ? base.filter((i) => i !== idx) : [...base, idx]
    const wasComplete = rec.total === total && rec.done.length === total && total > 0
    const nowComplete = done.length === total && total > 0
    all[key] = {
      done,
      total,
      lastCompletedAt: nowComplete ? new Date().toISOString() : rec.lastCompletedAt,
      runs: nowComplete && !wasComplete ? (rec.runs ?? 0) + 1 : rec.runs,
    }
    write(all)
  },
  resetRun(key: string, total: number) {
    const all = read()
    const rec = all[key] || { done: [], total }
    all[key] = { ...rec, total, done: [] }
    write(all)
  },
}
