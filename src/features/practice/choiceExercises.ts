import { audioSources } from '../audio/audio.ts'
import { getMeanings } from '../dictionary/dictionary.ts'
import { getStudyItemId, type StudyItem } from '../dictionary/studyItem.ts'
import { shuffle } from '../../lib/random.ts'
import type { ExerciseDefinition } from './exerciseDefinitions.ts'
import type { ChoiceExercise, ChoiceExerciseType } from './types.ts'

/** Options per question: the correct one and three distractors. */
export const CHOICE_OPTION_COUNT = 4

/** Approximate length of an option's meaning text. */
const MAX_MEANING_LABEL_LENGTH = 40

// --- Displayed texts ---------------------------------------------------------

/**
 * Caches the result of `compute` for each dictionary entry. Picking
 * distractors compares an item against the whole dataset (more than 2000
 * entries), so the derived texts are computed only once.
 * WeakMap: if an entry stops existing, its value is released.
 */
function memoizeByEntry<T>(compute: (item: StudyItem) => T): (item: StudyItem) => T {
  const cache = new WeakMap<object, T>()
  return (item) => {
    if (!cache.has(item.entry)) cache.set(item.entry, compute(item))
    return cache.get(item.entry)!
  }
}

/**
 * Meanings that can be shown without revealing the answer. Some CC-CEDICT
 * entries quote the hanzi itself ("eldest (as in 大姐)"): the parenthesis
 * quoting it is removed and, if it still quotes it ("used in 漂亮"), that
 * meaning is discarded.
 */
export function getMeaningClues(item: StudyItem): string[] {
  const characters = Array.from(item.entry.hanzi)
  const mentionsHanzi = (text: string) => characters.some((character) => text.includes(character))

  return getMeanings(item.entry.meanings).flatMap((meaning) => {
    const cleaned = meaning.replace(/\s*\([^()]*\)/g, (group) => (mentionsHanzi(group) ? '' : group)).trim()
    return cleaned === '' || mentionsHanzi(cleaned) ? [] : [cleaned]
  })
}

/** Short text with the first meanings: always the first one and, if they fit, more. */
export const getMeaningLabel = memoizeByEntry((item: StudyItem): string => {
  const label: string[] = []
  for (const meaning of getMeaningClues(item)) {
    if (label.length > 0 && [...label, meaning].join('; ').length > MAX_MEANING_LABEL_LENGTH) break
    label.push(meaning)
  }
  return label.join('; ')
})

/** Pinyin readings: one for words; one or more for characters. */
export function getReadings(item: StudyItem): readonly string[] {
  return item.kind === 'word' ? [item.entry.pinyin] : item.entry.pinyin
}

/**
 * Pinyin of an option. For characters with several readings (了: le, liǎo)
 * only the first one is shown: if the correct option were the only one with
 * a list, it could be guessed from the format.
 */
export function getPinyinLabel(item: StudyItem): string {
  return getReadings(item)[0] ?? ''
}

// --- When two items get confused ---------------------------------------------

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Individual meanings: "to love; to like (sth)" → "to love", "to like". */
const getGlosses = memoizeByEntry((item: StudyItem): ReadonlySet<string> => {
  const glosses = getMeanings(item.entry.meanings)
    .flatMap((meaning) => meaning.split(';'))
    .map((gloss) => normalize(gloss.replace(/\([^()]*\)/g, '')))
  return new Set(glosses.filter((gloss) => gloss !== ''))
})

function sharesMeaning(a: StudyItem, b: StudyItem): boolean {
  const glossesOfA = getGlosses(a)
  return [...getGlosses(b)].some((gloss) => glossesOfA.has(gloss))
}

function sharesReading(a: StudyItem, b: StudyItem): boolean {
  const key = (pinyin: string) => pinyin.toLowerCase().replace(/\s+/g, '')
  const readingsOfA = new Set(getReadings(a).map(key))
  return getReadings(b).some((reading) => readingsOfA.has(key(reading)))
}

