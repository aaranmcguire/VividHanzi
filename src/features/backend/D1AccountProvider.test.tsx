import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders.tsx'
import { createEmptyProgress, recordAnswer } from '../progress/progress.ts'
import { saveProgress } from '../progress/storage.ts'
import { readSnapshot } from '../sync/snapshot.ts'
import { useAccount } from '../account/accountContext.ts'
import { useProgress } from '../progress/progressContext.ts'
import { jsonResponse } from '../../test/fakeFetch.ts'
import { memoryStorage } from '../../test/memoryStorage.ts'

const D1_BACKEND = { identity: 'anonymous', storage: 'd1', access: false } as const

function Probe() {
  const { progress } = useProgress()
  const account = useAccount()
  return (
    <p>
      {Object.keys(progress.items).length} items · {account.provider}
    </p>
  )
}

describe('D1AccountProvider', () => {
  it('pulls the D1 copy into the app and uploads the merged snapshot', async () => {
    const remote = memoryStorage()
    saveProgress(
      recordAnswer(createEmptyProgress(), 'word:谢谢', true, new Date('2026-11-01T00:00:00Z')),
      remote,
    )
    const snapshot = readSnapshot(remote)
    const calls: { url: string; method: string }[] = []
    const fetchFn: typeof fetch = async (input, init) => {
      const url = String(input)
      calls.push({ url, method: init?.method ?? 'GET' })
      if (url === '/api/me') return jsonResponse({ id: 'u1', email: null, anonymous: true })
      if (url === '/api/state') {
        if (init?.method === 'PUT') return jsonResponse({ updatedAt: '2026-11-06T00:00:00.000Z' })
        return jsonResponse({ data: snapshot, updatedAt: '2026-11-05T00:00:00.000Z' })
      }
      throw new TypeError('Failed to fetch')
    }

    render(
      <AppProviders storage={memoryStorage()} backend={D1_BACKEND} fetchFn={fetchFn}>
        <Probe />
      </AppProviders>,
    )

    expect(await screen.findByText('1 items · anonymous')).toBeInTheDocument()
    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true))
    expect(calls.some((call) => call.url === '/api/me')).toBe(true)
    expect(calls.some((call) => call.url === '/api/state')).toBe(true)
  })
})
