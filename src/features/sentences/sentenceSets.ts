import { t } from '../../i18n/index.ts'
import { loadExampleSet } from '../dictionary/examples.ts'
import type { HskLevel } from '../dictionary/types.ts'
import { getSentenceId, type SentenceItem, type SentenceManifest, type SentenceSetInfo } from './types.ts'

export const SENTENCE_LEVELS: readonly HskLevel[] = [1, 2, 3, 4]

/** The small generated index: counts and sentence ids per level. */
export async function loadSentenceManifest(fetchFn: typeof fetch = fetch): Promise<SentenceManifest> {
  const response = await fetchFn(`${import.meta.env.BASE_URL}sentences/manifest.json`)
  if (!response.ok) throw new Error(`No sentence manifest (HTTP ${response.status})`)
  return (await response.json()) as SentenceManifest
}

/** The four HSK sentence sets, with the counts from the manifest. */
export function createSentenceSets(manifest: SentenceManifest): SentenceSetInfo[] {
  return SENTENCE_LEVELS.flatMap((level) => {
    const entry = manifest.levels.find((candidate) => candidate.level === level)
    return entry === undefined ? [] : [createSentenceSet(level, entry)]
  })
}

function createSentenceSet(
  level: HskLevel,
  entry: SentenceManifest['levels'][number],
): SentenceSetInfo {
  return {
    id: `sentences-hsk-${level}`,
    level,
    name: t('sets.sentences.name', { level }),
    description: t('sets.sentences.description'),
    icon: '句',
    ids: entry.ids.map(getSentenceId),
    count: entry.count,
    audioCount: entry.audio,
  }
}

/** A level's sentences, shortest first, ready for Learn and Study. */
export async function loadSentenceItems(level: HskLevel, fetchFn: typeof fetch = fetch): Promise<SentenceItem[]> {
  const set = await loadExampleSet(level, fetchFn)
  return set.sentences
    .map((sentence): SentenceItem => ({ ...sentence, id: getSentenceId(sentence.tatoebaId), hskLevel: level }))
    .sort(
      (a, b) =>
        Array.from(a.zh).length - Array.from(b.zh).length || a.tatoebaId - b.tatoebaId,
    )
}

export function isHskLevel(value: string): value is `${HskLevel}` {
  return SENTENCE_LEVELS.some((level) => String(level) === value)
}

export function getSentenceSetPath(level: HskLevel): string {
  return `/study/sentences/${level}`
}

export function getSentenceSessionPath(
  level: HskLevel,
  mode: 'learn' | 'study',
  reviewAll = false,
): string {
  const query = reviewAll ? '?scope=all' : ''
  return `/study/sentences/${level}/${mode}${query}`
}
