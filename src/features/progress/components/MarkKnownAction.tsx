import { useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { t } from '../../../i18n/index.ts'
import type { StudyItemId } from '../../dictionary/studyItem.ts'
import { useProgress } from '../progressContext.ts'
import type { DisplayStatus } from '../progress.ts'
import type { ItemProgress } from '../types.ts'

type MarkKnownActionProps = {
  itemId: StudyItemId
  hanzi: string
  status: DisplayStatus
  className?: string
}

/**
 * Quick "Mark as known" for a word in a set list or its entry page. It works
 * for new and learning items; Undo puts the previous progress record back.
 */
export function MarkKnownAction({ itemId, hanzi, status, className = '' }: MarkKnownActionProps) {
  const { progress, setItemKnown, setItemProgress } = useProgress()
  // undefined: no quick action was used here; null: there was no record before
  const [previous, setPrevious] = useState<ItemProgress | null | undefined>(undefined)

  if (status === 'excluded') return null

  if (status === 'mastered') {
    if (previous === undefined) return null
    return (
      <Button
        variant="secondary"
        className={`px-2.5 py-1 text-xs ${className}`}
        aria-label={t('sets.undoKnownNamed', { hanzi })}
        onClick={() => {
          setItemProgress(itemId, previous ?? undefined)
          setPrevious(undefined)
        }}
      >
        {t('sets.undoKnown')}
      </Button>
    )
  }

  return (
    <Button
      variant="secondary"
      className={`px-2.5 py-1 text-xs ${className}`}
      aria-label={t('sets.markKnownNamed', { hanzi })}
      onClick={() => {
        setPrevious(progress.items[itemId] ?? null)
        setItemKnown(itemId)
      }}
    >
      {t('sets.markKnown')}
    </Button>
  )
}
