import type { ExampleSentence } from '../types.ts'
import { createRateLimiter, fetchJson, SourceError, type FetchOptions } from './http.ts'

/*
 * Sentence adapter: Tatoeba API v1 (https://api.tatoeba.org), public and
 * keyless. Returns CORS `*` and supports `sort=words` (shortest sentences
 * first) with at most 50 results per page (verified in GitHub
 * Actions). It doesn't publish usage limits; its terms forbid overloading it,
 * so each browser makes at most 20 requests per minute and everything is
 * cached.
 */

export const TATOEBA_SOURCE = 'Tatoeba API v1'
export const TATOEBA_LICENSE = 'CC BY 2.0 FR'
const ENDPOINT = 'https://api.tatoeba.org/v1/sentences'
/** Maximum the API returns per page. */
const PAGE_SIZE = 50

/** The same rules as the HSK sentences (scripts/dataset/sources/tatoeba.ts). */
export const MAX_SENTENCE_LENGTH = 24
const HAN = /\p{Script=Han}/u
const LATIN_OR_DIGIT = /[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]/

const limiter = createRateLimiter(20)

interface ApiTranslation {
  id: number
  text: string
  owner: string | null
  license: string
  isDirect: boolean
  isUnapproved: boolean
}

interface ApiSentence extends Omit<ApiTranslation, 'isDirect'> {
  translations: ApiTranslation[]
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

function parseTranslation(value: unknown): ApiTranslation | undefined {
  if (!isObject(value)) return undefined
  const { id, text, owner, license, is_direct, is_unapproved, lang } = value
  if (lang !== undefined && lang !== 'eng') return undefined
  if (!Number.isInteger(id) || typeof text !== 'string' || typeof license !== 'string') return undefined
  return {
    id: id as number,
    text,
    owner: typeof owner === 'string' && owner !== '' ? owner : null,
    license,
    isDirect: is_direct === true,
    isUnapproved: is_unapproved !== false,
  }
}

/**
 * Checks the /v1/sentences format. A response without `data` is an
 * error; a single malformed sentence is just dropped.
 */
export function parseSentencesResponse(json: unknown): ApiSentence[] {
  if (!isObject(json) || !Array.isArray(json.data)) throw new SourceError('invalid', 'Tatoeba response without data')
  return json.data.flatMap((value): ApiSentence[] => {
    if (!isObject(value) || value.lang !== 'cmn') return []
    const sentence = parseTranslation({ ...value, lang: undefined })
    if (!sentence) return []
    // showtrans returns a flat list of translations
    const translations = (Array.isArray(value.translations) ? value.translations.flat() : [])
      .map(parseTranslation)
      .filter((translation) => translation !== undefined)
    return [{ ...sentence, translations }]
  })
}

/**
 * Converts the API sentences to the app model. Only those that can be
 * attributed and displayed properly remain: with an author, approved, licensed CC BY 2.0 FR,
 * short, without Latin letters or digits, containing the term as is
 * (Tatoeba also returns sentences in traditional) and with a direct English
 * translation: indirect ones (a translation of a translation) may not
 * match the Chinese sentence. As the translation, the one with the lowest id (the same
 * rule as in HSK, which only uses direct links).
 */
export function toExampleSentences(term: string, sentences: readonly ApiSentence[]): ExampleSentence[] {
  const usable = (sentence: Omit<ApiTranslation, 'isDirect'>) =>
    !sentence.isUnapproved && sentence.license === TATOEBA_LICENSE
  return sentences.flatMap((sentence): ExampleSentence[] => {
    const { text } = sentence
    if (!usable(sentence) || sentence.owner === null || !text.includes(term)) return []
    if (Array.from(text).length > MAX_SENTENCE_LENGTH || LATIN_OR_DIGIT.test(text)) return []
    const [translation] = sentence.translations
      .filter((candidate) => candidate.isDirect && usable(candidate))
      .sort((a, b) => a.id - b.id)
    if (!translation) return []
    return [
      {
        tatoebaId: sentence.id,
        zh: text,
        author: sentence.owner,
        en: translation.text,
        translationTatoebaId: translation.id,
        ...(translation.owner !== null && {
          translationAuthor: translation.owner,
        }),
        words: [term],
      },
    ]
  })
}

/** Search URL: the term goes in quotes to search for it as an exact phrase. */
export function tatoebaSearchUrl(term: string): string {
  const params = new URLSearchParams({
    lang: 'cmn',
    q: `"${term.replace(/["\\]/g, '')}"`,
    sort: 'words',
    'showtrans:lang': 'eng',
    'trans:lang': 'eng',
    limit: String(PAGE_SIZE),
  })
  return `${ENDPOINT}?${params}`
}

/** Candidate sentences for a hanzi or word, from shortest to longest. */
export async function fetchTatoebaExamples(term: string, options: FetchOptions = {}) {
  // Only short Chinese terms: never unbounded free text from the user
  if (!HAN.test(term) || Array.from(term).length > 12) throw new SourceError('invalid', 'Not a Chinese term')
  const json = await limiter.schedule(() => fetchJson(tatoebaSearchUrl(term), options))
  return {
    data: toExampleSentences(term, parseSentencesResponse(json)),
    source: TATOEBA_SOURCE,
  }
}
