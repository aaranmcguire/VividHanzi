import { describe, expect, it } from 'vitest'
import { hskDictionary } from '../dictionary/hskDictionary.ts'
import { listStudyItems, type StudyItem } from '../dictionary/studyItem.ts'
import { seededRandom } from '../../test/random.ts'
import {
  CHOICE_OPTION_COUNT,
  getMeaningClues,
  getMeaningLabel,
  getPinyinLabel,
  hanziChoiceDefinition,
  isCorrectOption,
  listeningChoiceDefinition,
  meaningChoiceDefinition,
  pickDistractors,
  pinyinChoiceDefinition,
} from './choiceExercises.ts'

function character(hanzi: string, pinyin: string[], meanings: string[]): StudyItem {
  return { kind: 'character', entry: { id: hanzi, hanzi, pinyin, meanings: { en: meanings }, hskLevel: 1 } }
}

function word(hanzi: string, pinyin: string, meanings: string[]): StudyItem {
  return { kind: 'word', entry: { id: hanzi, hanzi, pinyin, meanings: { en: meanings }, hskLevel: 1 } }
}

const hanziOf = (items: readonly StudyItem[]) => items.map((item) => item.entry.hanzi)

describe('getMeaningClues', () => {
  it('removes parentheses that quote the hanzi itself', () => {
    expect(getMeaningClues(character('大', ['dà'], ['big; large', 'eldest (as in 大姐)']))).toEqual([
      'big; large',
      'eldest',
    ])
  })

  it('discards meanings that still reveal the hanzi', () => {
    expect(getMeaningClues(character('漂', ['piào'], ['used in 漂亮']))).toEqual([])
  })

  it('keeps parentheses and hanzi that reveal nothing', () => {
    const item = character('你', ['nǐ'], ['you (informal, as opposed to courteous 您)'])
    expect(getMeaningClues(item)).toEqual(['you (informal, as opposed to courteous 您)'])
  })
})

describe('getMeaningLabel', () => {
  it('joins meanings while they fit', () => {
    // With the third one it would exceed 40 characters
    expect(getMeaningLabel(word('朋友', 'péng you', ['friend', 'companion', 'boyfriend or girlfriend']))).toBe(
      'friend; companion',
    )
    expect(getMeaningLabel(word('爱', 'ài', ['to love; to be fond of; to like', 'affection']))).toBe(
      'to love; to be fond of; to like',
    )
  })

  it('always includes the first meaning, even if it is long', () => {
    const long = 'plural marker for pronouns, and nouns referring to individuals'
    expect(getMeaningLabel(character('们', ['men'], [long, 'other']))).toBe(long)
  })
})

describe('getPinyinLabel', () => {
  it('uses the first reading of a character with several', () => {
    expect(getPinyinLabel(character('了', ['le', 'liǎo'], ['completed action marker']))).toBe('le')
  })
})

