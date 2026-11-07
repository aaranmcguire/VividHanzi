/**
 * Cloudflare Worker for VividHanzi.
 *
 * It serves the static app, stores the user's data in D1 when configured, and
 * adds optional Workers AI endpoints used by the sentence exercises:
 *
 *   GET  /api/config     Which identity and storage backend are active?
 *   GET  /api/me         The current Cloudflare Access / device identity.
 *   GET  /api/state      The user's synced data from D1.
 *   PUT  /api/state      Replaces the user's synced data in D1.
 *   GET  /api/ai         Is Workers AI configured?
 *   POST /api/ai/grade   Grades an English translation of a Chinese sentence.
 *   POST /api/ai/hint    Gives a hint and a way to remember the sentence.
 *
 * Identity can be Cloudflare Access or an anonymous device token; storage can
 * be D1 or the existing Supabase path (chosen by the frontend from
 * /api/config). Without the AI binding the status says `available: false`.
 */

import { getAccessIdentity } from './access.ts'

const MODEL = '@cf/deepseek-ai/deepseek-v4.1-flash-1017'

/** Requests per IP and minute for the AI endpoints. */
const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000

const MAX_CHINESE = 120
const MAX_REFERENCE = 400
const MAX_ANSWER = 600
const MAX_FEEDBACK = 600
const MAX_TIP = 400

interface AiInput {
  messages: { role: 'system' | 'user'; content: string }[]
  max_tokens: number
  temperature: number
}

interface AiBinding {
  run(model: string, input: AiInput): Promise<unknown>
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  all<T>(): Promise<{ results: T[] }>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown>
}

interface Env {
  AI?: AiBinding
  ASSETS: { fetch(request: Request): Promise<Response> }
  DB?: D1Database
  IDENTITY_PROVIDER?: string
  STORAGE_BACKEND?: string
  ALLOW_ANONYMOUS?: string
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  ACCESS_TRUST_HEADER?: string
}

type IdentityProvider = 'cloudflare-access' | 'supabase' | 'anonymous' | 'local'
type StorageBackend = 'd1' | 'supabase' | 'local'

interface Identity {
  id: string
  email: string | null
  provider: 'cloudflare-access' | 'anonymous'
}

/** The app's synced data keys (see src/features/sync/snapshot.ts). */
const SYNCED_KEYS = new Set([
  'hanzivocab.progress',
  'hanzivocab.studies',
  'hanzivocab.customSets',
  'hanzivocab.settings',
])

/** D1 rows are limited to about 1 MB; keep each key below that. */
const MAX_VALUE_BYTES = 900_000
/** Maximum serialized size of one user's synced data. */
const MAX_STATE_BYTES = 3_600_000

interface GradeBody {
  chinese: string
  reference: string
  answer: string
}

interface HintBody {
  chinese: string
  reference: string
  answer: string
}

type Verdict = 'correct' | 'partial' | 'incorrect'

interface GradeResult {
  verdict: Verdict
  feedback: string
  memoryTip: string
}

interface HintResult {
  hint: string
  memoryTip: string
}

const recentRequests = new Map<string, number[]>()

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/config' && request.method === 'GET') {
      return json(backendConfig(env))
    }

    if (url.pathname === '/api/me' && request.method === 'GET') {
      return handleMe(request, env)
    }

    if (url.pathname === '/api/state' && (request.method === 'GET' || request.method === 'PUT')) {
      return handleState(request, env)
    }

    if (url.pathname === '/api/ai' && request.method === 'GET') {
      return json(env.AI ? { available: true, model: MODEL } : { available: false, model: MODEL })
    }

    if (url.pathname === '/api/ai/grade' && request.method === 'POST') {
      if (isRateLimited(request)) return json({ error: 'Too many requests' }, 429)
      return handleGrade(request, env)
    }

    if (url.pathname === '/api/ai/hint' && request.method === 'POST') {
      if (isRateLimited(request)) return json({ error: 'Too many requests' }, 429)
      return handleHint(request, env)
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404)

    // Everything else is the app: static files, with index.html for routes.
    return env.ASSETS.fetch(request)
  },
}

function backendConfig(env: Env): {
  identity: IdentityProvider
  storage: StorageBackend
  access: boolean
  d1: boolean
} {
  const storage: StorageBackend =
    env.STORAGE_BACKEND === 'supabase'
      ? 'supabase'
      : env.STORAGE_BACKEND === 'local' || !env.DB
        ? 'local'
        : 'd1'
  const identity: IdentityProvider =
    env.IDENTITY_PROVIDER === 'cloudflare-access' ||
    (env.IDENTITY_PROVIDER === undefined && env.ACCESS_AUD)
      ? 'cloudflare-access'
      : env.IDENTITY_PROVIDER === 'supabase'
        ? 'supabase'
        : env.IDENTITY_PROVIDER === 'local'
          ? 'local'
          : 'anonymous'
  return {
    identity,
    storage,
    access: Boolean(env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN),
    d1: Boolean(env.DB),
  }
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  try {
    const identity = await authenticate(request, env)
    if (!identity) return json({ error: 'Not authenticated' }, 401)
    return json({
      id: identity.id,
      email: identity.email,
      provider: identity.provider,
      anonymous: identity.provider === 'anonymous',
    })
  } catch (error) {
    console.error('Identity check failed', error)
    return json({ error: 'Could not check the identity' }, 502)
  }
}

