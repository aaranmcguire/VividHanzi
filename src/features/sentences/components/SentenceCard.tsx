import { useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { HanziText } from '../../../components/ui/HanziText.tsx'
import { Kbd } from '../../../components/ui/Kbd.tsx'
import { t } from '../../../i18n/index.ts'
import { SentenceAudioButton } from '../../audio/SentenceAudioButton.tsx'
import type { EntryOpener } from '../../dictionary/components/EntryLink.tsx'
import { ExampleText } from '../../dictionary/components/ExampleSentences.tsx'
import { tatoebaSentenceUrl } from '../../dictionary/examples.ts'
import { useSessionShortcuts } from '../../practice/shortcuts.ts'
import type { SentenceItem } from '../types.ts'

type SentenceCardProps = {
  sentence: SentenceItem
  mode: 'learn' | 'study'
  /** This sentence was missed earlier in the session and is asked again. */
  isRetry?: boolean
  opener: EntryOpener
  onAnswer: (correct: boolean) => void
  /** Learn only: stop offering this sentence. */
  onSkip?: () => void
}

/**
 * Flip card for a whole sentence: the Chinese and its audio are shown first;
 * revealing adds the pinyin, the English translation and the Tatoeba
 * attribution. The user then says whether they understood it.
 */
export function SentenceCard({
  sentence,
  mode,
  isRetry = false,
  opener,
  onAnswer,
  onSkip,
}: SentenceCardProps) {
  const [revealed, setRevealed] = useState(false)
  const reveal = () => setRevealed(true)

  useSessionShortcuts(
    revealed
      ? {
          '1': () => onAnswer(true),
          '2': () => onAnswer(false),
          ...(onSkip && { '3': onSkip }),
        }
      : { ' ': reveal, Enter: reveal },
  )

  return (
    <Card className="flex flex-col gap-4 sm:gap-6">
      {isRetry && <p className="text-center text-sm text-ink-muted">{t('sentences.card.retry')}</p>}
      <p className="text-center text-sm font-medium tracking-wide text-ink-muted uppercase">
        {t(mode === 'learn' ? 'sentences.card.new' : 'sentences.card.review')}
      </p>

      {revealed ? (
        <div className="flex flex-col gap-4">
          <ExampleText chinese={sentence.zh} opener={opener} />
          <p className="text-lg">{sentence.en}</p>
          <div className="flex items-center gap-2">
            <SentenceAudioButton sentence={sentence} />
            <a
              href={tatoebaSentenceUrl(sentence.tatoebaId)}
              className="text-sm text-ink-muted underline underline-offset-2 hover:text-accent-strong"
            >
              {t('dictionary.exampleAttribution', {
                id: sentence.tatoebaId,
                author: sentence.author,
              })}
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={() => onAnswer(true)} aria-keyshortcuts="1">
              {t(mode === 'learn' ? 'sentences.card.understand' : 'sentences.card.understood')}{' '}
              <Kbd>1</Kbd>
            </Button>
            <Button variant="secondary" onClick={() => onAnswer(false)} aria-keyshortcuts="2">
              {t('sentences.card.notYet')} <Kbd>2</Kbd>
            </Button>
            {onSkip && (
              <Button
                variant="secondary"
                onClick={onSkip}
                aria-keyshortcuts="3"
                className="sm:col-span-2"
              >
                {t('sentences.card.skip')} <Kbd>3</Kbd>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <HanziText className="text-3xl leading-relaxed sm:text-4xl">{sentence.zh}</HanziText>
          <SentenceAudioButton sentence={sentence} autoPlay className="size-16 [&_svg]:size-8" />
          <p className="text-sm text-ink-muted">{t('sentences.card.listen')}</p>
          <Button className="w-full sm:w-auto" aria-keyshortcuts="Space" onClick={reveal}>
            {t('sentences.card.showTranslation')} <Kbd>Space</Kbd>
          </Button>
        </div>
      )}
    </Card>
  )
}
