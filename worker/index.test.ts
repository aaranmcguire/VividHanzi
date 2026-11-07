import { describe, expect, it, vi } from 'vitest'
import worker from './index.ts'

type WorkerEnv = Parameters<typeof worker.fetch>[1]
type AiRun = (model: string, input: unknown) => Promise<unknown>

function env(run?: AiRun, extra: Record<string, unknown> = {}): WorkerEnv {
  return {
    AI: run ? { run } : undefined,
    ASSETS: { fetch: async () => new Response('asset') },
    ...extra,
  } as unknown as WorkerEnv
}

function request(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
  method = body === undefined ? 'GET' : 'POST',
): Request {
  const allHeaders = {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
  }
  return new Request(`https://vividhanzi.test${path}`, {
    method,
    headers: Object.keys(allHeaders).length > 0 ? allHeaders : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const sample = { chinese: '我喜欢猫。', reference: 'I like cats.', answer: 'I like cats.' }

describe('Worker storage routes', () => {
  const token = 'device-token-1234567890'
  const anonymousEnv = (extra: Record<string, unknown> = {}) =>
    env(undefined, {
      IDENTITY_PROVIDER: 'anonymous',
      STORAGE_BACKEND: 'd1',
      ALLOW_ANONYMOUS: 'true',
      ...extra,
    })

  it('reports the active identity and storage backend', async () => {
    const response = await worker.fetch(request('/api/config'), anonymousEnv({ DB: new FakeD1() }))

    expect(await response.json()).toEqual({
      identity: 'anonymous',
      storage: 'd1',
      access: false,
      d1: true,
    })
  })

  it('reports Cloudflare Access when it is configured', async () => {
    const response = await worker.fetch(
      request('/api/config'),
      env(undefined, {
        DB: new FakeD1(),
        IDENTITY_PROVIDER: 'cloudflare-access',
        STORAGE_BACKEND: 'd1',
        ACCESS_AUD: 'aud-tag',
        ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
      }),
    )

    expect(await response.json()).toEqual({
      identity: 'cloudflare-access',
      storage: 'd1',
      access: true,
      d1: true,
    })
  })

  it('falls back to local storage without D1', async () => {
    const response = await worker.fetch(request('/api/config'), anonymousEnv())

    expect(await response.json()).toMatchObject({ identity: 'anonymous', storage: 'local' })
  })

  it('identifies an anonymous device by its token', async () => {
    const response = await worker.fetch(
      request('/api/me', undefined, { 'X-Device-Token': token }),
      anonymousEnv(),
    )
    const body = (await response.json()) as { id: string; provider: string; anonymous: boolean }

    expect(response.status).toBe(200)
    expect(body.id).toMatch(/^[0-9a-f]{64}$/)
    expect(body).toMatchObject({ provider: 'anonymous', anonymous: true })
  })

  it('rejects a request without an identity', async () => {
    const response = await worker.fetch(request('/api/me'), anonymousEnv())

    expect(response.status).toBe(401)
  })

  it('stores and reads the synced snapshot in D1', async () => {
    const db = new FakeD1()
    const environment = anonymousEnv({ DB: db })
    const headers = { 'X-Device-Token': token }
    const data = {
      'hanzivocab.settings': { version: 2, sessionSize: 5 },
      'hanzivocab.progress': { version: 1, items: {} },
      'not-synced': { secret: true },
    }

    const saved = await worker.fetch(
      request('/api/state', { data }, headers, 'PUT'),
      environment,
    )
    expect(saved.status).toBe(200)
    expect(db.rows).toHaveLength(2)

    const loaded = await worker.fetch(request('/api/state', undefined, headers), environment)
    const body = (await loaded.json()) as { data: Record<string, unknown>; updatedAt: string }
    expect(body.data).toEqual({
      'hanzivocab.settings': { version: 2, sessionSize: 5 },
      'hanzivocab.progress': { version: 1, items: {} },
    })
    expect(body.updatedAt).not.toBe('')
  })

  it('does not share state between device tokens', async () => {
    const db = new FakeD1()
    const environment = anonymousEnv({ DB: db })
    await worker.fetch(
      request(
        '/api/state',
        { data: { 'hanzivocab.settings': { version: 2 } } },
        { 'X-Device-Token': token },
        'PUT',
      ),
      environment,
    )

    const other = await worker.fetch(
      request('/api/state', undefined, { 'X-Device-Token': 'other-device-token-123' }),
      environment,
    )
    expect((await other.json()) as { data: unknown }).toMatchObject({ data: {} })
  })
})

class FakeD1 {
  rows: { user_id: string; key: string; value: string; updated_at: string }[] = []

  prepare(query: string) {
    return new FakeD1Statement(this, query)
  }

  async batch(statements: FakeD1Statement[]) {
    for (const statement of statements) statement.execute()
  }
}

class FakeD1Statement {
  private values: unknown[] = []
  private readonly db: FakeD1
  private readonly query: string

  constructor(db: FakeD1, query: string) {
    this.db = db
    this.query = query
  }

  bind(...values: unknown[]) {
    this.values = values
    return this
  }

  async all() {
    if (!this.query.startsWith('SELECT')) return { results: [] }
    const [userId] = this.values
    return { results: this.db.rows.filter((row) => row.user_id === userId) }
  }

  execute() {
    if (this.query.startsWith('DELETE')) {
      const [userId] = this.values
      this.db.rows = this.db.rows.filter((row) => row.user_id !== userId)
    } else if (this.query.startsWith('INSERT')) {
      const [user_id, key, value, updated_at] = this.values as string[]
      this.db.rows.push({ user_id: user_id!, key: key!, value: value!, updated_at: updated_at! })
    }
  }
}

describe('Worker AI routes', () => {
  it('reports the model when the AI binding exists', async () => {
    const response = await worker.fetch(request('/api/ai'), env(async () => ({ response: '' })))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      available: true,
      model: '@cf/deepseek-ai/deepseek-v4.1-flash-1017',
    })
  })

  it('reports unavailable without the binding', async () => {
    const response = await worker.fetch(request('/api/ai'), env())

    expect(await response.json()).toEqual({
      available: false,
      model: '@cf/deepseek-ai/deepseek-v4.1-flash-1017',
    })
  })

  it('grades a translation with the model', async () => {
    let usedModel: string | undefined
    const run: AiRun = async (model) => {
      usedModel = model
      return {
        response: JSON.stringify({
          verdict: 'Correct',
          feedback: 'Nice work.',
          memoryTip: '猫 is a cat.',
        }),
      }
    }
    const response = await worker.fetch(request('/api/ai/grade', sample), env(run))

    expect(response.status).toBe(200)
    expect(usedModel).toBe('@cf/deepseek-ai/deepseek-v4.1-flash-1017')
    expect(await response.json()).toEqual({
      verdict: 'correct',
      feedback: 'Nice work.',
      memoryTip: '猫 is a cat.',
    })
  })

  it('gives a hint with the model', async () => {
    const run: AiRun = async () => ({
      response: JSON.stringify({ hint: 'Start with the subject.', memoryTip: '我 is the speaker.' }),
    })
    const response = await worker.fetch(
      request('/api/ai/hint', { chinese: '我喝茶。', reference: 'I drink tea.' }),
      env(run),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      hint: 'Start with the subject.',
      memoryTip: '我 is the speaker.',
    })
  })

  it('turns a free-plan model error into a plan code', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const run: AiRun = async () => {
      throw new Error(
        '5035: Model @cf/deepseek-ai/deepseek-v4.1-flash-1017 is not available on the Workers Free plan.',
      )
    }
    const response = await worker.fetch(request('/api/ai/grade', sample), env(run))
    spy.mockRestore()

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ error: 'Workers AI is unavailable', code: 'plan' })
  })

  it('rejects an incomplete request without calling the model', async () => {
    let called = false
    const run: AiRun = async () => {
      called = true
      return { response: '{}' }
    }
    const response = await worker.fetch(
      request('/api/ai/grade', { chinese: '你好。', reference: 'Hello.' }),
      env(run),
    )

    expect(response.status).toBe(400)
    expect(called).toBe(false)
  })

  it('serves static assets for everything else', async () => {
    const response = await worker.fetch(request('/some/route'), env())

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('asset')
  })

  it('returns JSON 404 for unknown API routes', async () => {
    const response = await worker.fetch(request('/api/unknown'), env())

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
  })
})
