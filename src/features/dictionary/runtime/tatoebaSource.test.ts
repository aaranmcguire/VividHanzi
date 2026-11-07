import { describe, expect, it } from 'vitest'
import { createFakeFetch, jsonResponse } from '../../../test/fakeFetch.ts'
import { ningResponse, tatoebaSentence, tatoebaTranslation } from '../../../test/tatoebaResponses.ts'
import {
  fetchTatoebaExamples,
  parseSentencesResponse,
  tatoebaSearchUrl,
  TATOEBA_SOURCE,
  toExampleSentences,
} from './tatoebaSource.ts'

const lemon = tatoebaTranslation(1, 'Lemon.', 'CK')

describe('parseSentencesResponse', () => {
  it('rejects a response without data', () => {
    for (const malformed of [null, [], {}, { data: 'x' }]) {
      expect(() => parseSentencesResponse(malformed)).toThrow(expect.objectContaining({ kind: 'invalid' }))
    }
  })

  it('drops malformed sentences and translations or those in another language', () => {
    const parsed = parseSentencesResponse({
      data: [
        { id: 'x', text: '柠檬。', lang: 'cmn' },
        { ...tatoebaSentence(2, '柠檬。', 'a', []), lang: 'jpn' },
        tatoebaSentence(3, '柠檬。', 'a', [lemon, { ...lemon, lang: 'fra' }, { id: 5 }]),
      ],
    })
    expect(parsed).toHaveLength(1)
    expect(parsed[0]!.translations.map((translation) => translation.id)).toEqual([1])
  })
})

describe('toExampleSentences', () => {
  const convert = (data: unknown[]) => toExampleSentences('柠', parseSentencesResponse({ data }))

  it('normalizes to the app model, with the direct translation with the lowest id', () => {
    expect(convert(ningResponse.data)[0]).toEqual({
      tatoebaId: 8934441,
      zh: '柠檬很酸。',
      author: 'iiujik',
      en: 'Lemon is sour.',
      translationTatoebaId: 29487,
      translationAuthor: 'al_ex_an_der',
      words: ['柠'],
    })
  })

  it('keeps only attributable, approved, short sentences with a direct translation', () => {
    const unapproved = { ...tatoebaSentence(4, '柠檬。', 'a', [lemon]), is_unapproved: true }
    const otherLicense = { ...tatoebaSentence(5, '柠檬。', 'a', [lemon]), license: 'CC0 1.0' }
    const result = convert([
      tatoebaSentence(1, '柠檬。', null, [lemon]),
      tatoebaSentence(2, '柠檬。', 'a', []),
      tatoebaSentence(3, '我在ABC买了柠檬。', 'a', [lemon]),
      unapproved,
      otherLicense,
      tatoebaSentence(6, '这个柠檬比我昨天在商店里买的那个柠檬酸多了，所以我没有买。', 'a', [lemon]),
      tatoebaSentence(7, '檸檬。', 'a', [lemon]),
      tatoebaSentence(8, '柠檬。', 'a', [tatoebaTranslation(9, 'Lemon.', null)]),
      tatoebaSentence(10, '柠檬。', 'a', [tatoebaTranslation(11, 'See you again.', 'b', false)]),
    ])
    expect(result).toEqual([expect.objectContaining({ tatoebaId: 8, translationTatoebaId: 9 })])
    expect(result[0]).not.toHaveProperty('translationAuthor')
  })
})

describe('fetchTatoebaExamples', () => {
  it('searches the exact term, in Chinese, with English translation and shortest sentences first', async () => {
    const fake = createFakeFetch([['https://api.tatoeba.org/', jsonResponse(ningResponse)]])
    const result = await fetchTatoebaExamples('柠', { fetchFn: fake.fetch })
    expect(result.source).toBe(TATOEBA_SOURCE)
    expect(result.data.map((sentence) => sentence.tatoebaId)).toEqual([8934441, 8934444, 13754993, 12169719])
    const url = new URL(fake.requested[0]!)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lang: 'cmn',
      q: '"柠"',
      sort: 'words',
      'showtrans:lang': 'eng',
      'trans:lang': 'eng',
      limit: '50',
    })
  })

  it('does not send Tatoeba text that is not a short Chinese term', async () => {
    const fake = createFakeFetch([['https://api.tatoeba.org/', jsonResponse(ningResponse)]])
    for (const term of ['hello', '柠'.repeat(13)]) {
      await expect(fetchTatoebaExamples(term, { fetchFn: fake.fetch })).rejects.toMatchObject({ kind: 'invalid' })
    }
    expect(fake.requested).toEqual([])
    expect(new URL(tatoebaSearchUrl('a"b\\c')).searchParams.get('q')).toBe('"abc"')
  })

  it('passes 429s and network errors through as classified errors', async () => {
    const limited = createFakeFetch([[/./, new Response('', { status: 429, headers: { 'Retry-After': '5' } })]])
    await expect(fetchTatoebaExamples('柚', { fetchFn: limited.fetch })).rejects.toMatchObject({ kind: 'rate-limit' })
    // After the 429 no further calls until the requested time has passed
    await expect(fetchTatoebaExamples('柚', { fetchFn: limited.fetch })).rejects.toMatchObject({ kind: 'rate-limit' })
    expect(limited.requested).toHaveLength(1)
  })
})
