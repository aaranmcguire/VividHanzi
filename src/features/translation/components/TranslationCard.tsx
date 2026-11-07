import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { t, type MessageKey } from '../../../i18n/index.ts'
import { getMeanings } from '../../dictionary/dictionary.ts'
import { PinyinText } from '../../dictionary/components/PinyinText.tsx'
import { ToneHanzi } from '../../dictionary/components/ToneHanzi.tsx'
import { AudioButton } from '../../audio/AudioButton.tsx'
import { useSettings } from '../../settings/settingsContext.ts'
import {
  AiRequestError,
  getTranslationHint,
  gradeTranslation,
  type AiGrade,
  type AiHint,
  type AiVerdict,
} from '../ai.ts'
import { SentenceText } from './SentenceText.tsx'
import type { BuiltSentence, SentenceWord } from '../types.ts'

type TranslationCardProps = {
  sentence: BuiltSentence
  /** This sentence was missed earlier in the session and is being asked again. */
  isRetry?: boolean
  /** Workers AI is configured; the card may offer grading and hints. */
  aiAvailable: boolean
  fetchFn?: typeof fetch
  /** The user's own verdict after comparing with the reference translation. */
  onAnswer: (correct: boolean) => void
}

const VERDICT_LABELS: Record<AiVerdict, MessageKey> = {
  correct: 'translation.ai.correct',
  partial: 'translation.ai.partial',
  incorrect: 'translation.ai.incorrect',
}

const VERDICT_CLASSES: Record<AiVerdict, string> = {
  correct: 'text-success',
  partial: 'text-accent-strong',
  incorrect: 'text-danger',
}

/**
 * One sentence to translate. The user types an English translation and checks
 * it against a reference translation. With Workers AI, the AI grades it and
 * gives feedback and a memory tip; otherwise the user marks it themselves.
 * The AI can also give a hint before checking.
 */
