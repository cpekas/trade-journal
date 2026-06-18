import type { Direction, TradeResult, PartialClose } from '../types'

export function plannedRR(entry?: number, sl?: number, tp?: number): number | null {
  if (entry == null || sl == null || tp == null || entry <= 0 || sl <= 0 || tp <= 0) return null
  const risk = Math.abs(entry - sl)
  const reward = Math.abs(tp - entry)
  return risk > 0 ? +(reward / risk).toFixed(2) : null
}

export interface Realized {
  r: number | null
  result: TradeResult | null
  pnl: number | null
}

export function realized(entry?: number, sl?: number, exit?: number, dir?: Direction): Realized {
  // Prices must be positive; a 0/empty exit means "not closed yet", not a real price.
  if (entry == null || sl == null || exit == null || !dir || entry <= 0 || sl <= 0 || exit <= 0) {
    return { r: null, result: null, pnl: null }
  }
  const risk = Math.abs(entry - sl)
  const pl = dir === 'long' ? exit - entry : entry - exit
  const r = risk > 0 ? +(pl / risk).toFixed(2) : null
  const result: TradeResult | null = r == null ? null : r > 0 ? 'win' : r < 0 ? 'loss' : 'be'
  const pnl = +((pl / entry) * 100).toFixed(2)
  return { r, result, pnl }
}

// Dollar risk implied by a position size and the stop-loss distance.
export function riskFromSize(positionUsd?: number, entry?: number, sl?: number): number | null {
  if (positionUsd == null || positionUsd <= 0 || entry == null || sl == null || entry <= 0 || sl <= 0) return null
  return +((positionUsd * Math.abs(entry - sl)) / entry).toFixed(2)
}

// Dollar P/L from position size and the realized price move %.
export function pnlFromSize(positionUsd?: number, pnlPercent?: number | null): number | null {
  if (positionUsd == null || positionUsd <= 0 || pnlPercent == null) return null
  return +((positionUsd * pnlPercent) / 100).toFixed(2)
}

// ── partial closes ──
export function sumClosedSize(closes?: { sizeUsd: number }[]): number {
  return +(closes || []).reduce((s, c) => s + (c.sizeUsd || 0), 0).toFixed(2)
}

export function remainingUsd(positionUsd?: number, closes?: { sizeUsd: number }[]): number | null {
  if (positionUsd == null) return null
  return +(positionUsd - sumClosedSize(closes)).toFixed(2)
}

// Metrics for closing `sizeUsd` of a position at `exit`.
export function closeMetrics(entry?: number, sl?: number, exit?: number, dir?: Direction, sizeUsd?: number) {
  const { r, result, pnl } = realized(entry, sl, exit, dir)
  return { rMultiple: r, result, pnlPercent: pnl, pnlUsd: pnlFromSize(sizeUsd, pnl) }
}

// Aggregate a list of partial closes into one result (size-weighted where sizes exist).
export function aggregateCloses(closes: PartialClose[]): {
  rMultiple: number | null
  pnlUsd: number | null
  pnlPercent: number | null
  result: TradeResult | null
} {
  if (!closes.length) return { rMultiple: null, pnlUsd: null, pnlPercent: null, result: null }
  const totalSize = closes.reduce((s, c) => s + (c.sizeUsd || 0), 0)
  const hasUsd = closes.some((c) => c.pnlUsd != null)
  const pnlUsd = hasUsd ? +closes.reduce((s, c) => s + (c.pnlUsd || 0), 0).toFixed(2) : null
  let rMultiple: number | null
  let pnlPercent: number | null
  if (totalSize > 0) {
    rMultiple = +(closes.reduce((s, c) => s + (c.rMultiple || 0) * (c.sizeUsd || 0), 0) / totalSize).toFixed(2)
    pnlPercent = +(closes.reduce((s, c) => s + (c.pnlPercent || 0) * (c.sizeUsd || 0), 0) / totalSize).toFixed(2)
  } else {
    rMultiple = +(closes.reduce((s, c) => s + (c.rMultiple || 0), 0) / closes.length).toFixed(2)
    pnlPercent = +(closes.reduce((s, c) => s + (c.pnlPercent || 0), 0) / closes.length).toFixed(2)
  }
  const basis = pnlUsd != null ? pnlUsd : rMultiple
  const result: TradeResult | null = basis == null ? null : basis > 0 ? 'win' : basis < 0 ? 'loss' : 'be'
  return { rMultiple, pnlUsd, pnlPercent, result }
}
