import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../../test/memoryStorage.ts'
import { createD1Cloud, DEVICE_TOKEN_KEY, getDeviceToken, loadD1User } from './d1.ts'

describe('getDeviceToken', () => {
  it('creates a token once and reuses it', () => {
    const storage = memoryStorage()
    const token = getDeviceToken(storage)

    expect(token).toHaveLength(64)
    expect(storage.getItem(DEVICE_TOKEN_KEY)).toBe(token)
    expect(getDeviceToken(storage)).toBe(token)
  })
})

describe('createD1Cloud', () => {
  it('loads and saves the snapshot through the Worker', async () => {
    const calls: { url: string; method: string; body?: string }[] = []
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        ...(typeof init?.body === 'string' && { body: init.body }),
      })
      if (init?.method === 'PUT') return new Response(JSON.stringify({ updatedAt: '2026-11-06T00:00:00.000Z' }))
      return new Response(
        JSON.stringify({
          data: { 'hanzivocab.settings': { version: 2, sessionSize: 5 } },
          updatedAt: '2026-11-05T00:00:00.000Z',
        }),
      )
    }
    const cloud = createD1Cloud(fetchFn, () => ({ 'X-Device-Token': 'token-1234567890' }))

    await expect(cloud.load('user-1')).resolves.toEqual({
      data: { 'hanzivocab.settings': { version: 2, sessionSize: 5 } },
      updatedAt: '2026-11-05T00:00:00.000Z',
    })
    await expect(
      cloud.save('user-1', { 'hanzivocab.settings': { version: 2, sessionSize: 10 } }),
    ).resolves.toBe('2026-11-06T00:00:00.000Z')

    expect(calls).toEqual([
      { url: '/api/state', method: 'GET' },
      {
        url: '/api/state',
        method: 'PUT',
        body: JSON.stringify({ data: { 'hanzivocab.settings': { version: 2, sessionSize: 10 } } }),
      },
    ])
  })

  it('treats 401 as no cloud copy', async () => {
    const fetchFn: typeof fetch = async () => new Response(null, { status: 401 })
    const cloud = createD1Cloud(fetchFn, () => ({}))

    await expect(cloud.load('user-1')).resolves.toBeNull()
  })
})

describe('loadD1User', () => {
  it('reads the Worker identity', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ id: 'u1', email: 'a@example.com', anonymous: false }))

    await expect(loadD1User(fetchFn, () => ({}))).resolves.toEqual({
      id: 'u1',
      email: 'a@example.com',
      anonymous: false,
    })
  })

  it('returns null for an unauthenticated request', async () => {
    const fetchFn: typeof fetch = async () => new Response(null, { status: 401 })

    await expect(loadD1User(fetchFn, () => ({}))).resolves.toBeNull()
  })
})
