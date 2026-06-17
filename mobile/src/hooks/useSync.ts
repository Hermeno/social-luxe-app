/**
 * useSync — background sync coordinator
 *
 * - Initialises NetInfo monitoring
 * - Processes sync queue when connectivity is restored
 * - Runs periodic sync every 5 minutes while app is active
 * - Exposes sync state (isOnline, isSyncing, lastSync)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { initNetInfo, isConnected, onConnectivityChange } from '../services/netinfo.service'
import { processQueue } from '../db/syncQueue'
import { getSyncMeta } from '../db/database'

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 min

export function useSync() {
  const [online, setOnline]     = useState(isConnected())
  const [syncing, setSyncing]   = useState(false)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const syncTimer               = useRef<ReturnType<typeof setInterval> | null>(null)
  // Ref-based guard so setInterval/event listeners always see current value (no stale closure)
  const syncingRef              = useRef(false)

  const runSync = useCallback(async () => {
    if (syncingRef.current || !isConnected()) return
    syncingRef.current = true
    setSyncing(true)
    try {
      await processQueue()
      const ts = await getSyncMeta('feed_last_sync')
      setLastSync(ts ? parseInt(ts, 10) : null)
    } catch {
      // silent — offline or transient error
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [])  // stable — guards via ref, not state

  useEffect(() => {
    // Init NetInfo
    const unsubNetInfo = initNetInfo()

    // Listen to connectivity changes
    const unsubConn = onConnectivityChange((connected) => {
      setOnline(connected)
      if (connected) runSync()
    })

    // Periodic sync every 5 minutes
    syncTimer.current = setInterval(() => {
      if (isConnected()) runSync()
    }, SYNC_INTERVAL_MS)

    // Sync when app comes to foreground
    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && isConnected()) runSync()
    })

    // Initial sync on mount
    if (isConnected()) runSync()

    return () => {
      unsubNetInfo()
      unsubConn()
      if (syncTimer.current) clearInterval(syncTimer.current)
      appStateSub.remove()
    }
  }, [])

  return { online, syncing, lastSync }
}
