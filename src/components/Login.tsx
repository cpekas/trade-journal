import { useState } from 'react'
import { login, register, verifyEmail, resendCode } from '../lib/auth'
import Logo from './Logo'

export default function Login({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const errText = (e: any) => {
    const d = e?.data
    const first = d?.errors ? (Object.values(d.errors).flat()[0] as string) : null
    return first || d?.message || 'ارتباط با سرور برقرار نشد. آنلاینی؟'
  }

  const submitAuth = async () => {
    if (busy || !email || !password) return
    setBusy(true); setError(null)
    try {
      const res = mode === 'register' ? await register(email.trim(), password) : await login(email.trim(), password)
      if ('needsVerification' in res) {
        setMode('verify')
        setInfo('یه کد ۶ رقمی به ایمیلت فرستادیم. واردش کن.')
      } else {
        onAuthed()
      }
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const submitVerify = async () => {
    if (busy || !code) return
    setBusy(true); setError(null)
    try {
      await verifyEmail(email.trim(), code.trim())
      onAuthed()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setError(null); setInfo(null)
    try {
      await resendCode(email.trim())
      setInfo('کد دوباره فرستاده شد.')
    } catch (e) {
      setError(errText(e))
    }
  }

  if (mode === 'verify') {
    return (
      <div className="auth">
        <div className="auth-card">
          <div className="auth-logo"><Logo size={52} /></div>
          <h1>تأیید ایمیل</h1>
          <p className="muted">کدی که به {email} فرستادیم رو وارد کن.</p>
          <input type="text" inputMode="numeric" maxLength={6} placeholder="کد ۶ رقمی" value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submitVerify()} style={{ textAlign: 'center', letterSpacing: 6, fontSize: 18 }} />
          {info && <div className="auth-info">{info}</div>}
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" onClick={submitVerify} disabled={busy || code.length < 6}>{busy ? '...' : 'تأیید'}</button>
          <button className="auth-toggle" onClick={resend}>کد رو نگرفتی؟ دوباره بفرست</button>
          <button className="auth-toggle" onClick={() => { setMode('login'); setError(null); setInfo(null); setCode('') }}>بازگشت</button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-logo"><Logo size={52} /></div>
        <h1>ژورنال معامله</h1>
        <p className="muted">{mode === 'login' ? 'وارد شو تا معامله‌هات همه‌جا سنک شن.' : 'یه حساب بساز تا شروع کنی.'}</p>
        <input type="email" inputMode="email" placeholder="ایمیل" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input type="password" placeholder="رمز عبور" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitAuth()} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-submit" onClick={submitAuth} disabled={busy || !email || !password}>
          {busy ? '...' : mode === 'login' ? 'ورود' : 'ثبت‌نام'}
        </button>
        <button className="auth-toggle" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}>
          {mode === 'login' ? 'حساب نداری؟ ثبت‌نام کن' : 'حساب داری؟ وارد شو'}
        </button>
      </div>
    </div>
  )
}
