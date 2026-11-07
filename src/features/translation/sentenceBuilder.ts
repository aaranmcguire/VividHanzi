import { shuffle, type RandomFn } from '../../lib/random.ts'
import { hskDictionary } from '../dictionary/hskDictionary.ts'
import { getStudyItemId, type StudyItem, type StudyItemId } from '../dictionary/studyItem.ts'
import type { ProgressData } from '../progress/types.ts'
import { SENTENCE_LEXICON_BY_ID } from './sentenceLexicon.ts'
import { SENTENCE_PATTERNS, type SentencePattern } from './sentencePatterns.ts'
import type {
  BuiltSentence,
  SentenceBuildContext,
  SentencePart,
  SentencePickOptions,
  SentenceTag,
  SentenceWord,
} from './types.ts'

/** How many different sentences a pattern may contribute to one session. */
const ATTEMPTS_PER_PATTERN = 6

/** How many of the easiest words a slot chooses among. */
const SHORTLIST_SIZE = 6

export interface CreateSentenceSessionOptions {
  /** Number of sentences; fewer if the vocabulary can't build that many. */
  size?: number
  random?: RandomFn
  /** Highest difficulty to include: 1, 2 or 3. */
  level?: number
  /** Sentence ids used recently, to avoid repeating them. */
  recent?: readonly string[]
}

/**
 * The words the user has learned, with their grammar data. Words that aren't
 * in SENTENCE_LEXICON still appear (with no tags): they can be fixed words of
 * a pattern, but they are never picked for a slot.
 */
export function getLearnedSentenceWords(progress: ProgressData): SentenceWord[] {
  const learned: SentenceWord[] = []
  for (const [itemId, record] of Object.entries(progress.items)) {
    if (!record || !itemId.startsWith('word:')) continue
    const word = hskDictionary.words.get(itemId.slice('word:'.length))
    if (!word) continue
    const lexeme = SENTENCE_LEXICON_BY_ID.get(word.id) ?? { id: word.id, en: word.hanzi, tags: [] }
    learned.push({ id: itemId as StudyItemId, word, lexeme })
  }
  return learned
}

/** How complex sentences may get, from how many words the user knows. */
export function getVocabularyLevel(learnedWords: number): 1 | 2 | 3 {
  if (learnedWords < 12) return 1
  if (learnedWords < 30) return 2
  return 3
}

/**
 * Builds a session of sentences from the user's learned vocabulary, easiest
 * first. Only learned words appear: a pattern is used when its fixed words
 * are learned and each slot can be filled with a learned word. If the
 * requested level has no sentences yet, the easiest available level is used.
 */
export function createSentenceSession(
  progress: ProgressData,
  { size = 10, random = Math.random, level = 3, recent = [] }: CreateSentenceSessionOptions = {},
): BuiltSentence[] {
  if (size <= 0) return []
  const learned = getLearnedSentenceWords(progress)
  if (learned.length === 0) return []

  const candidates = buildCandidates(learned, random)
  if (candidates.length === 0) return []

  const allowed = candidates.filter((sentence) => sentence.difficulty <= level)
  let pool = allowed
  if (pool.length === 0) {
    const easiest = Math.min(...candidates.map((sentence) => sentence.difficulty))
    pool = candidates.filter((sentence) => sentence.difficulty === easiest)
  }

  const recentIds = new Set(recent)
  const fresh = pool.filter((sentence) => !recentIds.has(sentence.id))
  if (fresh.length >= size) pool = fresh

  return pickSession(pool, size, random)
}

/**
 * One sentence built around a specific learned item, for the sentence
 * exercise inside a Study session. The item is used in the first slot where
 * it fits (or is already one of the pattern's fixed words); if no pattern can
 * include it, there is no sentence and the session uses another exercise.
 */
