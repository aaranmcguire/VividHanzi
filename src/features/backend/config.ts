import { isRecord } from '../../lib/storage.ts'

export type IdentityProvider = 'cloudflare-access' | 'supabase' | 'anonymous' | 'local'
export type StorageBackend = 'd1' | 'supabase' | 'local'

/** Which identity and storage backend the Worker says are active. */
export interface BackendConfig {
  identity: IdentityProvider
  storage: StorageBackend
  /** Cloudflare Access is configured for the Worker. */
  access: boolean
}

export const LOCAL_BACKEND: BackendConfig = {
  identity: 'local',
  storage: 'local',
  access: false,
}

/**
 * Asks the Worker which backend is active. Static hosting has no /api/config,
 * so any failure means the app keeps its local-only behavior.
 */
export async function loadBackendConfig(fetchFn?: typeof fetch): Promise<BackendConfig> {
  const request = fetchFn ?? ((input, init) => fetch(input, init))
  try {
    const response = await request('/api/config', { headers: { Accept: 'application/json' } })
    if (!response.ok) return LOCAL_BACKEND
    const data: unknown = await response.json()
    if (!isRecord(data)) return LOCAL_BACKEND
    return {
      identity: isIdentity(data.identity) ? data.identity : 'local',
      storage: isStorage(data.storage) ? data.storage : 'local',
      access: data.access === true,
    }
  } catch {
    return LOCAL_BACKEND
  }
}

function isIdentity(value: unknown): value is IdentityProvider {
  return (
    value === 'cloudflare-access' ||
    value === 'supabase' ||
    value === 'anonymous' ||
    value === 'local'
  )
}

function isStorage(value: unknown): value is StorageBackend {
  return value === 'd1' || value === 'supabase' || value === 'local'
}
