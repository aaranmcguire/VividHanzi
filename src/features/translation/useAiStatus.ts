import { useEffect, useState } from 'react'
import { loadAiStatus, type AiStatus } from './ai.ts'

/**
 * The status is the same for the whole app: a session with several sentence
 * exercises asks once, not once per card. Tests pass their own fetch and are
 * never cached.
 */
let cachedStatus: Promise<AiStatus> | undefined

/**
 * Asks the Worker once whether Workers AI is configured. Any failure means
 * "not available": the Translate mode then uses self-grading only.
 */
export function useAiStatus(fetchFn?: typeof fetch): AiStatus {
  const [status, setStatus] = useState<AiStatus>({ available: false })

  useEffect(() => {
    let active = true
    const request = fetchFn ? loadAiStatus(fetchFn) : (cachedStatus ??= loadAiStatus())
    request.then(
      (next) => active && setStatus(next),
      () => {},
    )
    return () => {
      active = false
    }
  }, [fetchFn])

  return status
}
