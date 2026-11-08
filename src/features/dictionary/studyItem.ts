import { getCharacter, getCharactersOfWord, getWord, getWordsWithCharacter, type Dictionary } from './dictionary.ts'
import type { Character, Word } from './types.ts'

/**
 * Something that can be studied: a character or a word.
 *
 * It's a "discriminated union": the `kind` field says which of the two it is, and
 * TypeScript knows what type `entry` has after checking `kind`.
 * Exercises and progress will work with StudyItem so as not to duplicate
 * logic between characters and words.
 */
export type StudyItem = { kind: 'character'; entry: Character } | { kind: 'word'; entry: Word }

/**
 * Unique identifier of a study item, e.g. "char:好" or "word:好".
 *
 * The prefix is needed because 好 is both a character and a word in
 * HSK 1, and their progress is tracked separately. "sentence:" ids belong
 * to sentence learning (see features/sentences) and are never dictionary
 * entries; they share the type so progress helpers can store both.
 */
export type StudyItemId = `char:${string}` | `word:${string}` | `sentence:${string}`

export function getStudyItemId(item: StudyItem): StudyItemId {
  return item.kind === 'character' ? `char:${item.entry.id}` : `word:${item.entry.id}`
}

/** All characters and words in the dictionary as study items. */
export function listStudyItems(dictionary: Dictionary): StudyItem[] {
  return [
    ...[...dictionary.characters.values()].map((entry): StudyItem => ({ kind: 'character', entry })),
    ...[...dictionary.words.values()].map((entry): StudyItem => ({ kind: 'word', entry })),
  ]
}

/** Finds an item by its id ("char:好" or "word:你好"). Sentence ids have no dictionary entry. */
export function getStudyItem(dictionary: Dictionary, id: StudyItemId): StudyItem | undefined {
  if (id.startsWith('sentence:')) return undefined
  if (id.startsWith('char:')) {
    const entry = getCharacter(dictionary, id.slice('char:'.length))
    return entry && { kind: 'character', entry }
  }
  const entry = getWord(dictionary, id.slice('word:'.length))
  return entry && { kind: 'word', entry }
}

/**
 * Related items: a word's characters, or the words in which a character
 * appears (HSK 1-4 ones first). The word with the same hanzi as the
 * character (谁 character and 谁 word) isn't included: it adds
 * nothing.
 */
export function getRelatedItems(dictionary: Dictionary, item: StudyItem): StudyItem[] {
  if (item.kind === 'word') {
    return getCharactersOfWord(dictionary, item.entry).map((entry): StudyItem => ({ kind: 'character', entry }))
  }
  return getWordsWithCharacter(dictionary, item.entry.id)
    .filter((word) => word.hanzi !== item.entry.hanzi)
    .sort((a, b) => Number(a.hskLevel === undefined) - Number(b.hskLevel === undefined))
    .map((entry): StudyItem => ({ kind: 'word', entry }))
}

/**
 * Sorts by frequency, the most common first (see frequencyRank). Items
 * without a rank go last; among them the order is kept (sort is stable).
 */
export function compareByFrequency(a: StudyItem, b: StudyItem): number {
  return (a.entry.frequencyRank ?? Infinity) - (b.entry.frequencyRank ?? Infinity) || 0
}
