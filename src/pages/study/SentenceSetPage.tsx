import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '../../components/ui/Button.tsx'
import { ButtonLink } from '../../components/ui/ButtonLink.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { PageHeader } from '../../components/ui/PageHeader.tsx'
import { StatCard } from '../../components/ui/StatCard.tsx'
import { t, tCount } from '../../i18n/index.ts'
import { useRuntimeSources } from '../../features/dictionary/runtime/runtimeSourcesContext.ts'
import { SentenceAudioButton } from '../../features/audio/SentenceAudioButton.tsx'
import { StatusBadge } from '../../features/progress/components/StatusBadge.tsx'
import { useProgress } from '../../features/progress/progressContext.ts'
import { getSentenceStatus, getDueSentences, getLearnableSentences, summarizeSentences } from '../../features/sentences/progress.ts'
import { getSentenceSessionPath, isHskLevel, loadSentenceItems } from '../../features/sentences/sentenceSets.ts'
import type { SentenceItem } from '../../features/sentences/types.ts'
import { SetProgressBar } from '../../features/studySets/components/SetProgressBar.tsx'
import { NotFoundPage } from '../NotFoundPage.tsx'

const PAGE_SIZE = 100

/** One HSK sentence set: progress, Learn/Review actions and the sentence list. */
export function SentenceSetPage() {
  const { level = '' } = useParams()
  if (!isHskLevel(level)) return <NotFoundPage />
  const hskLevel = Number(level) as 1 | 2 | 3 | 4

  return (
    <>
      <PageHeader
        title={t('sets.sentences.name', { level: hskLevel })}
        description={t('sets.sentences.description')}
      />
      <SentenceSetContent level={hskLevel} />
    </>
  )
}

interface SetLoad {
  level: number
  items?: readonly SentenceItem[]
  error?: boolean
}

function SentenceSetContent({ level }: { level: 1 | 2 | 3 | 4 }) {
  const { progress } = useProgress()
  const { fetchFn } = useRuntimeSources()
  const [load, setLoad] = useState<SetLoad>({ level })
  const [shown, setShown] = useState(PAGE_SIZE)

  useEffect(() => {
    let active = true
    loadSentenceItems(level, fetchFn).then(
      (items) => {
        if (active) setLoad({ level, items })
      },
      () => {
        if (active) setLoad({ level, error: true })
      },
    )
    return () => {
      active = false
    }
  }, [level, fetchFn])

  const current = load.level === level ? load : { level }
  if (current.error) {
    return (
      <Card>
        <p className="text-ink-muted">{t('sentences.loadError')}</p>
      </Card>
    )
  }
  if (!current.items) {
    return (
      <Card>
        <p className="text-ink-muted">{t('sentences.loading')}</p>
      </Card>
    )
  }

  const items = current.items

  const now = new Date()
  const summary = summarizeSentences(items.map((item) => item.id), progress, now)
  const learnable = getLearnableSentences(items, progress).length
  const due = getDueSentences(items, progress, now).length
  const ratio = summary.total > 0 ? summary.mastered / summary.total : 0

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold">{t('sets.progressTitle')}</h2>
          <span className="text-sm text-ink-muted">
            {tCount(summary.total, 'sets.sentences.countOne', 'sets.sentences.count')}
          </span>
        </div>
        <SetProgressBar name={t('sets.sentences.name', { level })} progress={{ ...summary, ratio }} />
        <dl className="grid grid-cols-3 gap-3">
          <StatCard label={t('sets.mastered')} value={summary.mastered} />
          <StatCard label={t('sets.learning')} value={summary.learning} />
          <StatCard label={t('sets.notStarted')} value={summary.new} />
        </dl>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold">{t('session.learn')}</h2>
          <p>
            {learnable > 0
              ? tCount(learnable, 'session.learnAvailableOne', 'session.learnAvailable')
              : t('sentences.learnEmpty')}
          </p>
          {learnable > 0 && (
            <ButtonLink to={getSentenceSessionPath(level, 'learn')} className="mt-auto self-start">
              {t('session.learn')}
            </ButtonLink>
          )}
        </section>
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold">{t('session.study')}</h2>
          <p>
            {summary.studied === 0
              ? t('sentences.studyEmpty')
              : due > 0
                ? tCount(due, 'session.studyDueOne', 'session.studyDue')
                : t('sentences.studyUpToDate')}
          </p>
          <div className="mt-auto self-start">
            {summary.studied === 0 ? (
              <ButtonLink to={getSentenceSessionPath(level, 'learn')} variant="secondary">
                {t('session.startLearning')}
              </ButtonLink>
            ) : due > 0 ? (
              <ButtonLink to={getSentenceSessionPath(level, 'study')}>{t('session.study')}</ButtonLink>
            ) : (
              <ButtonLink to={getSentenceSessionPath(level, 'study', true)} variant="secondary">
                {t('sentences.reviewAnyway')}
              </ButtonLink>
            )}
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('sets.sentences.list')}</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {items.slice(0, shown).map((sentence) => (
            <li
              key={sentence.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-hanzi text-lg">{sentence.zh}</p>
                <p className="text-sm text-ink-muted">{sentence.en}</p>
              </div>
              <SentenceAudioButton sentence={sentence} />
              <StatusBadge status={getSentenceStatus(progress, sentence.id)} />
            </li>
          ))}
        </ul>
        {shown < items.length && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setShown(shown + PAGE_SIZE)}>
              {t('sets.showMore')}
            </Button>
            <span className="text-sm text-ink-muted">
              {t('dictionary.showing', { count: shown, total: items.length })}
            </span>
          </div>
        )}
      </section>

      <Link to="/study/sentences" className="self-start text-accent-strong underline underline-offset-2">
        {t('sentences.back')}
      </Link>
    </div>
  )
}