describe('pickDistractors', () => {
  const pool = [
    word('朋友', 'péng you', ['friend']),
    word('喜欢', 'xǐ huan', ['to like; to be fond of']),
    word('爱', 'ài', ['to love; to be fond of; to like']),
    word('老师', 'lǎo shī', ['teacher']),
    word('医生', 'yī shēng', ['doctor']),
    word('学生', 'xué sheng', ['student']),
    word('飞机', 'fēi jī', ['airplane']),
    character('好', ['hǎo'], ['good']),
  ]

  it('does not include the answer, another item kind or synonyms', () => {
    const distractors = pickDistractors('meaning-choice', pool[1]!, pool) // 喜欢

    expect(distractors).toHaveLength(CHOICE_OPTION_COUNT - 1)
    // 爱 shares "to like" and 好 is a character
    expect(hanziOf(distractors)).not.toContain('喜欢')
    expect(hanziOf(distractors)).not.toContain('爱')
    expect(hanziOf(distractors)).not.toContain('好')
  })

  it('prefers distractors with the same number of characters', () => {
    // 爱 has a single character: it goes to the end and is not needed
    expect(hanziOf(pickDistractors('meaning-choice', pool[0]!, pool))).toEqual(['喜欢', '老师', '医生'])
  })

  it('for pinyin discards identical readings', () => {
    const items = [
      character('是', ['shì'], ['to be']),
      character('事', ['shì'], ['matter']),
      character('了', ['le', 'liǎo'], ['completed action marker']),
      character('瞭', ['liǎo'], ['clear']),
      character('十', ['shí'], ['ten']),
      character('四', ['sì'], ['four']),
    ]
    const distractors = pickDistractors('pinyin-choice', items[0]!, items)

    // 事 reads the same as 是; 了 and 瞭 share liǎo, so only one of the two goes in
    expect(hanziOf(distractors)).toEqual(['了', '十', '四'])
  })

  it('does not repeat the same hanzi in hanzi options', () => {
    const items = [
      character('你', ['nǐ'], ['you']),
      character('好', ['hǎo'], ['good']),
      character('好', ['hào'], ['to be fond of']),
      character('他', ['tā'], ['he']),
      character('她', ['tā'], ['she']),
    ]
    const distractors = pickDistractors('hanzi-choice', items[0]!, items)

    expect(hanziOf(distractors)).toEqual(['好', '他', '她'])
  })
})

describe('multiple-choice definitions', () => {
  const pool = ['一', '二', '三', '四', '五', '六'].map((hanzi, index) =>
    character(hanzi, [`p${index}`], [`number ${index + 1}`]),
  )

  it.each([
    meaningChoiceDefinition,
    listeningChoiceDefinition,
    pinyinChoiceDefinition,
    hanziChoiceDefinition,
  ])(
    '$type creates four distinct options with the answer among them',
    (definition) => {
      const item = pool[0]!
      expect(definition.canBuild(item, pool)).toBe(true)

      const exercise = definition.build(item, pool, seededRandom(1))

      expect(exercise.type).toBe(definition.type)
      expect(exercise.options).toHaveLength(CHOICE_OPTION_COUNT)
      expect(new Set(exercise.options).size).toBe(CHOICE_OPTION_COUNT)
      expect(exercise.options.filter((option) => isCorrectOption(exercise, option))).toHaveLength(1)
    },
  )

  it('creates the same options with the same seed, and they change with other seeds', () => {
    const build = (seed: number) => hanziOf(meaningChoiceDefinition.build(pool[0]!, pool, seededRandom(seed)).options)

    expect(build(1)).toEqual(build(1))
    expect(new Set([1, 2, 3, 4, 5].map((seed) => build(seed).join(''))).size).toBeGreaterThan(1)
  })

  it('cannot be built without enough distractors', () => {
    expect(meaningChoiceDefinition.canBuild(pool[0]!, pool.slice(0, CHOICE_OPTION_COUNT - 1))).toBe(false)
  })

  it('listening questions need a recording', () => {
    const silent = word('测试词', 'cè shì cí', ['test word'])
    expect(listeningChoiceDefinition.canBuild(silent, [...pool, silent])).toBe(false)
    expect(listeningChoiceDefinition.canBuild(pool[0]!, pool)).toBe(true)
  })

  it('does not ask about meanings that reveal the hanzi', () => {
    const revealing = character('漂', ['piào'], ['used in 漂亮'])
    const withRevealing = [...pool, revealing]

    expect(meaningChoiceDefinition.canBuild(revealing, withRevealing)).toBe(false)
    expect(hanziChoiceDefinition.canBuild(revealing, withRevealing)).toBe(false)
    expect(pinyinChoiceDefinition.canBuild(revealing, withRevealing)).toBe(true)
  })
})

describe('with the HSK 1 dataset', () => {
  const pool = listStudyItems(hskDictionary)

  it('every item supports at least one multiple-choice exercise', () => {
    const definitions = [meaningChoiceDefinition, pinyinChoiceDefinition, hanziChoiceDefinition]
    const withoutChoice = pool.filter((item) => !definitions.some((definition) => definition.canBuild(item, pool)))

    expect(withoutChoice).toEqual([])
  })
})
