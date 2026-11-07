import { isRecord, type KeyValueStorage } from '../../lib/storage.ts'
import { parseSnapshot } from '../sync/snapshot.ts'
import type { CloudStore } from '../sync/sync.ts'

/** The anonymous device token, when Cloudflare Access is not configured. */
export const DEVICE_TOKEN_KEY = 'hanzivocab.device'

/** Used when localStorage is unavailable, so all requests in a session share one identity. */
let memoryToken: string | undefined

export function getDeviceToken(storage?: KeyValueStorage): string {
  const saved = storage?.getItem(DEVICE_TOKEN_KEY)
  if (saved && saved.length >= 16) return saved
  if (!storage && memoryToken) return memoryToken
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  if (storage) storage.setItem(DEVICE_TOKEN_KEY, token)
  else memoryToken = token
  return token
}

export interface D1User {
  id: string
  email: string | null
  anonymous: boolean
}

/** The Worker's /api/me, or null when the request has no identity (401). */
export async function loadD1User(
  request: typeof fetch,
  headers: () => Record<string, string>,
): Promise<D1User | null> {
  const response = await request('/api/me', {
    headers: { Accept: 'application/json', ...headers() },
  })
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`Identity request failed (${response.status})`)
  const data: unknown = await response.json()
  if (!isRecord(data) || typeof data.id !== 'string') {
    throw new Error('The identity response is invalid')
  }
  return {
    id: data.id,
    email: typeof data.email === 'string' ? data.email : null,
    anonymous: data.anonymous === true,
  }
}

/**
 * CloudStore backed by the Worker's /api/state and D1. The server identifies
 * the user, so the userId passed by the sync layer is not sent.
 */
export function createD1Cloud(
  request: typeof fetch,
  headers: () => Record<string, string>,
): CloudStore {
  return {
    load: async () => {
      const response = await request('/api/state', {
        headers: { Accept: 'application/json', ...headers() },
      })
      if (response.status === 401) return null
      if (!response.ok) throw new Error(`State request failed (${response.status})`)
      const value: unknown = await response.json()
      if (!isRecord(value) || !isRecord(value.data)) return null
      const data = parseSnapshot(value.data)
      const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : ''
      if (Object.keys(data).length === 0 && updatedAt === '') return null
      return { data, updatedAt }
    },
    save: async (_userId, data) => {
      const response = await request('/api/state', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...headers(),
        },
        body: JSON.stringify({ data }),
      })
      if (!response.ok) throw new Error(`State save failed (${response.status})`)
      const value: unknown = await response.json()
      return isRecord(value) && typeof value.updatedAt === 'string'
        ? value.updatedAt
        : new Date().toISOString()
    },
  }
}
