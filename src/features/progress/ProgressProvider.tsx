import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { KeyValueStorage } from '../../lib/storage.ts'
import { applyHskLevel, createEmptyProgress, introduceItem, introduceSentence, markCharactersTaught, markItemKnown, recordAnswer, recordPracticeAnswer, recordSentenceAnswer, recordWritingAnswer, restoreProgress, setItemExcluded, setItemKnown } from './progress.ts'
import { EXERCISE_SKILLS } from './skills.ts'
import { ProgressContext, type ProgressContextValue } from './progressContext.ts'
import { loadProgress, saveProgress } from './storage.ts'

type ProgressProviderProps = {
  children: ReactNode
  /** Where to save; localStorage by default. Tests pass an in-memory one. */
  storage?: KeyValueStorage
}

/**
 * Keeps progress in React state and syncs it with storage: it is loaded
 * once at startup and saved on every change.
 */
export function ProgressProvider({ children, storage }: ProgressProviderProps) {
  const [progress, setProgress] = useState(() => loadProgress(storage))

  useEffect(() => {
    saveProgress(progress, storage)
  }, [progress, storage])

  const value = useMemo<ProgressContextValue>(
    () => ({
      progress,
      recordAnswer: (itemId, correct) => setProgress((current) => recordAnswer(current, itemId, correct, new Date())),
      recordResult: ({ itemId, exerciseType, correct, skills }) => {
        const skill = EXERCISE_SKILLS[exerciseType]
        setProgress((current) =>
          skill === 'writing'
            ? recordWritingAnswer(current, itemId, correct, new Date())
            : recordAnswer(current, itemId, correct, new Date(), skills ?? { [skill]: correct }),
        )
      },
      recordPracticeAnswer: (correct) => setProgress((current) => recordPracticeAnswer(current, correct, new Date())),
      introduceItem: (itemId) => setProgress((current) => introduceItem(current, itemId, new Date())),
      introduceSentence: (sentenceId) =>
        setProgress((current) => introduceSentence(current, sentenceId, new Date())),
      recordSentenceAnswer: (sentenceId, correct) =>
        setProgress((current) => recordSentenceAnswer(current, sentenceId, correct, new Date())),
      markCharactersTaught: (characters) =>
        setProgress((current) => markCharactersTaught(current, characters, new Date())),
      markItemKnown: (itemId) => setProgress((current) => markItemKnown(current, itemId, new Date())),
      setItemKnown: (itemId) => setProgress((current) => setItemKnown(current, itemId, new Date())),
      setItemProgress: (itemId, item) =>
        setProgress((current) => {
          const items = { ...current.items }
          if (item) items[itemId] = item
          else delete items[itemId]
          return { ...current, items }
        }),
      setItemExcluded: (itemId, excluded) =>
        setProgress((current) => setItemExcluded(current, itemId, excluded, new Date())),
      restoreProgress: (before, itemIds) =>
        setProgress((current) => restoreProgress(current, before, itemIds, new Date())),
      applyHskLevel: (items, level) => setProgress((current) => applyHskLevel(current, items, level, new Date())),
      resetProgress: () => setProgress(createEmptyProgress()),
    }),
    [progress],
  )

  return <ProgressContext value={value}>{children}</ProgressContext>
}
