import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { Kbd } from '../../../components/ui/Kbd.tsx'
import { t } from '../../../i18n/index.ts'
import { AudioButton } from '../../audio/AudioButton.tsx'
import { formatPinyin, getMeanings, type Dictionary } from '../../dictionary/dictionary.ts'
import { PinyinText } from '../../dictionary/components/PinyinText.tsx'
import { ToneHanzi } from '../../dictionary/components/ToneHanzi.tsx'
import type { StudyItem } from '../../dictionary/studyItem.ts'
import { useSessionShortcuts } from '../shortcuts.ts'
import type { ListeningTranslateExercise } from '../types.ts'
import { LookUpButtons } from './LookUpButtons.tsx'

type ListeningTranslateQuestionProps = {
  exercise: ListeningTranslateExercise
  dictionary: Dictionary
  onAnswer: (correct: boolean) => void
  onLookUp: (item: StudyItem) => void
}

/**
 * Hear a word or character and type its English meaning. The hanzi stays
 * hidden until the answer is checked, so the audio is the only clue. After
 * checking, the reference meanings are shown and the user says whether their
 * translation matched; there can be several valid translations, so the app
 * doesn't grade the wording itself.
 */
export function ListeningTranslateQuestion({
  exercise,
  dictionary,
  onAnswer,
  onLookUp,
}: ListeningTranslateQuestionProps) {
  const { item } = exercise
  const [answer, setAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const hasAnswer = answer.trim() !== ''
  const check = () => {
    if (hasAnswer) setChecked(true)
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (checked) feedbackRef.current?.focus()
  }, [checked])

  useSessionShortcuts(checked ? { '1': () => onAnswer(true), '2': () => onAnswer(false) } : {})

  return (
    <Card className="flex flex-col gap-4 sm:gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium tracking-wide text-ink-muted uppercase">
          {t(item.kind === 'character' ? 'practice.kind.character' : 'practice.kind.word')}
        </p>
        <AudioButton
          item={item}
          autoPlay
          label={t('audio.playListening')}
          className="size-16 [&_svg]:size-8"
        />
        <h2 className="text-lg text-ink-muted">{t('practice.listening.translateQuestion')}</h2>
        <p className="text-sm text-ink-muted">{t('practice.listening.replayHint')}</p>
      </div>

      {checked ? (
        <div
          ref={feedbackRef}
          role="group"
          tabIndex={-1}
          aria-label={t('practice.answer')}
          className="flex flex-col gap-4 outline-none"
        >
          <div className="rounded-xl bg-paper p-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <ToneHanzi entry={item.entry} className="text-4xl" />
              <AudioButton item={item} />
            </div>
            <p className="mt-1 text-accent-strong">
              <PinyinText pinyin={formatPinyin(item.entry)} />
            </p>
            <ul className="mt-2 space-y-1 text-lg">
              {getMeanings(item.entry.meanings).map((meaning) => (
                <li key={meaning}>{meaning}</li>
              ))}
            </ul>
            {hasAnswer && (
              <p className="mt-3 text-sm text-ink-muted">
                {t('practice.listening.yourAnswer', { answer: answer.trim() })}
              </p>
            )}
          </div>

          <LookUpButtons item={item} dictionary={dictionary} onLookUp={onLookUp} />

          <fieldset className="w-full">
            <legend className="mb-3 w-full text-center text-ink-muted">
              {t('practice.listening.didYouGetIt')}
            </legend>
            <div className="grid w-full grid-cols-2 gap-3">
              <Button onClick={() => onAnswer(true)} aria-keyshortcuts="1">
                {t('practice.listening.correct')} <Kbd>1</Kbd>
              </Button>
              <Button variant="secondary" onClick={() => onAnswer(false)} aria-keyshortcuts="2">
                {t('practice.listening.incorrect')} <Kbd>2</Kbd>
              </Button>
            </div>
          </fieldset>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            check()
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor={inputId} className="font-medium">
            {t('practice.listening.typeMeaning')}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            maxLength={120}
            lang="en"
            autoComplete="off"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!hasAnswer}>
              {t('practice.listening.check')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setChecked(true)}>
              {t('practice.showAnswer')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
