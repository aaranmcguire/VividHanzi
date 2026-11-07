import { describe, expect, it } from 'vitest'
import { createFakeFetch, jsonResponse } from '../../test/fakeFetch.ts'
import { LOCAL_BACKEND, loadBackendConfig } from './config.ts'

describe('loadBackendConfig', () => {
  it('reads the identity and storage backend from the Worker', async () => {
    const fake = createFakeFetch([
      [
        '/api/config',
        jsonResponse({ identity: 'cloudflare-access', storage: 'd1', access: true, d1: true }),
      ],
    ])

    await expect(loadBackendConfig(fake.fetch)).resolves.toEqual({
      identity: 'cloudflare-access',
      storage: 'd1',
      access: true,
    })
  })

  it('falls back to local storage when the endpoint is missing or offline', async () => {
    const fake = createFakeFetch([['/api/config', jsonResponse({ error: 'no' }, { status: 404 })]])

    await expect(loadBackendConfig(fake.fetch)).resolves.toEqual(LOCAL_BACKEND)
    await expect(loadBackendConfig()).resolves.toEqual(LOCAL_BACKEND)
  })

  it('ignores unknown values', async () => {
    const fake = createFakeFetch([
      ['/api/config', jsonResponse({ identity: 'magic', storage: 'tape' })],
    ])

    await expect(loadBackendConfig(fake.fetch)).resolves.toEqual(LOCAL_BACKEND)
  })
})