export function createSentenceForItem(
  item: StudyItem,
  progress: ProgressData,
  random: RandomFn = Math.random,
): BuiltSentence | undefined {
  if (item.kind !== 'word') return undefined
  const learned = getLearnedSentenceWords(progress)
  const targetId = getStudyItemId(item)
  const target = learned.find((word) => word.id === targetId)
  if (!target) return undefined

  const candidates = buildCandidates(learned, random, target)
  const matching = candidates.filter((sentence) =>
    sentence.words.some((word) => word.id === targetId),
  )
  if (matching.length === 0) return undefined
  return matching[Math.floor(random() * matching.length)]
}

function buildCandidates(
  learned: readonly SentenceWord[],
  random: RandomFn,
  preferred?: SentenceWord,
): BuiltSentence[] {
  const byHanzi = learnedByHanzi(learned)
  const candidates: BuiltSentence[] = []
  const seenChinese = new Set<string>()

  for (const pattern of SENTENCE_PATTERNS) {
    if (!pattern.requires.every((hanzi) => byHanzi.has(hanzi))) continue
    const context = createContext(pattern, learned, byHanzi, random, preferred)
    for (let attempt = 0; attempt < ATTEMPTS_PER_PATTERN; attempt++) {
      let sentence: BuiltSentence | undefined
      try {
        sentence = pattern.build(context)
      } catch {
        // A pattern that can't find its fixed words or slots is simply skipped
        break
      }
      if (!sentence || seenChinese.has(sentence.chinese)) continue
      seenChinese.add(sentence.chinese)
      candidates.push(sentence)
    }
  }

  return candidates
}

/** The learned words by hanzi. If there are homographs, the one with grammar data wins. */
function learnedByHanzi(learned: readonly SentenceWord[]): ReadonlyMap<string, SentenceWord> {
  const byHanzi = new Map<string, SentenceWord>()
  for (const word of learned) {
    const existing = byHanzi.get(word.word.hanzi)
    if (!existing || (existing.lexeme.tags.length === 0 && word.lexeme.tags.length > 0)) {
      byHanzi.set(word.word.hanzi, word)
    }
  }
  return byHanzi
}

function createContext(
  pattern: SentencePattern,
  learned: readonly SentenceWord[],
  byHanzi: ReadonlyMap<string, SentenceWord>,
  random: RandomFn,
  preferred?: SentenceWord,
): SentenceBuildContext {
  return {
    has: (hanzi) => byHanzi.has(hanzi),
    fixed: (hanzi) => {
      const word = byHanzi.get(hanzi)
      if (!word) throw new Error(`Sentence pattern ${pattern.id} needs the learned word ${hanzi}`)
      return word
    },
    pick: (tag, options) => pickWord(learned, tag, { ...options, preferred }, random),
    make: (parts, english) => makeSentence(pattern, parts, english),
  }
}

/** Picks a learned word with a tag, leaning towards the easiest words. */
function pickWord(
  learned: readonly SentenceWord[],
  tag: SentenceTag,
  options: SentencePickOptions = {},
  random: RandomFn,
): SentenceWord | undefined {
  const { exclude = [], where, preferred } = options
  const excluded = new Set(exclude.map((word) => word.id))
  const candidates = learned.filter(
    (word) => word.lexeme.tags.includes(tag) && !excluded.has(word.id) && (!where || where(word)),
  )
  if (candidates.length === 0) return undefined

  // When a session builds a sentence around one of its items, that item is
  // used in the first slot where it fits.
  if (preferred && candidates.some((word) => word.id === preferred.id)) return preferred

  // Shuffle first, then sort by difficulty: words of the same level come out
  // in random order, so sentences vary while staying easy.
  const sorted = shuffle(candidates, random).sort(compareDifficulty)
  const shortlist = sorted.slice(0, Math.min(SHORTLIST_SIZE, sorted.length))
  return shortlist[Math.floor(random() * shortlist.length)]
}

function compareDifficulty(a: SentenceWord, b: SentenceWord): number {
  const levelA = a.word.hskLevel ?? 9
  const levelB = b.word.hskLevel ?? 9
  if (levelA !== levelB) return levelA - levelB
  return (a.word.frequencyRank ?? Infinity) - (b.word.frequencyRank ?? Infinity)
}

