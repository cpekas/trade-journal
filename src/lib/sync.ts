import { api } from './api'
import { tradesRepo, configRepo, type JournalConfig } from './repo'

const CONFIG_LS_KEY = 'tj.config.v1'

async function syncConfig() {
  const server = await api<JournalConfig | null>('/config')
  const hasLocal = localStorage.getItem(CONFIG_LS_KEY) != null
  if (server == null) {
    // server has none yet — seed it from local
    await api('/config', { method: 'PUT', body: { config: configRepo.getSync() } })
  } else if (!hasLocal) {
    // fresh device — adopt the server's config
    configRepo.save(server)
  } else {
    // both exist — this device's config wins (push it up)
    await api('/config', { method: 'PUT', body: { config: configRepo.getSync() } })
  }
}

async function syncTrades() {
  const lastPulledAt = tradesRepo.getLastPulledAt()
  const changes = tradesRepo.changesForPush()
  const res = await api<{ trades: any[]; serverTime: string }>('/sync', {
    method: 'POST',
    body: { lastPulledAt, changes },
  })
  tradesRepo.applyServerChanges(res.trades)
  tradesRepo.setLastPulledAt(res.serverTime)
  tradesRepo.clearTombstones()
}

// Push local changes, pull remote, merge into localStorage. Throws on network/auth error.
export async function syncAll(): Promise<void> {
  await syncConfig()
  await syncTrades()
}
