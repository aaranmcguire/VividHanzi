import type { StudyItemId } from '../dictionary/studyItem.ts'
import type { Word } from '../dictionary/types.ts'

/**
 * What a word can do in a generated sentence. A word can have several tags:
 * 老师 is a person and a role; 苹果 is food and something you can buy.
 */
export type SentenceTag =
  | 'person'
  | 'pronoun'
  | 'family'
  | 'role'
  | 'place'
  | 'origin'
  | 'residence'
  | 'thing'
  | 'buyable'
  | 'writeable'
  | 'food'
  | 'drink'
  | 'media'
  | 'reading'
  | 'verb'
  | 'actionVerb'
  | 'intransitive'
  | 'atPlace'
  | 'progressive'
  | 'adjective'
  | 'personAdjective'
  | 'thingAdjective'
  | 'weatherAdjective'
  | 'time'
  | 'transport'
  | 'number'

/**
 * A word the sentence builder may put in a sentence, with the English forms
 * its translation needs. The hanzi, pinyin and meanings still come from the
 * dictionary: this only adds what a grammar pattern needs to know.
 */
export interface SentenceLexeme {
  /** Word id in the dictionary (usually the hanzi; homographs include the pinyin). */
  id: string
  /** Base English form: "book", "eat", "busy", "home", "today", "three". */
  en: string
  tags: readonly SentenceTag[]
  /** Nouns: irregular plural. */
  plural?: string
  /** Nouns: not countable, so no "a" and no plural (tea, rice, money). */
  uncountable?: boolean
  /** Nouns: only used in the plural in English (clothes, dumplings). */
  pluralOnly?: boolean
  /** Nouns: measure word used after a number (本, 个, 只...). */
  measure?: string
  /** Places: full phrase with "at"/"in": "at home", "in Beijing". */
  at?: string
  /** Places: full phrase with "to": "home", "to the restaurant". */
  to?: string
  /** Places that are names: no "the" (Beijing, China). */
  proper?: boolean
  /** People: grammatical person (1, 2 or 3). */
  person?: 1 | 2 | 3
  /** People: gender, when it should agree with a family word (他 + 爸爸). */
  gender?: 'm' | 'f'
  /** People: plural subject (we, they). */
  pluralSubject?: boolean
  /** People: object form ("me", "him", "the teacher"). Defaults to `en`. */
  object?: string
  /** People: possessive form ("my", "his", "the teacher's"). */
  possessive?: string
  /** Verbs: irregular third-person singular ("goes", "watches"). */
  third?: string
  /** Verbs: irregular gerund ("running", "getting up"). */
  gerund?: string
  /** Transports: "by taxi". */
  by?: string
}

/** A learned word ready to go into a sentence. */
export interface SentenceWord {
  id: StudyItemId
  word: Word
  lexeme: SentenceLexeme
}

/**
 * A piece of a sentence: a dictionary word, or punctuation/other text that
 * isn't one. Joining the texts always gives the whole Chinese sentence.
 */
export interface SentencePart {
  text: string
  word?: SentenceWord
}

/** A sentence built from the user's vocabulary, with its reference translation. */
export interface BuiltSentence {
  /** Stable id: the pattern plus the Chinese text. */
  id: string
  patternId: string
  /** 1 (short and simple) to 3 (longer, with more grammar). */
  difficulty: number
  parts: readonly SentencePart[]
  chinese: string
  english: string
  /** The words in order, for the pinyin and the word list after checking. */
  words: readonly SentenceWord[]
}

/** Options for picking a word for a slot. */
export interface SentencePickOptions {
  /** Words already used in this sentence. */
  exclude?: readonly SentenceWord[]
  /** Extra filter, e.g. "only nouns with a learned measure word". */
  where?: (word: SentenceWord) => boolean
  /**
   * Use this word if it fits the slot. Used when a session builds a sentence
   * around one of its items, so that item is really in the sentence.
   */
  preferred?: SentenceWord
}

/**
 * What a sentence pattern uses to build one sentence. The builder creates it
 * with the user's learned words and a random source.
 */
export interface SentenceBuildContext {
  /** Is this fixed word learned? */
  has: (hanzi: string) => boolean
  /** A fixed word of the pattern. Throws if it isn't learned. */
  fixed: (hanzi: string) => SentenceWord
  /** Picks a learned word with a tag, or undefined if there is none. */
  pick: (tag: SentenceTag, options?: SentencePickOptions) => SentenceWord | undefined
  /** Joins words and literal text into a sentence. */
  make: (parts: readonly (string | SentenceWord)[], english: string) => BuiltSentence
}
