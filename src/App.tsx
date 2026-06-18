import { useEffect, useMemo, useState } from 'react'
import TradeEditor from './components/TradeEditor'
import TradeList from './components/TradeList'
import TradeDetail from './components/TradeDetail'
import Dashboard from './components/Dashboard'
import Review from './components/Review'
import SettingsScreen from './components/Settings'
import Login from './components/Login'
import Logo from './components/Logo'
import CooldownGate, { TiltStrip, RoutineStrip } from './components/CooldownGate'
import Routine from './components/Routine'
import { tradesRepo, configRepo, fetchConfig, clearLocalData, type JournalConfig } from './lib/repo'
import { isLoggedIn, logout as doLogout, getUser } from './lib/auth'
import { syncAll } from './lib/sync'
import { ApiError } from './lib/api'
import { summarize, tiltState, routineStatus, startOfWeekKey } from './lib/stats'
import { reviewsRepo } from './lib/reviews'

type Overlay = null | { kind: 'detail' | 'close' | 'edit'; id: string } | { kind: 'settings' }
type ResultFilter = 'all' | 'open' | 'win' | 'loss'
type SyncState = 'idle' | 'syncing' | 'ok' | 'error' | 'offline'

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn())
  const [tab, setTab] = useState<'new' | 'list' | 'dash' | 'review' | 'routine'>('list')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [version, setVersion] = useState(0)
  const refresh = () => setVersion((v) => v + 1)
  const [config, setConfig] = useState<JournalConfig>(() => configRepo.getSync())
  const [showArchived, setShowArchived] = useState(false)
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [setupFilter, setSetupFilter] = useState<string>('all')
  const [now, setNow] = useState(Date.now())
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [nudgeAck, setNudgeAck] = useState(() => localStorage.getItem('tj.nudge.ack.v1') || '')

  const triggerSync = async () => {
    if (!isLoggedIn()) return
    if (!navigator.onLine) { setSyncState('offline'); return }
    setSyncState('syncing')
    try {
      await syncAll()
      setConfig(configRepo.getSync())
      refresh()
      setSyncState('ok')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        doLogout()
        setAuthed(false)
        return
      }
      setSyncState('error')
    }
  }
  const afterMutation = () => { refresh(); triggerSync() }

  useEffect(() => { fetchConfig().then(setConfig) }, [])
  useEffect(() => {
    if (authed) triggerSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])
  useEffect(() => {
    const onOnline = () => triggerSync()
    window.addEventListener('online', onOnline)
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => { window.removeEventListener('online', onOnline); clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const all = useMemo(() => tradesRepo.all(), [version])
  const tilt = useMemo(() => tiltState(all, now), [all, now])
  const routine = useMemo(() => routineStatus(config, now), [config, now, version])
  const active = useMemo(() => all.filter((t) => t.status !== 'archived'), [all])
  const archived = useMemo(() => all.filter((t) => t.status === 'archived'), [all])
  const s = useMemo(() => summarize(all), [all])
  const openCount = active.filter((t) => t.status === 'open').length

  const base = showArchived ? archived : active
  const listed = base.filter((t) => {
    if (resultFilter === 'open' && t.status !== 'open') return false
    if (resultFilter === 'win' && t.result !== 'win') return false
    if (resultFilter === 'loss' && t.result !== 'loss') return false
    if (setupFilter !== 'all' && t.setup !== setupFilter) return false
    return true
  })

  const closeOverlay = () => setOverlay(null)
  const goTab = (t: 'new' | 'list' | 'dash' | 'review' | 'routine') => { setTab(t); closeOverlay() }
  const selected = overlay && 'id' in overlay ? all.find((t) => t.id === overlay.id) : undefined

  if (!authed) {
    return <Login onAuthed={() => setAuthed(true)} />
  }

  const onLogout = () => {
    doLogout()
    clearLocalData()
    setConfig(configRepo.getSync())
    closeOverlay()
    setAuthed(false)
    refresh()
  }

  const syncLabel = syncState === 'syncing' ? '⟳' : syncState === 'ok' ? '✓' : syncState === 'offline' ? '⚇' : syncState === 'error' ? '⚠' : '↻'

  // in-app reminder: weekly review rule unset, or today's routine not done (no push needed)
  const weekRule = reviewsRepo.get('w:' + startOfWeekKey(new Date(now).toISOString()))
  const weeklyOverdue = !(weekRule.if && weekRule.then) && !weekRule.focus
  const dailyCad = routine.cadences.find((c) => c.cadence === 'daily')
  const dailyOverdue = !!dailyCad && dailyCad.total > 0 && !dailyCad.complete
  const nudge = weeklyOverdue
    ? { text: '⏰ قانونِ مرور این هفته رو نزدی', go: 'review' as const, ackKey: 'w:' + startOfWeekKey(new Date(now).toISOString()) }
    : dailyOverdue
      ? { text: '🧭 روتین امروزت رو کامل نکردی', go: 'routine' as const, ackKey: dailyCad!.key }
      : null
  const showNudge = !!nudge && nudgeAck !== nudge.ackKey
  const ackNudge = () => { if (nudge) { localStorage.setItem('tj.nudge.ack.v1', nudge.ackKey); setNudgeAck(nudge.ackKey) } }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <Logo />
          <h1>ژورنال معامله</h1>
          <button className={'sync-dot ' + syncState} onClick={triggerSync} title="سنک" aria-label="سنک">{syncLabel}</button>
          <button className="gear" onClick={() => setOverlay({ kind: 'settings' })} aria-label="تنظیمات">⚙</button>
        </div>
        <div className="tabs">
          <button className={!overlay && tab === 'new' ? 'active' : ''} onClick={() => goTab('new')}>ثبت</button>
          <button className={!overlay && tab === 'routine' ? 'active' : ''} onClick={() => goTab('routine')}>روتین</button>
          <button className={!overlay && tab === 'list' ? 'active' : ''} onClick={() => goTab('list')}>معامله‌ها</button>
          <button className={!overlay && tab === 'dash' ? 'active' : ''} onClick={() => goTab('dash')}>داشبورد</button>
          <button className={!overlay && tab === 'review' ? 'active' : ''} onClick={() => goTab('review')}>مرور</button>
        </div>
      </header>

      {overlay?.kind === 'settings' && (
        <SettingsScreen
          onBack={closeOverlay}
          onChange={() => { setConfig(configRepo.getSync()); triggerSync() }}
          email={getUser()?.email}
          onLogout={onLogout}
        />
      )}

      {selected && overlay?.kind === 'detail' && (
        <TradeDetail
          trade={selected}
          now={now}
          onBack={closeOverlay}
          onClose={() => setOverlay({ kind: 'close', id: selected.id })}
          onEdit={() => setOverlay({ kind: 'edit', id: selected.id })}
          onRestore={() => { tradesRepo.setStatus(selected.id, 'open'); afterMutation() }}
          onDelete={() => { if (confirm('این معاملهٔ باز برای همیشه حذف بشه؟')) { tradesRepo.remove(selected.id); afterMutation(); closeOverlay() } }}
        />
      )}

      {selected && (overlay?.kind === 'close' || overlay?.kind === 'edit') && (
        <TradeEditor
          mode={overlay.kind}
          initial={selected}
          config={config}
          onSave={() => { afterMutation(); setOverlay({ kind: 'detail', id: selected.id }) }}
          onCancel={() => setOverlay({ kind: 'detail', id: selected.id })}
        />
      )}

      {!overlay && tab === 'new' && (
        tilt.gate && tilt.key && localStorage.getItem('tj.tilt.ack.v1') !== tilt.key ? (
          <CooldownGate
            tilt={tilt}
            onProceed={() => { localStorage.setItem('tj.tilt.ack.v1', tilt.key!); refresh() }}
            onBack={() => goTab('list')}
          />
        ) : (
          <>
            <TiltStrip tilt={tilt} />
            <RoutineStrip status={routine} onOpen={() => goTab('routine')} />
            <TradeEditor mode="new" config={config} routineReady={routine.allComplete} onSave={() => { afterMutation(); goTab('list') }} onCancel={() => {}} />
          </>
        )
      )}

      {!overlay && tab === 'dash' && <Dashboard trades={all} />}

      {!overlay && tab === 'routine' && <Routine config={config} onChange={refresh} />}

      {!overlay && tab === 'review' && <Review trades={all} config={config} onChange={afterMutation} onSelectTrade={(id) => setOverlay({ kind: 'detail', id })} />}

      {!overlay && tab === 'list' && (
        <div className="list">
          {showNudge && nudge && (
            <div className="banner warn" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => { ackNudge(); goTab(nudge.go) }}>{nudge.text} — بزن بریم</span>
              <button className="ghost" onClick={ackNudge} aria-label="بعداً">باشه</button>
            </div>
          )}
          <div className="stats">
            <div className="stat"><div className="k">باز</div><div className="v">{openCount}</div></div>
            <div className="stat"><div className="k">نرخ برد</div><div className="v">{s.winRate}%</div></div>
            <div className="stat"><div className="k">میانگین R</div><div className={'v ' + (s.avgR >= 0 ? 'good' : 'bad')}>{s.avgR > 0 ? '+' : ''}{s.avgR}</div></div>
          </div>

          <div className="listhead">
            <button className={'chip' + (!showArchived ? ' active' : '')} onClick={() => setShowArchived(false)}>فعال ({active.length})</button>
            <button className={'chip' + (showArchived ? ' active' : '')} onClick={() => setShowArchived(true)}>آرشیو ({archived.length})</button>
          </div>

          <div className="filterbar">
            {(['all', 'open', 'win', 'loss'] as ResultFilter[]).map((rf) => (
              <button key={rf} className={'chip' + (resultFilter === rf ? ' active' : '')} onClick={() => setResultFilter(rf)}>
                {rf === 'all' ? 'همه' : rf === 'open' ? 'باز' : rf === 'win' ? 'سود' : 'ضرر'}
              </button>
            ))}
            <select value={setupFilter} onChange={(e) => setSetupFilter(e.target.value)}>
              <option value="all">همهٔ ستاپ‌ها</option>
              {config.setups.map((su) => <option key={su} value={su}>{su}</option>)}
            </select>
          </div>

          <TradeList
            trades={listed}
            now={now}
            onSelect={(id) => setOverlay({ kind: 'detail', id })}
            onClose={(id) => setOverlay({ kind: 'close', id })}
          />
        </div>
      )}
    </div>
  )
}
