// Base URL of the Laravel API. Override with VITE_API_URL; change to your server in production.
export const API_URL = ((import.meta as any).env?.VITE_API_URL as string) || 'http://localhost:8787/api'

const TOKEN_KEY = 'tj.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  data: any
  constructor(status: number, data: any) {
    super(data?.message || `HTTP ${status}`)
    this.status = status
    this.data = data
  }
}

interface Opts {
  method?: string
  body?: any
  auth?: boolean
}

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (auth && token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}
