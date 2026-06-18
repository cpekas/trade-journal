// Per-period review entries: focus note + if-then rule + week score (local for now; sync later).
const KEY = 'tj.reviews.v1'

export type FocusScore = 'kept' | 'partial' | 'missed'

export interface ReviewEntry {
  focus?: string
  if?: string
  then?: string
  score?: FocusScore
}

type Reviews = Record<string, ReviewEntry>

function read(): Reviews {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Reviews
  } catch {
    return {}
  }
}

function write(all: Reviews) {
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function focusText(e?: ReviewEntry): string {
  if (!e) return ''
  const rule = e.if && e.then ? `اگر ${e.if}، آنگاه ${e.then}` : ''
  return [rule, e.focus].filter(Boolean).join(' — ')
}

export const reviewsRepo = {
  getAll(): Reviews {
    return read()
  },
  get(periodKey: string): ReviewEntry {
    return read()[periodKey] || {}
  },
  setEntry(periodKey: string, patch: Partial<ReviewEntry>) {
    const all = read()
    all[periodKey] = { ...all[periodKey], ...patch }
    write(all)
  },
  getFocus(periodKey: string): string {
    return read()[periodKey]?.focus || ''
  },
  setFocus(periodKey: string, focus: string) {
    this.setEntry(periodKey, { focus })
  },
}
