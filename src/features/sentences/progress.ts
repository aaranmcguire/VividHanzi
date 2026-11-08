import { getItemStatus, isDue, isExcluded, type ItemStatus } from '../progress/progress.ts'
import type { ItemsSummary } from '../progress/stats.ts'
import type { ProgressData } from '../progress/types.ts'
import type { SentenceId } from './types.ts'

/** Whether a sentence has been learned (it has an SRS record). */
export function isSentenceLearned(progress: ProgressData, sentenceId: SentenceId): boolean {
  return progress.sentences[sentenceId] !== undefined
}

/** Whether the user chose not to learn this sentence. */
export function isSentenceExcluded(progress: ProgressData, sentenceId: SentenceId): boolean {
  return isExcluded(progress, sentenceId)
}

/** The sentence's review is due now (or it was never learned: false). */
export function isSentenceDue(progress: ProgressData, sentenceId: SentenceId, now: Date): boolean {
  return isDue(progress.sentences[sentenceId], now)
}

export function getSentenceStatus(progress: ProgressData, sentenceId: SentenceId): ItemStatus {
  return getItemStatus(progress.sentences[sentenceId])
}

/** How many sentences are new, learning, mastered or due, like summarizeItemIds for words. */
export function summarizeSentences(
  sentenceIds: readonly SentenceId[],
  progress: ProgressData,
  now: Date,
): ItemsSummary {
  const summary: ItemsSummary = {
    total: sentenceIds.length,
    new: 0,
    learning: 0,
    mastered: 0,
    studied: 0,
    due: 0,
  }
  for (const sentenceId of sentenceIds) {
    const record = progress.sentences[sentenceId]
    summary[getItemStatus(record)] += 1
    if (isDue(record, now)) summary.due += 1
  }
  summary.studied = summary.learning + summary.mastered
  return summary
}

/** Sentences Learn can introduce: not learned and not excluded. */
export function getLearnableSentences<T extends { id: SentenceId }>(
  sentences: readonly T[],
  progress: ProgressData,
): T[] {
  return sentences.filter(
    (sentence) => !isSentenceLearned(progress, sentence.id) && !isSentenceExcluded(progress, sentence.id),
  )
}

/** Learned sentences whose review is due, oldest review first. */
export function getDueSentences<T extends { id: SentenceId }>(
  sentences: readonly T[],
  progress: ProgressData,
  now: Date,
): T[] {
  return sentences
    .filter((sentence) => isSentenceLearned(progress, sentence.id) && isSentenceDue(progress, sentence.id, now))
    .sort((a, b) =>
      (progress.sentences[a.id]?.nextReviewAt ?? '').localeCompare(
        progress.sentences[b.id]?.nextReviewAt ?? '',
      ),
    )
}

/** Learned sentences that are not due yet, soonest first. */
export function getUpToDateSentences<T extends { id: SentenceId }>(
  sentences: readonly T[],
  progress: ProgressData,
  now: Date,
): T[] {
  return sentences
    .filter((sentence) => isSentenceLearned(progress, sentence.id) && !isSentenceDue(progress, sentence.id, now))
    .sort((a, b) =>
      (progress.sentences[a.id]?.nextReviewAt ?? '').localeCompare(
        progress.sentences[b.id]?.nextReviewAt ?? '',
      ),
    )
}