export function TranslationCard({
  sentence,
  isRetry = false,
  aiAvailable,
  fetchFn,
  onAnswer,
}: TranslationCardProps) {
  const { settings } = useSettings()
  const aiEnabled = aiAvailable && settings.aiHelp
  const [answer, setAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const [showPinyin, setShowPinyin] = useState(false)
  const [hint, setHint] = useState<AiHint>()
  const [hintLoading, setHintLoading] = useState(false)
  const [hintError, setHintError] = useState(false)
  const [aiGrade, setAiGrade] = useState<AiGrade>()
  const [aiError, setAiError] = useState(false)
  const [aiPlanError, setAiPlanError] = useState(false)
  const [manualGrading, setManualGrading] = useState(false)
  const inputId = useId()
  const hintId = useId()
  const feedbackRef = useRef<HTMLDivElement>(null)

  const hasAnswer = answer.trim() !== ''
  // Derived, not stored: the AI is grading while all of these are true and
  // there is no verdict or error yet.
  const aiLoading =
    checked && aiEnabled && hasAnswer && !manualGrading && !aiGrade && !aiError && !aiPlanError
  const check = (event?: FormEvent) => {
    event?.preventDefault()
    if (!hasAnswer) return
    setChecked(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      check()
    }
  }

  const requestHint = async () => {
    setHintLoading(true)
    setHintError(false)
    try {
      setHint(
        await getTranslationHint(
          { chinese: sentence.chinese, reference: sentence.english, answer: answer.trim() },
          fetchFn,
        ),
      )
    } catch (error) {
      if (error instanceof AiRequestError && error.code === 'plan') setAiPlanError(true)
      else setHintError(true)
    } finally {
      setHintLoading(false)
    }
  }

  // Grade once, when the answer is checked. The user can cancel with "I'll
  // mark it myself", in which case the result is ignored.
  useEffect(() => {
    if (!aiLoading) return
    let active = true
    gradeTranslation(
      { chinese: sentence.chinese, reference: sentence.english, answer: answer.trim() },
      fetchFn,
    ).then(
      (result) => {
        if (active) setAiGrade(result)
      },
      (error) => {
        if (!active) return
        if (error instanceof AiRequestError && error.code === 'plan') setAiPlanError(true)
        else setAiError(true)
      },
    )
    return () => {
      active = false
    }
  }, [aiLoading, answer, sentence, fetchFn])

  // When the answer is revealed, move focus there so keyboard and screen
  // reader users stay in place.
  useEffect(() => {
    if (checked) feedbackRef.current?.focus()
  }, [checked])

  return (
    <Card className="flex flex-col gap-4 sm:gap-6">
      {isRetry && <p className="text-center text-sm text-ink-muted">{t('translation.retry')}</p>}

      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium tracking-wide text-ink-muted uppercase">
          {t('translation.prompt')}
        </p>
        <SentenceText
          sentence={sentence}
          showPinyin={showPinyin}
          className="text-4xl leading-relaxed sm:text-5xl"
        />
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-sm"
          aria-pressed={showPinyin}
          onClick={() => setShowPinyin((visible) => !visible)}
        >
          {t(showPinyin ? 'translation.hidePinyin' : 'translation.showPinyin')}
        </Button>
      </div>

      {hint && <HintBox hint={hint} />}
      {!checked &&
        (aiPlanError ? (
          <p role="alert" className="text-sm text-danger">
            {t('translation.ai.planError')}
          </p>
        ) : (
          hintError && (
            <p role="alert" className="text-sm text-danger">
              {t('translation.ai.hintError')}
            </p>
          )
        ))}

      {checked ? (
        <div
          ref={feedbackRef}
          role="group"
          tabIndex={-1}
          aria-label={t('translation.reference')}
          className="flex flex-col gap-4 outline-none"
        >
          <div className="rounded-xl bg-paper p-4">
            <p className="text-sm font-medium text-ink-muted">{t('translation.reference')}</p>
            <p className="mt-1 text-lg">{sentence.english}</p>
            {hasAnswer && (
              <p className="mt-3 text-sm text-ink-muted">
                {t('translation.yourAnswer', { answer: answer.trim() })}
              </p>
            )}
          </div>

          <WordBreakdown words={sentence.words} />

          {aiEnabled && hasAnswer ? (
            <AiGrading
              grade={aiGrade}
              loading={aiLoading}
              error={aiError}
              planError={aiPlanError}
              manual={manualGrading}
              onManual={() => setManualGrading(true)}
              onAnswer={onAnswer}
            />
          ) : (
            <ManualGradeButtons onAnswer={onAnswer} />
          )}
        </div>
      ) : (
        <form onSubmit={check} className="flex flex-col gap-2">
          <label htmlFor={inputId} className="font-medium">
            {t('translation.yourTranslation')}
          </label>
          <textarea
            id={inputId}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            maxLength={600}
            lang="en"
            autoComplete="off"
            aria-describedby={hintId}
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5"
          />
          <p id={hintId} className="text-sm text-ink-muted">
            {t('translation.keyboardHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!hasAnswer}>
              {t('translation.check')}
            </Button>
            <Button variant="secondary" onClick={() => setChecked(true)}>
              {t('translation.showAnswer')}
            </Button>
            {aiEnabled && !aiPlanError && (
              <Button variant="secondary" onClick={requestHint} disabled={hintLoading}>
                {t(hintLoading ? 'translation.ai.hintLoading' : 'translation.ai.getHint')}
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  )
}

function HintBox({ hint }: { hint: AiHint }) {
  return (
    <section className="rounded-xl border border-line bg-paper p-4">
      <p className="text-sm font-medium text-ink-muted">{t('translation.ai.hint')}</p>
      <p className="mt-1">{hint.hint}</p>
      {hint.memoryTip !== '' && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-sm font-medium text-ink-muted">{t('translation.ai.memoryTip')}</p>
          <p className="mt-1 text-sm">{hint.memoryTip}</p>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-muted">{t('translation.ai.poweredBy')}</p>
    </section>
  )
}

type AiGradingProps = {
  grade?: AiGrade
  loading: boolean
  error: boolean
  planError: boolean
  manual: boolean
  onManual: () => void
  onAnswer: (correct: boolean) => void
}

/** The AI verdict, feedback and memory tip; the user can still mark it themselves. */
function AiGrading({ grade, loading, error, planError, manual, onManual, onAnswer }: AiGradingProps) {
  if (manual) return <ManualGradeButtons onAnswer={onAnswer} />

  if (loading) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="status" className="text-sm text-ink-muted">
          {t('translation.ai.grading')}
        </p>
        <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={onManual}>
          {t('translation.ai.manual')}
        </Button>
      </div>
    )
  }

  if (planError || error) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-danger">
          {t(planError ? 'translation.ai.planError' : 'translation.ai.gradeError')}
        </p>
        <ManualGradeButtons onAnswer={onAnswer} />
      </div>
    )
  }

  if (!grade) return <ManualGradeButtons onAnswer={onAnswer} />

  return (
    <section className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`font-medium ${VERDICT_CLASSES[grade.verdict]}`}>
          {t(VERDICT_LABELS[grade.verdict])}
        </p>
        <span className="text-xs text-ink-muted">{t('translation.ai.poweredBy')}</span>
      </div>
      <p className="mt-2">{grade.feedback}</p>
      {grade.memoryTip !== '' && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-sm font-medium text-ink-muted">{t('translation.ai.memoryTip')}</p>
          <p className="mt-1 text-sm">{grade.memoryTip}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => onAnswer(grade.verdict === 'correct')}>{t('practice.continue')}</Button>
        <Button variant="secondary" onClick={onManual}>
          {t('translation.ai.manual')}
        </Button>
      </div>
    </section>
  )
}

function ManualGradeButtons({ onAnswer }: { onAnswer: (correct: boolean) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Button onClick={() => onAnswer(true)}>{t('translation.correct')}</Button>
      <Button variant="secondary" onClick={() => onAnswer(false)}>
        {t('translation.incorrect')}
      </Button>
    </div>
  )
}

/** The sentence's words with pinyin and meaning, to review after translating. */
function WordBreakdown({ words }: { words: readonly SentenceWord[] }) {
  const unique = new Map<string, SentenceWord>()
  for (const word of words) {
    if (!unique.has(word.id)) unique.set(word.id, word)
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-ink-muted">{t('translation.words')}</h3>
      <ul className="flex flex-col gap-2">
        {[...unique.values()].map((word) => (
          <li key={word.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <ToneHanzi entry={word.word} className="text-xl" />
            <PinyinText pinyin={word.word.pinyin} className="text-sm text-accent-strong" />
            <span className="text-sm text-ink-muted">{getMeanings(word.word.meanings)[0]}</span>
            <AudioButton
              item={{ kind: 'word', entry: word.word }}
              className="ml-auto size-8"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
