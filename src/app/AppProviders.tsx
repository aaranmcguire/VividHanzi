import { useEffect, useState, type ReactNode } from 'react'
import type { KeyValueStorage } from '../lib/storage.ts'
import { AccountProvider } from '../features/account/AccountProvider.tsx'
import { D1AccountProvider } from '../features/backend/D1AccountProvider.tsx'
import { LOCAL_BACKEND, loadBackendConfig, type BackendConfig } from '../features/backend/config.ts'
import { CustomSetsProvider } from '../features/customSets/CustomSetsProvider.tsx'
import { DictionaryProvider } from '../features/dictionary/DictionaryProvider.tsx'
import type { LoadChunk } from '../features/dictionary/dictionaryStore.ts'
import type { DictionaryCache } from '../features/dictionary/runtime/dictionaryCache.ts'
import { RuntimeSourcesProvider } from '../features/dictionary/runtime/RuntimeSourcesProvider.tsx'
import { MyStudiesProvider } from '../features/myStudies/MyStudiesProvider.tsx'
import { ProgressProvider } from '../features/progress/ProgressProvider.tsx'
import { SettingsProvider } from '../features/settings/SettingsProvider.tsx'

type AppProvidersProps = {
  children: ReactNode
  /** Storage for the user's data; localStorage by default. */
  storage?: KeyValueStorage
  /** Where the full dictionary chunks come from; the data repository by default. */
  loadChunk?: LoadChunk
  /** Cache for external sources (strokes, sentences); IndexedDB by default. */
  cache?: DictionaryCache
  /** How external sources are called; the browser's fetch by default. */
  fetchFn?: typeof fetch
  /** Tests pass a fixed backend; without it the app asks the Worker. */
  backend?: BackendConfig
}

/**
 * State shared by the whole app. It starts with local storage and, if the
 * Worker says another backend is configured, switches to D1 or Supabase
 * after the first config request. Tests pass a fixed backend.
 */
export function AppProviders({
  children,
  storage,
  loadChunk,
  cache,
  fetchFn,
  backend,
}: AppProvidersProps) {
  const [activeBackend, setActiveBackend] = useState<BackendConfig>(backend ?? LOCAL_BACKEND)

  useEffect(() => {
    if (backend) return
    let active = true
    loadBackendConfig(fetchFn).then((config) => {
      // Local is already the initial state: no update on static hosting/tests.
      if (active && (config.identity !== 'local' || config.storage !== 'local')) {
        setActiveBackend(config)
      }
    })
    return () => {
      active = false
    }
  }, [backend, fetchFn])

  return (
    <ConfiguredProviders
      backend={activeBackend}
      storage={storage}
      loadChunk={loadChunk}
      cache={cache}
      fetchFn={fetchFn}
    >
      {children}
    </ConfiguredProviders>
  )
}

type ConfiguredProvidersProps = Omit<AppProvidersProps, 'backend'>

function ConfiguredProviders({
  children,
  storage,
  loadChunk,
  cache,
  fetchFn,
  backend,
}: ConfiguredProvidersProps & { backend: BackendConfig }) {
  const dataProviders = (userStorage: KeyValueStorage | undefined) => (
    <SettingsProvider storage={userStorage}>
      <ProgressProvider storage={userStorage}>
        <MyStudiesProvider storage={userStorage}>
          <CustomSetsProvider storage={userStorage}>{children}</CustomSetsProvider>
        </MyStudiesProvider>
      </ProgressProvider>
    </SettingsProvider>
  )

  return (
    <RuntimeSourcesProvider cache={cache} fetchFn={fetchFn}>
      <DictionaryProvider loadChunk={loadChunk}>
        {backend.storage === 'supabase' ? (
          <AccountProvider storage={storage}>{dataProviders}</AccountProvider>
        ) : backend.storage === 'd1' &&
          (backend.identity === 'cloudflare-access' || backend.identity === 'anonymous') ? (
          <D1AccountProvider config={backend} storage={storage} fetchFn={fetchFn}>
            {dataProviders}
          </D1AccountProvider>
        ) : (
          dataProviders(storage)
        )}
      </DictionaryProvider>
    </RuntimeSourcesProvider>
  )
}