async function handleState(request: Request, env: Env): Promise<Response> {
  const config = backendConfig(env)
  if (config.storage !== 'd1') return json({ error: 'D1 storage is not enabled' }, 501)
  const db = env.DB
  if (!db) return json({ error: 'D1 is not configured' }, 503)

  try {
    const identity = await authenticate(request, env)
    if (!identity) return json({ error: 'Not authenticated' }, 401)

    if (request.method === 'GET') {
      const { results } = await db
        .prepare('SELECT key, value, updated_at FROM user_state WHERE user_id = ?')
        .bind(identity.id)
        .all<{ key: string; value: string; updated_at: string }>()
      const data: Record<string, unknown> = {}
      let updatedAt = ''
      for (const row of results) {
        if (!SYNCED_KEYS.has(row.key)) continue
        try {
          data[row.key] = JSON.parse(row.value) as unknown
        } catch {
          // A corrupt row is ignored; the next save replaces it
        }
        if (row.updated_at > updatedAt) updatedAt = row.updated_at
      }
      return json({ data, updatedAt })
    }

    const body = await readJson(request)
    if (!body || !isRecord(body.data)) return json({ error: 'Invalid request' }, 400)
    const entries = Object.entries(body.data).filter(([key]) => SYNCED_KEYS.has(key))
    const serialized = entries.map(([key, value]) => [key, JSON.stringify(value)] as const)
    if (serialized.some(([, value]) => value.length > MAX_VALUE_BYTES)) {
      return json({ error: 'The data is too large' }, 413)
    }
    if (serialized.reduce((total, [, value]) => total + value.length, 0) > MAX_STATE_BYTES) {
      return json({ error: 'The data is too large' }, 413)
    }

    const now = new Date().toISOString()
    const statements = [db.prepare('DELETE FROM user_state WHERE user_id = ?').bind(identity.id)]
    for (const [key, value] of serialized) {
      statements.push(
        db
          .prepare('INSERT INTO user_state (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)')
          .bind(identity.id, key, value, now),
      )
    }
    await db.batch(statements)
    return json({ updatedAt: now })
  } catch (error) {
    console.error('D1 state request failed', error)
    return json({ error: 'The storage request failed' }, 502)
  }
}

async function authenticate(request: Request, env: Env): Promise<Identity | undefined> {
  if (
    env.IDENTITY_PROVIDER === 'cloudflare-access' ||
    (env.IDENTITY_PROVIDER === undefined && env.ACCESS_AUD)
  ) {
    const access = await getAccessIdentity(request, env)
    if (access) {
      const email = access.email.trim().toLowerCase()
      return {
        id: await hashId(`access:${email}`),
        email,
        provider: 'cloudflare-access',
      }
    }
  }

  if (env.IDENTITY_PROVIDER === 'anonymous' || env.ALLOW_ANONYMOUS === 'true') {
    const token = request.headers.get('X-Device-Token')?.trim()
    if (token && token.length >= 16 && token.length <= 200) {
      return { id: await hashId(`device:${token}`), email: null, provider: 'anonymous' }
    }
  }

  return undefined
}

async function hashId(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function handleGrade(request: Request, env: Env): Promise<Response> {
  if (!env.AI) return json({ error: 'Workers AI is not configured' }, 503)
  const body = await readGradeBody(request)
  if (!body) return json({ error: 'Invalid request' }, 400)

  const system = [
    'You are a friendly Chinese-to-English translation checker for a beginner learner.',
    'The learner translated a short Chinese sentence built only from vocabulary they know.',
    'Compare their English with the reference translation. Accept synonyms, articles, word order and small wording differences.',
    'Focus on whether the meaning is right. Use "partial" when the main meaning is mostly right but something important is missing or wrong.',
    'Return ONLY a JSON object with exactly these fields:',
    '{"verdict":"correct"|"partial"|"incorrect","feedback":"one or two short sentences, specific and encouraging","memoryTip":"one short memory aid for a key word or grammar point in the sentence"}',
    'Do not include markdown or any text outside the JSON.',
  ].join(' ')

  const user = `Chinese: ${body.chinese}\nReference: ${body.reference}\nLearner: ${body.answer}`

  try {
    const text = await runModel(env.AI, system, user, 0.1, 400)
    const result = parseGrade(text)
    if (!result) return json({ error: 'The AI response could not be read' }, 502)
    return json(result)
  } catch (error) {
    console.error('Workers AI grade failed', error)
    return aiErrorResponse(error)
  }
}

async function handleHint(request: Request, env: Env): Promise<Response> {
  if (!env.AI) return json({ error: 'Workers AI is not configured' }, 503)
  const body = await readHintBody(request)
  if (!body) return json({ error: 'Invalid request' }, 400)

  const system = [
    'You are a friendly Chinese tutor for a beginner learner.',
    'Give a hint for translating a short Chinese sentence into English, without giving the full translation.',
    'Point out the sentence structure or the meaning of one key word. Also give one short memory aid for a word or grammar point.',
    'Return ONLY a JSON object with exactly these fields:',
    '{"hint":"one or two short sentences","memoryTip":"one short memory aid"}',
    'Do not include markdown or any text outside the JSON.',
  ].join(' ')

  const user = `Chinese: ${body.chinese}\nReference (do not reveal it): ${body.reference}\nLearner's partial answer: ${body.answer || '(empty)'}`

  try {
    const text = await runModel(env.AI, system, user, 0.4, 300)
    const result = parseHint(text)
    if (!result) return json({ error: 'The AI response could not be read' }, 502)
    return json(result)
  } catch (error) {
    console.error('Workers AI hint failed', error)
    return aiErrorResponse(error)
  }
}

async function runModel(
  ai: AiBinding,
  system: string,
  user: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const result = await ai.run(MODEL, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    max_tokens: maxTokens,
  })
  const text = extractText(result)
  if (!text) throw new Error('Workers AI returned no text')
  return text
}