/** Joins words and literal text, merging adjacent text that isn't a word. */
function makeSentence(
  pattern: SentencePattern,
  parts: readonly (string | SentenceWord)[],
  english: string,
): BuiltSentence {
  const normalized: SentencePart[] = []
  for (const part of parts) {
    if (typeof part === 'string') {
      const last = normalized.at(-1)
      if (last && last.word === undefined) last.text += part
      else normalized.push({ text: part })
    } else {
      normalized.push({ text: part.word.hanzi, word: part })
    }
  }
  const chinese = normalized.map((part) => part.text).join('')
  return {
    id: `${pattern.id}:${chinese}`,
    patternId: pattern.id,
    difficulty: pattern.difficulty,
    parts: normalized,
    chinese,
    english,
    words: normalized.flatMap((part) => (part.word ? [part.word] : [])),
  }
}

/** Picks the session, easiest difficulty first, with a mix of levels. */
function pickSession(candidates: readonly BuiltSentence[], size: number, random: RandomFn): BuiltSentence[] {
  const groups = new Map<number, BuiltSentence[]>()
  for (const sentence of candidates) {
    const group = groups.get(sentence.difficulty) ?? []
    group.push(sentence)
    groups.set(sentence.difficulty, group)
  }
  const levels = [...groups.keys()].sort((a, b) => a - b)
  const counts = allocate(size, levels)

  const selected: BuiltSentence[] = []
  for (const level of levels) {
    const group = groups.get(level)
    if (!group) continue
    selected.push(...pickVaried(group, counts.get(level) ?? 0, random))
  }

  if (selected.length < size) {
    const selectedIds = new Set(selected.map((sentence) => sentence.id))
    const remaining = candidates.filter((sentence) => !selectedIds.has(sentence.id))
    selected.push(...pickVaried(remaining, size - selected.length, random))
  }

  return selected
    .sort((a, b) => a.difficulty - b.difficulty || a.words.length - b.words.length)
    .slice(0, size)
}

/** How many sentences to take from each difficulty. */
function allocate(size: number, levels: readonly number[]): ReadonlyMap<number, number> {
  const counts = new Map<number, number>()
  const [first, second, third] = levels
  if (first === undefined) return counts
  if (second === undefined) {
    counts.set(first, size)
    return counts
  }
  if (third === undefined) {
    const firstCount = Math.ceil(size * 0.6)
    counts.set(first, firstCount)
    counts.set(second, size - firstCount)
    return counts
  }
  const firstCount = Math.ceil(size * 0.4)
  const secondCount = Math.ceil((size - firstCount) * 0.6)
  counts.set(first, firstCount)
  counts.set(second, secondCount)
  counts.set(third, size - firstCount - secondCount)
  return counts
}

/**
 * Picks up to `count` sentences, shortest first and with at most two from
 * the same pattern when there are enough alternatives.
 */
function pickVaried(group: readonly BuiltSentence[], count: number, random: RandomFn): BuiltSentence[] {
  if (count <= 0) return []
  const sorted = shuffle(group, random).sort((a, b) => a.words.length - b.words.length)
  const selected: BuiltSentence[] = []
  const perPattern = new Map<string, number>()

  for (const sentence of sorted) {
    if (selected.length >= count) break
    const used = perPattern.get(sentence.patternId) ?? 0
    if (used >= 2 && sorted.length > count) continue
    selected.push(sentence)
    perPattern.set(sentence.patternId, used + 1)
  }

  if (selected.length < count) {
    const ids = new Set(selected.map((sentence) => sentence.id))
    for (const sentence of sorted) {
      if (selected.length >= count) break
      if (!ids.has(sentence.id)) {
        selected.push(sentence)
        ids.add(sentence.id)
      }
    }
  }

  return selected
}

/** Exposed for tests: the id of a word item, as stored in progress. */
export function sentenceWordId(word: SentenceWord): StudyItemId {
  return getStudyItemId({ kind: 'word', entry: word.word })
}