interface ChoiceRules {
  /** Can this item be asked about or used as an option? */
  isUsable(item: StudyItem): boolean
  /**
   * Would they be ambiguous together in the same question? If a distractor
   * were also a valid answer (a synonym, a shared reading), the question
   * would have two correct answers.
   */
  conflict(a: StudyItem, b: StudyItem): boolean
}

const hasMeaningLabel = (item: StudyItem) => getMeaningLabel(item) !== ''

const MEANING_RULES: ChoiceRules = { isUsable: hasMeaningLabel, conflict: sharesMeaning }

const CHOICE_RULES: Record<ChoiceExerciseType, ChoiceRules> = {
  'meaning-choice': MEANING_RULES,
  'listening-choice': MEANING_RULES,
  'pinyin-choice': { isUsable: () => true, conflict: sharesReading },
  'hanzi-choice': {
    isUsable: hasMeaningLabel,
    conflict: (a, b) => a.entry.hanzi === b.entry.hanzi || sharesMeaning(a, b),
  },
}

// --- Distractors and definitions ---------------------------------------------

function hanziLength(item: StudyItem): number {
  return Array.from(item.entry.hanzi).length
}

/**
 * Picks the distractors (wrong answers) walking `pool` in order. It only uses
 * items of the same kind (character or word) that cannot be confused with the
 * answer or with each other. It prefers ones of the same length: a
 * two-character word among one-character options could be guessed without knowing it.
 */
export function pickDistractors(
  type: ChoiceExerciseType,
  item: StudyItem,
  pool: readonly StudyItem[],
): StudyItem[] {
  const { isUsable, conflict } = CHOICE_RULES[type]
  const itemId = getStudyItemId(item)
  const length = hanziLength(item)

  const candidates = pool
    .filter((candidate) => candidate.kind === item.kind && getStudyItemId(candidate) !== itemId)
    .filter((candidate) => isUsable(candidate) && !conflict(item, candidate))
    // sort is stable: among equal lengths the `pool` order is kept
    .sort((a, b) => Math.abs(hanziLength(a) - length) - Math.abs(hanziLength(b) - length))

  const distractors: StudyItem[] = []
  for (const candidate of candidates) {
    if (distractors.length === CHOICE_OPTION_COUNT - 1) break
    if (!distractors.some((distractor) => conflict(distractor, candidate))) distractors.push(candidate)
  }
  return distractors
}

function createChoiceDefinition(type: ChoiceExerciseType): ExerciseDefinition<ChoiceExercise> {
  return {
    type,
    canBuild: (item, pool) =>
      CHOICE_RULES[type].isUsable(item) && pickDistractors(type, item, pool).length === CHOICE_OPTION_COUNT - 1,
    build: (item, pool, random) => {
      // The pool is shuffled so the distractors change from one session to another
      const distractors = pickDistractors(type, item, shuffle(pool, random))
      return { type, item, options: shuffle([item, ...distractors], random) }
    },
  }
}

const meaningChoice = createChoiceDefinition('meaning-choice')

export const meaningChoiceDefinition = meaningChoice
export const pinyinChoiceDefinition = createChoiceDefinition('pinyin-choice')
export const hanziChoiceDefinition = createChoiceDefinition('hanzi-choice')

/** Like meaning-choice, but only for items with audio, and the hanzi stays hidden. */
export const listeningChoiceDefinition: ExerciseDefinition<ChoiceExercise> = {
  ...createChoiceDefinition('listening-choice'),
  canBuild: (item, pool) => audioSources(item).length > 0 && meaningChoice.canBuild(item, pool),
}

/** Is this option the correct answer? */
export function isCorrectOption(exercise: ChoiceExercise, option: StudyItem): boolean {
  return getStudyItemId(option) === getStudyItemId(exercise.item)
}
