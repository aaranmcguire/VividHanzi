import { describe, expect, it } from 'vitest'
import { hskCharacterItems, hskDictionary, hskWordItems } from '../dictionary/hskDictionary.ts'
import { getStudyItemId } from '../dictionary/studyItem.ts'
import { applyHskLevel, createEmptyProgress } from '../progress/progress.ts'
import type { ProgressData } from '../progress/types.ts'
import { seededRandom } from '../../test/random.ts'
import {
  createSentenceForItem,
  createSentenceSession,
  getLearnedSentenceWords,
  getVocabularyLevel,
} from './sentenceBuilder.ts'
import { SENTENCE_LEXICON } from './sentenceLexicon.ts'

function progressFor(level: 1 | 2 | 3 | 4): ProgressData {
  const items = hskWordItems.flatMap((item) =>
    item.entry.hskLevel === undefined
      ? []
      : [{ itemId: getStudyItemId(item), hskLevel: item.entry.hskLevel }],
  )
  return applyHskLevel(createEmptyProgress(), items, level, new Date())
}

describe('SENTENCE_LEXICON', () => {
  it('only names words that exist in the dictionary', () => {
    for (const lexeme of SENTENCE_LEXICON) {
      expect(hskDictionary.words.get(lexeme.id), lexeme.id).toBeDefined()
    }
  })
})

describe('getLearnedSentenceWords', () => {
  it('returns the learned words with their grammar data', () => {
    const progress = progressFor(1)
    const learned = getLearnedSentenceWords(progress)

    expect(learned.length).toBeGreaterThan(0)
    expect(learned.every((word) => progress.items[word.id] !== undefined)).toBe(true)
    expect(learned.some((word) => word.lexeme.tags.includes('person'))).toBe(true)
  })

  it('returns nothing for a new user', () => {
    expect(getLearnedSentenceWords(createEmptyProgress())).toEqual([])
  })
})

describe('createSentenceSession', () => {
  it('returns no sentences when nothing has been learned', () => {
    expect(createSentenceSession(createEmptyProgress())).toEqual([])
  })

  it('builds sentences using only learned words', () => {
    const progress = progressFor(1)
    const session = createSentenceSession(progress, { size: 10, random: seededRandom(1), level: 1 })

    expect(session.length).toBeGreaterThan(0)
    for (const sentence of session) {
      expect(sentence.chinese).not.toBe('')
      expect(sentence.english).not.toBe('')
      for (const word of sentence.words) {
        expect(progress.items[word.id], word.word.hanzi).toBeDefined()
      }
    }
  })

  it('stays at the requested difficulty', () => {
    const session = createSentenceSession(progressFor(2), {
      size: 10,
      random: seededRandom(2),
      level: 1,
    })

    expect(session.length).toBeGreaterThan(0)
    expect(session.every((sentence) => sentence.difficulty === 1)).toBe(true)
  })

  it('starts easy and gets harder through the session', () => {
    const session = createSentenceSession(progressFor(4), {
      size: 10,
      random: seededRandom(3),
      level: 3,
    })

    expect(session.length).toBeGreaterThan(3)
    for (let index = 1; index < session.length; index++) {
      expect(session[index]!.difficulty).toBeGreaterThanOrEqual(session[index - 1]!.difficulty)
    }
  })

  it('does not repeat a sentence in a session', () => {
    const session = createSentenceSession(progressFor(4), {
      size: 10,
      random: seededRandom(4),
      level: 3,
    })

    expect(new Set(session.map((sentence) => sentence.chinese)).size).toBe(session.length)
    expect(new Set(session.map((sentence) => sentence.id)).size).toBe(session.length)
  })

  it('builds the same session with the same random sequence', () => {
    const options = { size: 8, level: 2 }
    const first = createSentenceSession(progressFor(3), { ...options, random: seededRandom(5) })
    const second = createSentenceSession(progressFor(3), { ...options, random: seededRandom(5) })

    expect(first).toEqual(second)
  })

  it('avoids recently used sentences when there are enough new ones', () => {
    const progress = progressFor(2)
    const first = createSentenceSession(progress, { size: 3, random: seededRandom(6), level: 1 })
    const second = createSentenceSession(progress, {
      size: 3,
      random: seededRandom(7),
      level: 1,
      recent: first.map((sentence) => sentence.id),
    })

    expect(second.some((sentence) => first.some((used) => used.id === sentence.id))).toBe(false)
  })

  it('writes translations without duplicated articles', () => {
    const session = createSentenceSession(progressFor(4), {
      size: 20,
      random: seededRandom(8),
      level: 3,
    })

    for (const sentence of session) {
      expect(sentence.english).not.toMatch(/\ba the\b|\bthe a\b|\ban the\b|\bthe an\b/)
      expect(sentence.english).toMatch(/[.!?]$/)
    }
  })
})

describe('createSentenceForItem', () => {
  it('builds a sentence that contains the item', () => {
    const progress = progressFor(1)
    const item = hskWordItems.find((word) => word.entry.hanzi === '苹果')!
    const sentence = createSentenceForItem(item, progress, seededRandom(9))

    expect(sentence).toBeDefined()
    expect(sentence!.words.some((word) => word.id === getStudyItemId(item))).toBe(true)
    expect(sentence!.chinese).toContain('苹果')
  })

  it('has no sentence for a character or for an unlearned word', () => {
    const progress = progressFor(1)
    const character = hskCharacterItems.find((item) => item.entry.hanzi === '苹')!
    const unlearned = hskWordItems.find((item) => item.entry.hskLevel === 4)!

    expect(createSentenceForItem(character, progress, seededRandom(1))).toBeUndefined()
    expect(createSentenceForItem(unlearned, progress, seededRandom(1))).toBeUndefined()
  })
})

describe('getVocabularyLevel', () => {
  it('raises the level as the vocabulary grows', () => {
    expect(getVocabularyLevel(0)).toBe(1)
    expect(getVocabularyLevel(11)).toBe(1)
    expect(getVocabularyLevel(12)).toBe(2)
    expect(getVocabularyLevel(29)).toBe(2)
    expect(getVocabularyLevel(30)).toBe(3)
  })
})
