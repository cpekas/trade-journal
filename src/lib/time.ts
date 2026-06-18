export function fmtDuration(ms: number): string {
  if (ms < 0) ms = 0
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'چند لحظه'
  if (min < 60) return `${min} دقیقه`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ساعت`
  const d = Math.floor(h / 24)
  return `${d} روز`
}

export function fmtUsd(v?: number | null): string {
  if (v == null) return '—'
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}$${Math.abs(v).toLocaleString('en-US')}`
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}
