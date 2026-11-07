import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getBrowserStorage, type KeyValueStorage } from '../../lib/storage.ts'
import { AccountContext, type AccountContextValue, type SyncStatus } from '../account/accountContext.ts'
import { observeStorage } from '../sync/observeStorage.ts'
import { isSyncedKey } from '../sync/snapshot.ts'
import { syncUserData } from '../sync/sync.ts'
import { markSyncDirty } from '../sync/syncState.ts'
import type { BackendConfig } from './config.ts'
import { createD1Cloud, getDeviceToken, loadD1User, type D1User } from './d1.ts'

/** Wait after the last change before uploading: a session changes data on every answer. */
const PUSH_DELAY_MS = 3000

type D1AccountProviderProps = {
  children: (storage: KeyValueStorage | undefined) => ReactNode
  config: BackendConfig
  storage?: KeyValueStorage
  fetchFn?: typeof fetch
}

/**
 * Cloud sync with the Worker's D1 storage. The browser keeps its copy in
 * localStorage (so the app works offline and loads synchronously); this
 * provider syncs it with D1, identified by Cloudflare Access or, as a
 * fallback, a random device token.
 */
export function D1AccountProvider({ children, config, storage, fetchFn }: D1AccountProviderProps) {
  const baseStorage = storage ?? getBrowserStorage()
  const request = useMemo(
    () => fetchFn ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)),
    [fetchFn],
  )
  const headers = useCallback((): Record<string, string> => {
    return config.identity === 'anonymous'
      ? { 'X-Device-Token': getDeviceToken(baseStorage) }
      : {}
  }, [config.identity, baseStorage])
  const cloud = useMemo(() => createD1Cloud(request, headers), [request, headers])

  const [user, setUser] = useState<D1User | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [dataVersion, setDataVersion] = useState(0)

  const changes = useRef(0)
  const session = useRef<{ id: string } | null>(null)
  const running = useRef(false)
  const runAgain = useRef(false)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const sync = useCallback(async () => {
    if (running.current) {
      runAgain.current = true
      return
    }
    running.current = true
    try {
      do {
        runAgain.current = false
        const current = session.current
        if (!current) return
        setSyncStatus('syncing')
        const localChanged = await syncUserData({
          cloud,
          userId: current.id,
          storage: baseStorage,
          changeCount: () => changes.current,
        })
        if (localChanged) setDataVersion((version) => version + 1)
        setSyncStatus('synced')
      } while (runAgain.current)
    } catch (error) {
      console.error('D1 sync failed', error)
      setSyncStatus('error')
    } finally {
      running.current = false
    }
  }, [cloud, baseStorage])

  const handleChange = useCallback(
    (key: string) => {
      if (!isSyncedKey(key)) return
      changes.current += 1
      markSyncDirty(baseStorage)
      if (!session.current) return
      clearTimeout(pushTimer.current)
      pushTimer.current = setTimeout(() => void sync(), PUSH_DELAY_MS)
    },
    [baseStorage, sync],
  )

  // The storage is created once; changes go through `listener` so the latest
  // handleChange is always used
  const [listener] = useState(createListener)
  useEffect(() => listener.set(handleChange), [listener, handleChange])
  const userStorage = useMemo(
    () => baseStorage && observeStorage(baseStorage, listener.call),
    [baseStorage, listener],
  )

  // Who is this? Cloudflare Access adds its JWT at the edge; without it the
  // device token keeps a browser's data separate.
  useEffect(() => {
    let cancelled = false
    loadD1User(request, headers).then(
      (identity) => {
        if (cancelled) return
        setUser(identity)
        setLoading(false)
      },
      (error) => {
        if (cancelled) return
        console.error('D1 identity failed', error)
        setUser(null)
        setSyncStatus('error')
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [request, headers])

  // Signed in: sync now, and again every time the user comes back to the app
  useEffect(() => {
    if (!user) {
      session.current = null
      return
    }
    session.current = { id: user.id }
    const firstSync = setTimeout(() => void sync(), 0)

    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    document.addEventListener('visibilitychange', syncWhenVisible)
    window.addEventListener('online', syncWhenVisible)
    return () => {
      document.removeEventListener('visibilitychange', syncWhenVisible)
      window.removeEventListener('online', syncWhenVisible)
      clearTimeout(firstSync)
      clearTimeout(pushTimer.current)
    }
  }, [user, sync])

  const value = useMemo<AccountContextValue>(
    () => ({
      enabled: true,
      loading,
      user,
      syncStatus: user ? syncStatus : 'idle',
      provider: config.identity === 'cloudflare-access' ? 'cloudflare-access' : 'anonymous',
      signInWithGoogle: async () => {},
      sendEmailLink: async () => {},
      signOut: async () => {
        if (config.identity === 'cloudflare-access') {
          window.location.assign('/cdn-cgi/access/logout')
          return
        }
        // The device token is the identity: clearing it would orphan the D1
        // copy, so "sign out" only stops syncing in this tab.
        session.current = null
        setUser(null)
        setSyncStatus('idle')
      },
    }),
    [config.identity, loading, user, syncStatus],
  )

  return (
    <AccountContext value={value}>
      <Fragment key={dataVersion}>{children(userStorage)}</Fragment>
    </AccountContext>
  )
}

/** A function whose behaviour can change without changing its reference. */
function createListener() {
  let handler = (_key: string) => {}
  return {
    call: (key: string) => handler(key),
    set: (next: (key: string) => void) => {
      handler = next
    },
  }
}
