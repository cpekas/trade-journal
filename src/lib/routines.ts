// Routine LOG (top-down prep). Each "run" is an immutable record — running the
// routine again appends a new run, never replaces the previous. Local-only.
// A per-cadence DRAFT holds the in-progress pick until you press «ثبت روتین».
import type { Cadence } from './repo'

const KEY = 'tj.routines.v2'
const OLD = 'tj.routines.v1'

export type Bias = 'up' | 'down' | 'range'
export type Verdict = 'right' | 'wrong'

export interface RoutineRun {
  id: string
  cadence: Cadence
  at: string // ISO when the run was logged
  bias: Bias // the trend read — a run is only logged once a bias is chosen
  seen: string[] // structure labels observed (OB/FVG/…) — snapshot, self-describing
  verdict?: Verdict // retrospective self-assessment: was the read correct?
}
export interface RoutineDraft {
  bias?: Bias
  seen: string[]
}
interface Store {
  drafts: Partial<Record<Cadence, RoutineDraft>>
  runs: RoutineRun[]
}

function rid(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'r' + Date.now() + Math.round(Math.random() * 1e6)
  }
}

function read(): Store {
  try {
    const s = localStorage.getItem(KEY)
    if (s) {
      const o = JSON.parse(s)
      return { drafts: o.drafts || {}, runs: Array.isArray(o.runs) ? o.runs : [] }
    }
  } catch {}
  // one-time migration from v1 per-period records → runs (best effort; legacy 'seen' labels are dropped)
  try {
    const old = localStorage.getItem(OLD)
    if (old) {
      const v1 = JSON.parse(old) as Record<string, { bias?: Bias; lastCompletedAt?: string }>
      const runs: RoutineRun[] = []
      for (const [k, r] of Object.entries(v1)) {
        if (!r.bias) continue
        const cad = k.split(':')[0] as Cadence
        const period = k.slice(cad.length + 1)
        // local-noon anchor (not UTC) so re-keying via the local periodKeyFor is identity; 'YYYY-MM' → add day
        const at = r.lastCompletedAt || (period.length === 7 ? period + '-01' : period) + 'T12:00:00'
        runs.push({ id: rid(), cadence: cad, at, bias: r.bias, seen: [] })
      }
      const store: Store = { drafts: {}, runs }
      localStorage.setItem(KEY, JSON.stringify(store))
      return store
    }
  } catch {}
  return { drafts: {}, runs: [] }
}
function write(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export const routinesRepo = {
  getDraft(cad: Cadence): RoutineDraft {
    return read().drafts[cad] || { seen: [] }
  },
  setDraftBias(cad: Cadence, bias: Bias) {
    const s = read()
    const d = s.drafts[cad] || { seen: [] }
    s.drafts[cad] = { ...d, bias: d.bias === bias ? undefined : bias } // tap active again to clear
    write(s)
  },
  toggleSeen(cad: Cadence, label: string) {
    const s = read()
    const d = s.drafts[cad] || { seen: [] }
    const seen = d.seen.includes(label) ? d.seen.filter((x) => x !== label) : [...d.seen, label]
    s.drafts[cad] = { ...d, seen }
    write(s)
  },
  clearDraft(cad: Cadence) {
    const s = read()
    delete s.drafts[cad]
    write(s)
  },
  // commit the draft as a NEW immutable run (append, never replace); returns false if no bias yet
  logRun(cad: Cadence): boolean {
    const s = read()
    const d = s.drafts[cad]
    if (!d || !d.bias) return false
    s.runs.push({ id: rid(), cadence: cad, at: new Date().toISOString(), bias: d.bias, seen: d.seen })
    delete s.drafts[cad]
    write(s)
    return true
  },
  // commit ALL drafts that have a bias as new runs (one top-down pass, one tap); returns how many
  logAll(): number {
    const s = read()
    let n = 0
    for (const cad of Object.keys(s.drafts) as Cadence[]) {
      const d = s.drafts[cad]
      if (d && d.bias) {
        s.runs.push({ id: rid(), cadence: cad, at: new Date().toISOString(), bias: d.bias, seen: d.seen })
        delete s.drafts[cad]
        n++
      }
    }
    if (n) write(s)
    return n
  },
  allRuns(): RoutineRun[] {
    return read().runs
  },
  setVerdict(id: string, verdict: Verdict) {
    const s = read()
    const r = s.runs.find((x) => x.id === id)
    if (r) {
      r.verdict = r.verdict === verdict ? undefined : verdict // tap again to clear
      write(s)
    }
  },
  deleteRun(id: string) {
    const s = read()
    s.runs = s.runs.filter((x) => x.id !== id)
    write(s)
  },
}
