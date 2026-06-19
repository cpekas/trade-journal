import { useEffect, useState } from 'react'
import { configRepo, type JournalConfig, type Cadence } from '../lib/repo'
import { CADENCE_FA } from '../config'
import { api } from '../lib/api'
import { getUser } from '../lib/auth'
import { exportTradesCsv, exportReviewNotesCsv } from '../lib/export'

function StringList({
  title, hint, items, placeholder, onChange,
}: { title: string; hint?: string; items: string[]; placeholder: string; onChange: (items: string[]) => void }) {
  const [val, setVal] = useState('')
  const add = () => {
    const v = val.trim()
    if (v && !items.includes(v)) onChange([...items, v])
    setVal('')
  }
  return (
    <div className="card">
      <h2>{title}</h2>
      {hint && <p className="muted hint">{hint}</p>}
      <div className="chips wrap">
        {items.map((x) => (
          <span key={x} className="pill removable">{x}<button onClick={() => onChange(items.filter((y) => y !== x))} aria-label="حذف">×</button></span>
        ))}
        {items.length === 0 && <span className="muted">موردی نیست.</span>}
      </div>
      <div className="addrow">
        <input type="text" value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="act" onClick={add}>افزودن</button>
      </div>
    </div>
  )
}

function AdminSettings() {
  const [val, setVal] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<{ require_email_verification: boolean }>('/admin/settings')
      .then((r) => setVal(r.require_email_verification))
      .catch(() => setVal(null))
  }, [])

  const toggle = async (next: boolean) => {
    setBusy(true)
    try {
      await api('/admin/settings', { method: 'PUT', body: { require_email_verification: next } })
      setVal(next)
    } catch {
      // ignore
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>ادمین <span className="tag">سوپر یوزر</span></h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>نیاز به تأیید ایمیل در ثبت‌نام</span>
        <div className="chips">
          <button className={'chip' + (val === true ? ' active' : '')} disabled={busy || val === null} onClick={() => toggle(true)}>روشن</button>
          <button className={'chip' + (val === false ? ' active' : '')} disabled={busy || val === null} onClick={() => toggle(false)}>خاموش</button>
        </div>
      </div>
      <p className="muted hint" style={{ marginTop: 8 }}>برای ارسال واقعی ایمیل، SMTP رو تو <code>server/.env</code> تنظیم کن.</p>
    </div>
  )
}

function ExportCard() {
  const [mode, setMode] = useState<'all' | 'range'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const run = () => {
    const n = exportTradesCsv(mode === 'range' ? { from: from || undefined, to: to || undefined } : {})
    if (n === 0) alert('معامله‌ای تو این بازه نیست.')
  }

  return (
    <div className="card">
      <h2>خروجی اکسل <span className="tag">CSV</span></h2>
      <p className="muted hint">مستقیم تو Excel باز می‌شه.</p>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={'chip' + (mode === 'all' ? ' active' : '')} onClick={() => setMode('all')}>کل تاریخ</button>
        <button className={'chip' + (mode === 'range' ? ' active' : '')} onClick={() => setMode('range')}>بازهٔ تاریخ</button>
      </div>
      {mode === 'range' && (
        <div className="nums" style={{ marginBottom: 10 }}>
          <label>از<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>تا<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      )}
      <button className="act primary" onClick={run}>دانلود معاملات (CSV)</button>
      <button className="act" style={{ marginTop: 8 }} onClick={() => { if (exportReviewNotesCsv() === 0) alert('یادداشت مرور دوره‌ای ثبت نشده.') }}>
        دانلود یادداشت‌های مرور دوره‌ای
      </button>
    </div>
  )
}

// Local string state so intermediate keystrokes ("1.", "0.") aren't coerced —
// a controlled numeric value turned typing "1.5" into 15.
function RiskCapCard({ config, persist }: { config: JournalConfig; persist: (c: JournalConfig) => void }) {
  const [capStr, setCapStr] = useState(String(config.maxRiskPercent))
  return (
    <div className="card">
      <h2>سقف ریسک هر معامله (٪)</h2>
      <p className="muted hint">مبنای نمرهٔ اجرا و هشدار حجم — ریسک بالاتر از این، نمره رو می‌سوزونه.</p>
      <input
        type="number" inputMode="decimal" min={0.1} step={0.5}
        value={capStr}
        onChange={(e) => {
          setCapStr(e.target.value)
          const v = parseFloat(e.target.value)
          if (!isNaN(v) && v > 0) persist({ ...config, maxRiskPercent: v })
        }}
        onBlur={() => setCapStr(String(config.maxRiskPercent))}
      />
    </div>
  )
}

