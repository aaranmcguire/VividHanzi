import type { SupabaseClient } from '@supabase/supabase-js'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getBrowserStorage, type KeyValueStorage } from '../../lib/storage.ts'
import { observeStorage } from '../sync/observeStorage.ts'
import { isSyncedKey } from '../sync/snapshot.ts'
import { syncUserData } from '../sync/sync.ts'
import { clearSyncState, markSyncDirty } from '../sync/syncState.ts'
import { AccountContext, type AccountContextValue, type AccountUser, type SyncStatus } from './accountContext.ts'
import { createSupabaseCloud, getSupabaseConfig, loadSupabaseClient, type SupabaseConfig } from './supabase.ts'

const DEFAULT_CONFIG = getSupabaseConfig()

/** Wait after the last change before uploading: a practice session changes progress on every answer. */
const PUSH_DELAY_MS = 3000

type AccountProviderProps = {
  /** Receives the storage the user's data should use. */
  children: (storage: KeyValueStorage | undefined) => ReactNode
  storage?: KeyValueStorage
  /** Supabase project; defaults to the one in `.env.*`. `null` turns accounts off. */
  config?: SupabaseConfig | null
}

/**
 * Optional account and sync. Signed out, everything stays in localStorage as
 * before. Signed in, every change to the user's data is uploaded to Supabase
 * (batched) and, on sign-in or when returning to the app, changes from other
 * devices are downloaded (see sync/syncUserData).
 *
 * The data Providers load only once when they mount, so when a sync changes
 * what is stored they are remounted with a new `key`.
 */
export function AccountProvider({ children, storage, config = DEFAULT_CONFIG }: AccountProviderProps) {
  const baseStorage = storage ?? getBrowserStorage()
  const [dataVersion, setDataVersion] = useState(0)
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [user, setUser] = useState<AccountUser | null>(null)
  const [loading, setLoading] = useState(config !== null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')

  const changes = useRef(0)
  const session = useRef<{ client: SupabaseClient; userId: string } | null>(null)
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
          cloud: createSupabaseCloud(current.client),
          userId: current.userId,
          storage: baseStorage,
          changeCount: () => changes.current,
        })
        if (localChanged) setDataVersion((version) => version + 1)
        setSyncStatus('synced')
      } while (runAgain.current)
    } catch (error) {
      // Offline or Supabase down: changes stay marked as pending and upload next time.
      // Logged so the cause (e.g. a missing table) shows in the browser console.
      console.error('Sync failed', error)
      setSyncStatus('error')
    } finally {
      running.current = false
    }
  }, [baseStorage])

  // Every change to the user's data is recorded and, when signed in, uploaded shortly after
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
  // The storage is created once; change events go through `listener` so the
  // latest handleChange is always used
  const [listener] = useState(createListener)
  useEffect(() => listener.set(handleChange), [listener, handleChange])
  const userStorage = useMemo(
    () => baseStorage && observeStorage(baseStorage, listener.call),
    [baseStorage, listener],
  )

  // Load Supabase and listen to the session. When returning from Google or the
  // email link, the library exchanges the ?code= in the URL and reports the new session here.
  useEffect(() => {
    if (!config) return
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    loadSupabaseClient(config)
      .then((loaded) => {
        if (cancelled) return
        setClient(loaded)
        const { data } = loaded.auth.onAuthStateChange((_event, authSession) => {
          const authUser = authSession?.user
          setUser((previous) => {
            if (!authUser) return null
            return previous?.id === authUser.id ? previous : { id: authUser.id, email: authUser.email ?? null }
          })
          setLoading(false)
        })
        unsubscribe = () => data.subscription.unsubscribe()
      })
      .catch(() => setLoading(false))
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [config])

  // Signed in: sync now, and again every time the user comes back to the app
  useEffect(() => {
    if (!client || !user) {
      session.current = null
      return
    }
    session.current = { client, userId: user.id }
    removeAuthCodeFromUrl()
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
  }, [client, user, sync])

  const value = useMemo<AccountContextValue>(
    () => ({
      enabled: config !== null,
      loading,
      user,
      syncStatus: user ? syncStatus : 'idle',
      provider: 'supabase',
      signInWithGoogle: async () => {
        if (!client) return
        const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } })
        if (error) throw error
      },
      sendEmailLink: async (email) => {
        if (!client) return
        const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl() } })
        if (error) throw error
      },
      signOut: async () => {
        if (!client) return
        // Upload anything pending before signing out. The data stays in this browser.
        clearTimeout(pushTimer.current)
        await sync()
        await client.auth.signOut()
        clearSyncState(baseStorage)
      },
    }),
    [config, loading, user, syncStatus, client, sync, baseStorage],
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

/** Where the user lands after signing in: the app's home page. */
function appUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}

/** Removes the one-time ?code= left by sign-in, so it doesn't stay in the address bar. */
function removeAuthCodeFromUrl() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('code')) return
  url.searchParams.delete('code')
  window.history.replaceState(window.history.state, '', url)
}
