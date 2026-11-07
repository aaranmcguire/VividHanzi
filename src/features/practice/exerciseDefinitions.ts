import { audioSources } from '../audio/audio.ts'
import type { StudyItem } from '../dictionary/studyItem.ts'
import type { RandomFn } from '../../lib/random.ts'
import {
  hanziChoiceDefinition,
  listeningChoiceDefinition,
  meaningChoiceDefinition,
  pinyinChoiceDefinition,
} from './choiceExercises.ts'
import { matchMeaningDefinition, matchPinyinDefinition } from './matchExercises.ts'
import { toneChoiceDefinition } from './toneExercises.ts'
import type { Exercise, ExerciseType, FlashcardExercise, ListeningTranslateExercise } from './types.ts'

/**
 * How an exercise type is built. Each type knows whether it can be created
 * for an item (e.g. a choice exercise needs enough items to make up wrong
 * answers) and how to create it.
 *
 * `pool` is all the available items and `random` is injected so that the
 * tests are deterministic.
 */
export interface ExerciseDefinition<E extends Exercise = Exercise> {
  type: E['type']
  canBuild(item: StudyItem, pool: readonly StudyItem[]): boolean
  build(item: StudyItem, pool: readonly StudyItem[], random: RandomFn): E
}

export const flashcardDefinition: ExerciseDefinition<FlashcardExercise> = {
  type: 'flashcard',
  canBuild: () => true,
  build: (item) => ({ type: 'flashcard', item }),
}

/** Listen to a word or character and type its meaning; only for items with audio. */
export const listeningTranslateDefinition: ExerciseDefinition<ListeningTranslateExercise> = {
  type: 'listening-translate',
  canBuild: (item) => audioSources(item).length > 0,
  build: (item) => ({ type: 'listening-translate', item }),
}

/**
 * Every exercise type, in the order Settings and Home list them. Writing and
 * sentence translation have no definition: writing is added when an item's
 * writing is due, and sentences are built from learned words in session.ts.
 */
export const EXERCISE_TYPES: readonly ExerciseType[] = [
  'flashcard',
  'meaning-choice',
  'listening-choice',
  'listening-translate',
  'hanzi-choice',
  'pinyin-choice',
  'tone-choice',
  'match-pinyin',
  'match-meaning',
  'sentence',
  'writing',
]

/** Available exercise types. Adding a new one = adding its definition here. */
export const EXERCISE_DEFINITIONS: readonly ExerciseDefinition[] = [
  flashcardDefinition,
  meaningChoiceDefinition,
  listeningChoiceDefinition,
  listeningTranslateDefinition,
  pinyinChoiceDefinition,
  hanziChoiceDefinition,
  toneChoiceDefinition,
  matchPinyinDefinition,
  matchMeaningDefinition,
]

/** The definitions of the given types (writing has none, see EXERCISE_TYPES). */
export function getDefinitions(types: readonly ExerciseType[]): ExerciseDefinition[] {
  return EXERCISE_DEFINITIONS.filter((definition) => types.includes(definition.type))
}