export default function SettingsScreen({ onBack, onChange, email, onLogout }: { onBack: () => void; onChange: () => void; email?: string; onLogout: () => void }) {
  const [c, setC] = useState<JournalConfig>(() => configRepo.getSync())
  const [ck, setCk] = useState('')

  const persist = (next: JournalConfig) => {
    setC(next)
    configRepo.save(next)
    onChange()
  }
  const setList = (key: 'symbols' | 'sessions' | 'timeframes' | 'setups' | 'leverages') => (items: string[]) => persist({ ...c, [key]: items })
  const setRoutine = (key: Cadence) => (items: string[]) => persist({ ...c, routines: { ...c.routines, [key]: items } })
  const addCk = () => {
    const v = ck.trim()
    if (v) persist({ ...c, checklist: [...c.checklist, { id: crypto.randomUUID(), label: v }] })
    setCk('')
  }
  const removeCk = (id: string) => persist({ ...c, checklist: c.checklist.filter((x) => x.id !== id) })

  return (
    <div className="settings">
      <div className="editor-head">
        <h2>تنظیمات</h2>
        <button className="ghost" onClick={onBack}>بازگشت</button>
      </div>
      <div className="card">
        <h2>حساب</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="muted">ایمیل</span><span>{email || '—'}</span>
        </div>
        <button className="act danger" onClick={onLogout}>خروج از حساب</button>
      </div>

      {getUser()?.is_admin && <AdminSettings />}

      <ExportCard />

      <p className="muted hint" style={{ padding: '0 2px 6px' }}>
        این لیست‌ها سمت سرور برای حساب تو ذخیره و بین دستگاه‌هات سنک می‌شن.
      </p>

      <StringList title="نمادها" items={c.symbols} placeholder="نماد جدید (مثلاً DOGE)" onChange={setList('symbols')} />
      <StringList title="ستاپ‌ها" items={c.setups} placeholder="ستاپ جدید" onChange={setList('setups')} />
      <StringList title="سشن‌ها" items={c.sessions} placeholder="سشن جدید" onChange={setList('sessions')} />
      <StringList title="تایم‌فریم‌ها" items={c.timeframes} placeholder="تایم‌فریم جدید (مثلاً 30m)" onChange={setList('timeframes')} />
      <StringList title="اهرم‌ها" items={c.leverages} placeholder="اهرم جدید (مثلاً 75)" onChange={setList('leverages')} />

      <RiskCapCard config={c} persist={persist} />

      <div className="card">
        <h2>چک‌لیست ورود</h2>
        <p className="muted hint">روی معامله‌های جدید اعمال می‌شه.</p>
        <div className="ck-list">
          {c.checklist.map((x) => (
            <div key={x.id} className="ck-edit"><span>{x.label}</span><button onClick={() => removeCk(x.id)} aria-label="حذف">×</button></div>
          ))}
          {c.checklist.length === 0 && <span className="muted">موردی نیست.</span>}
        </div>
        <div className="addrow">
          <input type="text" value={ck} onChange={(e) => setCk(e.target.value)} placeholder="مورد جدید چک‌لیست" onKeyDown={(e) => e.key === 'Enter' && addCk()} />
          <button className="act" onClick={addCk}>افزودن</button>
        </div>
      </div>

      <div className="card">
        <h2>روتین آماده‌سازی <span className="tag">تاپ‌داون</span></h2>
        <p className="muted hint" style={{ margin: 0 }}>مرحله‌های آماده‌سازیِ هر تایم‌فریم. تو تب «روتین» قبل از معامله تیک می‌زنی.</p>
      </div>
      <StringList title="ماهانه" items={c.routines.monthly} placeholder="مرحلهٔ ماهانه" onChange={setRoutine('monthly')} />
      <StringList title="هفتگی" items={c.routines.weekly} placeholder="مرحلهٔ هفتگی" onChange={setRoutine('weekly')} />
      <StringList title="روزانه" items={c.routines.daily} placeholder="مرحلهٔ روزانه" onChange={setRoutine('daily')} />
      <StringList title="۴ساعته" items={c.routines.h4} placeholder="مرحلهٔ ۴ساعته" onChange={setRoutine('h4')} />

      <div className="card">
        <h2>تایم‌فریمِ مرجعِ ترند <span className="tag">هشدار خلاف‌جهت</span></h2>
        <p className="muted hint">مبنای کارت «هم‌جهت با ترند» در داشبورد و هشدارِ موقع ثبت معامله.</p>
        <div className="chips">
          {(['monthly', 'weekly', 'daily', 'h4'] as Cadence[]).map((cad) => (
            <button key={cad} className={'chip' + (c.trendRefCadence === cad ? ' active' : '')} onClick={() => persist({ ...c, trendRefCadence: cad })}>{CADENCE_FA[cad]}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
