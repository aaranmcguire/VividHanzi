import type { ExampleSentence, HskLevel } from '../dictionary/types.ts'

/** A sentence's progress id. It is not a dictionary entry. */
export type SentenceId = `sentence:${number}`

export function getSentenceId(tatoebaId: number): SentenceId {
  return `sentence:${tatoebaId}`
}

/** A Tatoeba sentence ready to be studied, with its level and progress id. */
export interface SentenceItem extends ExampleSentence {
  id: SentenceId
  hskLevel: HskLevel
}

/** One HSK sentence set: the sentences of a level, plus the counts for its card. */
export interface SentenceSetInfo {
  id: string
  level: HskLevel
  name: string
  description: string
  icon: string
  ids: readonly SentenceId[]
  count: number
  audioCount: number
}

/** The generated public/sentences/manifest.json. */
export interface SentenceManifest {
  source: 'Tatoeba'
  license: 'CC BY 2.0 FR'
  exportDate: string
  levels: readonly {
    level: HskLevel
    count: number
    audio: number
    /** Tatoeba sentence ids. */
    ids: readonly number[]
  }[]
}
