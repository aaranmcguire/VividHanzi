import { describe, expect, it } from 'vitest'
import {
  createEmptyProgress,
  introduceSentence,
  markSentenceKnown,
  recordSentenceAnswer,
  restoreProgress,
  setItemExcluded,
} from '../progress/progress.ts'
import {
  getDueSentences,
  getLearnableSentences,
  getSentenceStatus,
  getUpToDateSentences,
  isSentenceDue,
  isSentenceExcluded,
  isSentenceLearned,
  summarizeSentences,
} from './progress.ts'

const monday = new Date(2026, 8, 28, 10, 0)
const tuesday = new Date(2026, 8, 29, 10, 0)
const sentences = [{ id: 'sentence:1' as const }, { id: 'sentence:2' as const }, { id: 'sentence:3' as const }]

describe('sentence progress', () => {
  it('introduces a sentence with its first review due now', () => {
    const progress = introduceSentence(createEmptyProgress(), 'sentence:1', monday)

    expect(progress.sentences['sentence:1']).toMatchObject({ timesSeen: 0, masteryLevel: 0 })
    expect(isSentenceLearned(progress, 'sentence:1')).toBe(true)
    expect(isSentenceDue(progress, 'sentence:1', monday)).toBe(true)
    expect(getSentenceStatus(progress, 'sentence:1')).toBe('learning')
  })

  it('records a review in the sentence store and the day activity', () => {
    const introduced = introduceSentence(createEmptyProgress(), 'sentence:1', monday)
    const correct = recordSentenceAnswer(introduced, 'sentence:1', true, tuesday)

    expect(correct.sentences['sentence:1']).toMatchObject({ timesSeen: 1, timesCorrect: 1, masteryLevel: 1 })
    expect(correct.activity['2026-09-29']).toEqual({ answers: 1, correct: 1 })
    // Word progress is untouched
    expect(correct.items).toEqual({})
  })

  it('a miss resets the sentence and counts as wrong', () => {
    const introduced = introduceSentence(createEmptyProgress(), 'sentence:1', monday)
    const wrong = recordSentenceAnswer(introduced, 'sentence:1', false, tuesday)

    expect(wrong.sentences['sentence:1']).toMatchObject({ timesSeen: 1, timesWrong: 1, masteryLevel: 0 })
    expect(getSentenceStatus(wrong, 'sentence:1')).toBe('learning')
  })

  it('summarizes new, learning, mastered and due sentences', () => {
    let progress = introduceSentence(createEmptyProgress(), 'sentence:1', monday)
    progress = markSentenceKnown(progress, 'sentence:2', monday)

    expect(summarizeSentences(sentences.map((sentence) => sentence.id), progress, monday)).toEqual({
      total: 3,
      new: 1,
      learning: 1,
      mastered: 1,
      studied: 2,
      due: 1,
    })
  })

  it('filters what Learn can offer and what Study can review', () => {
    let progress = introduceSentence(createEmptyProgress(), 'sentence:1', monday)
    progress = setItemExcluded(progress, 'sentence:2', true, monday)
    progress = markSentenceKnown(progress, 'sentence:3', monday)

    expect(getLearnableSentences(sentences, progress).map((sentence) => sentence.id)).toEqual([])
    expect(isSentenceExcluded(progress, 'sentence:2')).toBe(true)
    expect(getDueSentences(sentences, progress, monday).map((sentence) => sentence.id)).toEqual(['sentence:1'])
    expect(getUpToDateSentences(sentences, progress, monday).map((sentence) => sentence.id)).toEqual([
      'sentence:3',
    ])
  })

  it('undoes a sentence answer without touching word progress', () => {
    const before = createEmptyProgress()
    const after = recordSentenceAnswer(introduceSentence(before, 'sentence:1', monday), 'sentence:1', true, tuesday)

    const restored = restoreProgress(after, before, ['sentence:1'], tuesday)

    expect(restored.sentences['sentence:1']).toBeUndefined()
    expect(restored.activity).toEqual({})
    expect(restored.items).toEqual({})
  })
})
