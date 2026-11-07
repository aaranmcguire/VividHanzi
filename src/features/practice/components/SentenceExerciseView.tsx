import { TranslationCard } from '../../translation/components/TranslationCard.tsx'
import { useAiStatus } from '../../translation/useAiStatus.ts'
import type { SentenceExercise } from '../types.ts'

/**
 * A sentence translation inside a Study session. It reuses the translation
 * card, including hints, AI grading and the manual fallback. The answer is
 * recorded against the sentence's target item, so it counts like any other
 * exercise in the session.
 */
export function SentenceExerciseView({
  exercise,
  onAnswer,
}: {
  exercise: SentenceExercise
  onAnswer: (correct: boolean) => void
}) {
  const ai = useAiStatus()
  return (
    <TranslationCard
      sentence={exercise.sentence}
      aiAvailable={ai.available}
      onAnswer={onAnswer}
    />
  )
}
