import { useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { ButtonLink } from '../../../components/ui/ButtonLink.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { t } from '../../../i18n/index.ts'
import { StatusBadge } from '../../progress/components/StatusBadge.tsx'
import { useProgress } from '../../progress/progressContext.ts'
import type { ProgressData } from '../../progress/types.ts'
import { SentenceAudioButton } from '../../audio/SentenceAudioButton.tsx'
import { SessionFrame } from '../../practice/components/SessionFrame.tsx'
import { SentenceCard } from './SentenceCard.tsx'
import type { SentenceItem } from '../types.ts'

type SentenceSessionProps = {
  items: readonly SentenceItem[]
  mode: 'learn' | 'study'
  /** Where "back" and the summary return to. */
  backPath: string
}

/**
 * Learn or review a set of sentences with flip cards. Learn introduces new
 * sentences; Study reviews the ones whose spaced repetition is due. Both keep
 * sentence progress apart from word progress.
 */
export function SentenceSession({ items, mode, backPath }: SentenceSessionProps) {
  return mode === 'learn' ? (
    <SentenceLearnSession items={items} backPath={backPath} />
  ) : (
    <SentenceStudySession items={items} backPath={backPath} />
  )
}

type LearnChoice = 'learned' | 'not-yet' | 'skip'

function SentenceLearnSession({ items, backPath }: Omit<SentenceSessionProps, 'mode'>) {
  const { progress, introduceSentence, setItemExcluded, restoreProgress } = useProgress()
  // Freeze the session: progress changes must not remove sentences mid-session.
  const [sessionItems] = useState(items)
  const [choices, setChoices] = useState<
    readonly { item: SentenceItem; choice: LearnChoice; progress: ProgressData }[]
  >([])
  const current = sessionItems[choices.length]
  const learned = choices.filter(({ choice }) => choice === 'learned')
  const skipped = choices.filter(({ choice }) => choice === 'skip')
  const last = choices.at(-1)
  const back =
    last &&
    (() => {
      restoreProgress(last.progress, [last.item.id])
      setChoices(choices.slice(0, -1))
    })

  if (!current) {
    return (
      <Card className="mx-auto flex max-w-xl flex-col gap-4 sm:gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight">{t('sentences.learn.title')}</h2>
          <p className="mt-2 text-lg text-ink-muted">
            {t('sentences.learn.count', { learned: learned.length, total: sessionItems.length })}
          </p>
        </div>
        <SentenceSummaryList
          sentences={learned.map(({ item }) => item)}
          empty={t('sentences.learn.none')}
          status="mastered"
        />
        {skipped.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink-muted">{t('sentences.summary.skipped')}</h3>
            <SentenceSummaryList sentences={skipped.map(({ item }) => item)} empty="" status="excluded" />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <ButtonLink to={`${backPath}/study`} variant="secondary">
            {t('sentences.reviewNow')}
          </ButtonLink>
          <ButtonLink to={backPath} variant="secondary">
            {t('sentences.back')}
          </ButtonLink>
          {back && (
            <Button variant="secondary" onClick={back} className="sm:col-span-2">
              {t('practice.back')}
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const choose = (choice: LearnChoice) => {
    if (choice === 'skip') setItemExcluded(current.id, true)
    else if (choice === 'learned') introduceSentence(current.id)
    setChoices([...choices, { item: current, choice, progress }])
  }

  const progressText = t('sentences.session.progress', {
    current: choices.length + 1,
    total: sessionItems.length,
  })

  return (
    <SessionFrame progressText={progressText} value={choices.length} max={sessionItems.length} onBack={back}>
      {(lookUp) => (
        <SentenceCard
          key={current.id}
          sentence={current}
          mode="learn"
          opener={{ onOpen: lookUp }}
          onAnswer={(correct) => choose(correct ? 'learned' : 'not-yet')}
          onSkip={() => choose('skip')}
        />
      )}
    </SessionFrame>
  )
}

interface StudyState {
  queue: readonly { item: SentenceItem; retry: boolean }[]
  index: number
  results: readonly { item: SentenceItem; correct: boolean }[]
  previous?: { state: StudyState; progress: ProgressData }
}

function SentenceStudySession({ items, backPath }: Omit<SentenceSessionProps, 'mode'>) {
  const { progress, recordSentenceAnswer, restoreProgress } = useProgress()
  // Freeze the session: a due sentence stops being due as soon as it is answered.
  const [sessionItems] = useState(items)
  const [state, setState] = useState<StudyState>({
    queue: sessionItems.map((item) => ({ item, retry: false })),
    index: 0,
    results: [],
  })
  const current = state.queue[state.index]
  const back =
    state.previous &&
    (() => {
      const previous = state.previous!
      const answered = previous.state.queue[previous.state.index]
      if (answered) restoreProgress(previous.progress, [answered.item.id])
      setState(previous.state)
    })

  if (!current) {
    const firstAttempts = state.results.slice(0, sessionItems.length)
    const correct = firstAttempts.filter((result) => result.correct).length
    const missed = firstAttempts.filter((result) => !result.correct).map((result) => result.item)
    return (
      <Card className="mx-auto flex max-w-xl flex-col gap-4 sm:gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight">{t('sentences.study.title')}</h2>
          <p className="mt-2 text-lg text-ink-muted">
            {t('sentences.study.count', { correct, total: sessionItems.length })}
          </p>
        </div>
        {missed.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink-muted">{t('sentences.summary.missed')}</h3>
            <SentenceSummaryList sentences={missed} empty="" />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <ButtonLink to={`${backPath}/study?scope=all`} variant="secondary">
            {t('sentences.practiceAgain')}
          </ButtonLink>
          <ButtonLink to={backPath} variant="secondary">
            {t('sentences.back')}
          </ButtonLink>
          {back && (
            <Button variant="secondary" onClick={back} className="sm:col-span-2">
              {t('practice.back')}
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const answer = (correct: boolean) => {
    recordSentenceAnswer(current.item.id, correct)
    const queue = correct
      ? state.queue
      : [...state.queue, { item: current.item, retry: true }]
    setState({
      queue,
      index: state.index + 1,
      results: [...state.results, { item: current.item, correct }],
      previous: { state, progress },
    })
  }

  const progressText = t('sentences.session.progress', {
    current: Math.min(state.index + 1, state.queue.length),
    total: state.queue.length,
  })

  return (
    <SessionFrame
      progressText={progressText}
      value={state.index}
      max={state.queue.length}
      onBack={back}
    >
      {(lookUp) => (
        <SentenceCard
          key={`${current.item.id}-${state.index}`}
          sentence={current.item}
          mode="study"
          isRetry={current.retry}
          opener={{ onOpen: lookUp }}
          onAnswer={answer}
        />
      )}
    </SessionFrame>
  )
}

function SentenceSummaryList({
  sentences,
  empty,
  status,
}: {
  sentences: readonly SentenceItem[]
  empty: string
  status?: 'mastered' | 'excluded'
}) {
  if (sentences.length === 0) return empty === '' ? null : <p className="text-sm text-ink-muted">{empty}</p>
  return (
    <ul className="divide-y divide-line">
      {sentences.map((sentence) => (
        <li key={sentence.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="font-hanzi text-lg">{sentence.zh}</p>
            <p className="truncate text-sm text-ink-muted">{sentence.en}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SentenceAudioButton sentence={sentence} />
            {status && <StatusBadge status={status} />}
          </div>
        </li>
      ))}
    </ul>
  )
}