/** Workers AI returns `{ response }` for text generation; some models use OpenAI-style choices. */
function extractText(result: unknown): string | undefined {
  if (typeof result === 'string') return result
  if (!isRecord(result)) return undefined
  if (typeof result.response === 'string') return result.response
  const choices = result.choices
  if (!Array.isArray(choices)) return undefined
  const first = choices[0]
  if (!isRecord(first) || !isRecord(first.message)) return undefined
  return typeof first.message.content === 'string' ? first.message.content : undefined
}

function parseGrade(text: string): GradeResult | undefined {
  const value = parseJsonObject(text)
  if (!value) return undefined
  const verdict =
    typeof value.verdict === 'string' ? value.verdict.trim().toLowerCase() : undefined
  if (verdict !== 'correct' && verdict !== 'partial' && verdict !== 'incorrect') return undefined
  const feedback = clipText(value.feedback, MAX_FEEDBACK)
  if (!feedback) return undefined
  return {
    verdict,
    feedback,
    memoryTip: clipText(value.memoryTip, MAX_TIP) ?? '',
  }
}

function parseHint(text: string): HintResult | undefined {
  const value = parseJsonObject(text)
  if (!value) return undefined
  const hint = clipText(value.hint, MAX_FEEDBACK)
  if (!hint) return undefined
  return {
    hint,
    memoryTip: clipText(value.memoryTip, MAX_TIP) ?? '',
  }
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  try {
    const value: unknown = JSON.parse(cleaned.slice(start, end + 1))
    return isRecord(value) ? value : undefined
  } catch {
    return undefined
  }
}

async function readGradeBody(request: Request): Promise<GradeBody | undefined> {
  const value = await readJson(request)
  if (!value) return undefined
  const chinese = cleanText(value.chinese, MAX_CHINESE)
  const reference = cleanText(value.reference, MAX_REFERENCE)
  const answer = cleanText(value.answer, MAX_ANSWER)
  if (!chinese || !reference || !answer) return undefined
  return { chinese, reference, answer }
}

async function readHintBody(request: Request): Promise<HintBody | undefined> {
  const value = await readJson(request)
  if (!value) return undefined
  const chinese = cleanText(value.chinese, MAX_CHINESE)
  const reference = cleanText(value.reference, MAX_REFERENCE)
  if (!chinese || !reference) return undefined
  const answer = typeof value.answer === 'string' ? cleanText(value.answer, MAX_ANSWER) ?? '' : ''
  return { chinese, reference, answer }
}

async function readJson(request: Request): Promise<Record<string, unknown> | undefined> {
  try {
    const value: unknown = await request.json()
    return isRecord(value) ? value : undefined
  } catch {
    return undefined
  }
}

/** User input: must be present and within the limit. */
function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (text === '' || text.length > max) return undefined
  return text
}

/** Model output: keep it short, but don't fail the whole response for a long sentence. */
function clipText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text === '' ? undefined : text.slice(0, max)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRateLimited(request: Request): boolean {
  const key = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const now = Date.now()
  const recent = (recentRequests.get(key) ?? []).filter((time) => now - time < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) return true
  recent.push(now)
  recentRequests.set(key, recent)
  // Keep the map small in a long-lived isolate
  if (recentRequests.size > 1000) {
    for (const [ip, times] of recentRequests) {
      if (times.every((time) => now - time >= RATE_WINDOW_MS)) recentRequests.delete(ip)
    }
  }
  return false
}

/**
 * A model error. 5035 is Workers AI's "this model is not on the free plan";
 * the app uses the code to explain why AI is not available.
 */
function aiErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : String(error)
  const plan = message.includes('5035') || message.toLowerCase().includes('workers free plan')
  return json(
    {
      error: 'Workers AI is unavailable',
      ...(plan && { code: 'plan' }),
    },
    502,
  )
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
