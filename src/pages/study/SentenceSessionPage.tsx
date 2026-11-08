import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { ButtonLink } from '../../components/ui/ButtonLink.tsx'
import { Card } from '../../components/ui/Card.tsx'
import { PageHeader } from '../../components/ui/PageHeader.tsx'
import { t } from '../../i18n/index.ts'
import { useRuntimeSources } from '../../features/dictionary/runtime/runtimeSourcesContext.ts'
import { useProgress } from '../../features/progress/progressContext.ts'
import {
  getDueSentences,
  getLearnableSentences,
  getUpToDateSentences,
} from '../../features/sentences/progress.ts'
import {
  getSentenceSetPath,
  isHskLevel,
  loadSentenceItems,
} from '../../features/sentences/sentenceSets.ts'
import type { SentenceItem } from '../../features/sentences/types.ts'
import { SentenceSession } from '../../features/sentences/components/SentenceSession.tsx'
import { NotFoundPage } from '../NotFoundPage.tsx'

/** Learn or review one HSK sentence set. */
export function SentenceSessionPage({ mode }: { mode: 'learn' | 'study' }) {
  const { level = '' } = useParams()
  if (!isHskLevel(level)) return <NotFoundPage />
  return <SentenceSessionContent level={Number(level) as 1 | 2 | 3 | 4} mode={mode} />
}

interface SessionLoad {
  /** The level, mode and scope this snapshot belongs to. */
  key: string
  items?: readonly SentenceItem[]
  /** The session's items, frozen when it starts. */
  sessionItems?: readonly SentenceItem[]
  error?: boolean
}

function SentenceSessionContent({ level, mode }: { level: 1 | 2 | 3 | 4; mode: 'learn' | 'study' }) {
  const { progress } = useProgress()
  const { fetchFn } = useRuntimeSources()
  const [searchParams] = useSearchParams()
  const reviewAll = searchParams.get('scope') === 'all'
  const key = `${level}:${mode}:${reviewAll}`
  const [load, setLoad] = useState<SessionLoad>({ key })
  // The progress to use when the session starts. A ref keeps the load effect
  // from running again on every answer.
  const progressRef = useRef(progress)
  useEffect(() => {
    progressRef.current = progress
  })

  useEffect(() => {
    let active = true
    loadSentenceItems(level, fetchFn).then(
      (items) => {
        if (!active) return
        const current = progressRef.current
        const now = new Date()
        const sessionItems =
          mode === 'learn'
            ? getLearnableSentences(items, current)
            : reviewAll
              ? [...getDueSentences(items, current, now), ...getUpToDateSentences(items, current, now)]
              : getDueSentences(items, current, now)
        setLoad({ key, items, sessionItems })
      },
      () => {
        if (active) setLoad({ key, error: true })
      },
    )
    return () => {
      active = false
    }
  }, [key, level, mode, reviewAll, fetchFn])

  const current = load.key === key ? load : { key }
  const backPath = getSentenceSetPath(level)

  if (current.error) {
    return (
      <>
        <PageHeader title={t('sets.sentences.name', { level })} description={t('sets.sentences.description')} />
        <Card>
          <p className="text-ink-muted">{t('sentences.loadError')}</p>
        </Card>
      </>
    )
  }
  if (!current.items || !current.sessionItems) {
    return (
      <>
        <PageHeader title={t('sets.sentences.name', { level })} description={t('sets.sentences.description')} />
        <Card>
          <p className="text-ink-muted">{t('sentences.loading')}</p>
        </Card>
      </>
    )
  }
  if (current.sessionItems.length === 0) {
    return (
      <>
        <PageHeader title={t('sets.sentences.name', { level })} description={t('sets.sentences.description')} />
        <Card className="mx-auto flex max-w-xl flex-col items-start gap-4">
          <p className="text-lg">
            {t(
              mode === 'learn'
                ? 'sentences.learnEmpty'
                : reviewAll
                  ? 'sentences.studyUpToDate'
                  : 'sentences.studyEmpty',
            )}
          </p>
          <ButtonLink to={backPath} variant="secondary">
            {t('sentences.back')}
          </ButtonLink>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('sets.sentences.name', { level })} description={t('sets.sentences.description')} />
      <SentenceSession items={current.sessionItems} mode={mode} backPath={backPath} />
    </>
  )
}
