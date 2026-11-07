/**
 * Client for the optional Workers AI endpoints (see worker/index.ts). The app
 * works without them: loadAiStatus fails or says unavailable, and Translate
 * keeps its normal self-grading.
 */

export type AiVerdict = 'correct' | 'partial' | 'incorrect'

/** An AI request that failed; `code` says why when the Worker knows (e.g. "plan"). */
export class AiRequestError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'AiRequestError'
    this.code = code
  }
}

export interface AiStatus {
  available: boolean
  /** Workers AI model id, when available. */
  model?: string
}

export interface AiGrade {
  verdict: AiVerdict
  feedback: string
  memoryTip: string
}

export interface AiHint {
  hint: string
  memoryTip: string
}

export interface GradeInput {
  chinese: string
  reference: string
  answer: string
}

export interface HintInput {
  chinese: string
  reference: string
  answer?: string
}

export async function loadAiStatus(fetchFn?: typeof fetch): Promise<AiStatus> {
  const response = await getFetch(fetchFn)('/api/ai', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`AI status request failed (${response.status})`)
  const data: unknown = await response.json()
  if (!isRecord(data) || typeof data.available !== 'boolean') {
    throw new Error('The AI status response is invalid')
  }
  return {
    available: data.available,
    ...(typeof data.model === 'string' && { model: data.model }),
  }
}

export async function gradeTranslation(input: GradeInput, fetchFn?: typeof fetch): Promise<AiGrade> {
  const data = await post('/api/ai/grade', input, fetchFn)
  if (
    !isRecord(data) ||
    !isVerdict(data.verdict) ||
    typeof data.feedback !== 'string' ||
    (data.memoryTip !== undefined && typeof data.memoryTip !== 'string')
  ) {
    throw new Error('The AI grade response is invalid')
  }
  return {
    verdict: data.verdict,
    feedback: data.feedback,
    memoryTip: typeof data.memoryTip === 'string' ? data.memoryTip : '',
  }
}

export async function getTranslationHint(input: HintInput, fetchFn?: typeof fetch): Promise<AiHint> {
  const data = await post('/api/ai/hint', input, fetchFn)
  if (
    !isRecord(data) ||
    typeof data.hint !== 'string' ||
    (data.memoryTip !== undefined && typeof data.memoryTip !== 'string')
  ) {
    throw new Error('The AI hint response is invalid')
  }
  return {
    hint: data.hint,
    memoryTip: typeof data.memoryTip === 'string' ? data.memoryTip : '',
  }
}

async function post(path: string, body: unknown, fetchFn?: typeof fetch): Promise<unknown> {
  const response = await getFetch(fetchFn)(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    let code: string | undefined
    try {
      const data: unknown = await response.json()
      if (isRecord(data) && typeof data.code === 'string') code = data.code
    } catch {
      // Not a JSON error body: the generic message is enough
    }
    throw new AiRequestError(`AI request failed (${response.status})`, code)
  }
  return response.json()
}

/** Without a binding, calling `fetch` directly can throw "Illegal invocation" in some browsers. */
function getFetch(fetchFn?: typeof fetch): typeof fetch {
  return fetchFn ?? ((input, init) => fetch(input, init))
}

function isVerdict(value: unknown): value is AiVerdict {
  return value === 'correct' || value === 'partial' || value === 'incorrect'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
