import { api, setToken, getToken } from './api'

export interface AuthUser {
  id: number
  name: string
  email: string
  is_admin?: boolean
}

export type AuthResult = { ok: true } | { needsVerification: true; email: string }

const USER_KEY = 'tj.user'

export function getUser(): AuthUser | null {
  try {
    const s = localStorage.getItem(USER_KEY)
    return s ? (JSON.parse(s) as AuthUser) : null
  } catch {
    return null
  }
}
function storeUser(u: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(u))
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

export async function register(email: string, password: string, name?: string): Promise<AuthResult> {
  const r = await api<any>('/register', { method: 'POST', auth: false, body: { email, password, name } })
  if (r.needsVerification) return { needsVerification: true, email: r.email }
  setToken(r.token)
  storeUser(r.user)
  return { ok: true }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const r = await api<any>('/login', { method: 'POST', auth: false, body: { email, password } })
  if (r.needsVerification) return { needsVerification: true, email: r.email }
  setToken(r.token)
  storeUser(r.user)
  return { ok: true }
}

export async function verifyEmail(email: string, code: string): Promise<void> {
  const r = await api<{ user: AuthUser; token: string }>('/email/verify', { method: 'POST', auth: false, body: { email, code } })
  setToken(r.token)
  storeUser(r.user)
}

export async function resendCode(email: string): Promise<void> {
  await api('/email/resend', { method: 'POST', auth: false, body: { email } })
}

export async function logout(): Promise<void> {
  try {
    await api('/logout', { method: 'POST' })
  } catch {
    // ignore — clearing the local token is enough
  }
  setToken(null)
  localStorage.removeItem(USER_KEY)
}
