import { Link } from 'react-router'
import { ButtonLink } from '../../../components/ui/ButtonLink.tsx'
import { t, tCount } from '../../../i18n/index.ts'
import { useProgress } from '../../progress/progressContext.ts'
import { SetProgressBar } from '../../studySets/components/SetProgressBar.tsx'
import { getSentenceSetPath } from '../sentenceSets.ts'
import { summarizeSentences } from '../progress.ts'
import type { SentenceSetInfo } from '../types.ts'

/** Card for one HSK sentence set, with the same progress bar as word sets. */
export function SentenceSetCard({ set }: { set: SentenceSetInfo }) {
  const { progress } = useProgress()
  const summary = summarizeSentences(set.ids, progress, new Date())
  const ratio = summary.total > 0 ? summary.mastered / summary.total : 0

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:gap-4 sm:p-5">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-hanzi text-2xl text-accent-strong"
        >
          {set.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">
            <Link to={getSentenceSetPath(set.level)} className="hover:text-accent-strong hover:underline">
              {set.name}
            </Link>
          </h3>
          <p className="text-sm text-ink-muted">
            {tCount(set.count, 'sets.sentences.countOne', 'sets.sentences.count')}
            {' · '}
            {t('sets.sentences.audioCount', { count: set.audioCount })}
          </p>
        </div>
      </div>
      <p>{set.description}</p>
      <SetProgressBar name={set.name} progress={{ ...summary, ratio }} />
      <div className="mt-auto flex flex-wrap gap-2">
        <ButtonLink to={getSentenceSetPath(set.level)} variant="secondary">
          {t('sets.open')}
        </ButtonLink>
      </div>
    </article>
  )
}
