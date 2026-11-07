import { useEffect, useState } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { HanziText } from '../../../components/ui/HanziText.tsx'
import { SentenceAudioButton } from '../../audio/SentenceAudioButton.tsx'
import { AnnotatedSentence, UncertainNote } from '../../customSets/components/SentenceView.tsx'
import { countUncertain } from '../../customSets/sentences.ts'
import { processSentence } from '../../customSets/sentenceProcessing.ts'
import type { SentenceToken } from '../../customSets/types.ts'
import { t } from '../../../i18n/index.ts'
import { useDictionaryStore, useLoadText } from '../dictionaryContext.ts'
import { EXAMPLES_PAGE_SIZE, INITIAL_EXAMPLES_SHOWN, tatoebaSentenceUrl } from '../examples.ts'
import { loadExamples, type Examples } from '../runtime/dictionaryService.ts'
import { useRuntimeData } from '../runtime/runtimeSourcesContext.ts'
import { segmentSentence } from '../segmentation.ts'
import { resolveReadings } from '../sentenceReadings.ts'
import { useUncertainCounts } from '../useUncertainCounts.ts'
import { getStudyItemId, type StudyItem } from '../studyItem.ts'
import type { EntryOpener } from './EntryLink.tsx'

/**
 * Example sentences from Tatoeba, with their pinyin and each sentence's link
 * and author as its license requires. HSK 1-4 entries use the bundled files;
 * other entries ask the Tatoeba API. The first few are shown, with a button
 * for the rest. If there are no sentences, nothing is shown; if they
 * couldn't be fetched, it says so. Pronunciations that couldn't be determined
 * are counted in one note at the end of the block.
 */
export function ExampleSentences({ item, opener }: { item: StudyItem; opener: EntryOpener }) {
  const itemId = getStudyItemId(item)
  const examples = useRuntimeData<Examples>(itemId, (sources, options) => loadExamples(sources, item, options))
  const uncertain = useUncertainCounts()
  // A new entry starts with the first few sentences again.
  const [shown, setShown] = useState({ itemId, count: INITIAL_EXAMPLES_SHOWN })
  const shownCount = shown.itemId === itemId ? shown.count : INITIAL_EXAMPLES_SHOWN

  if (examples.status === 'unavailable') {
    return (
      <section>
        <h2 className="mb-2 text-lg font-semibold">{t('dictionary.examples')}</h2>
        <p className="text-sm text-ink-muted">{t('dictionary.examplesUnavailable')}</p>
      </section>
    )
  }
  if (examples.status !== 'ready') return null
  const { sentences, license } = examples.data
  const keyOf = (tatoebaId: number) => `${itemId}-${tatoebaId}`
  const visible = sentences.slice(0, shownCount)

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{t('dictionary.examples')}</h2>
      <ul className="flex flex-col gap-4">
        {visible.map((example) => (
          <li key={keyOf(example.tatoebaId)}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <ExampleText
                  chinese={example.zh}
                  opener={opener}
                  onUncertain={(count) => uncertain.report(keyOf(example.tatoebaId), count)}
                />
                <p>{example.en}</p>
              </div>
              <SentenceAudioButton sentence={example} className="mt-1" />
            </div>
            <p className="text-sm text-ink-muted">
              <a
                href={tatoebaSentenceUrl(example.tatoebaId)}
                className="underline underline-offset-2 hover:text-accent-strong"
              >
                {t('dictionary.exampleAttribution', {
                  id: example.tatoebaId,
                  author: example.author,
                })}
              </a>
              {example.audio && (
                <>
                  {' · '}
                  <span>
                    {t('dictionary.exampleAudioAttribution', {
                      author: example.audio.author,
                      license: example.audio.license,
                    })}
                  </span>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
      {shownCount < sentences.length && (
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() =>
            setShown({ itemId, count: Math.min(shownCount + EXAMPLES_PAGE_SIZE, sentences.length) })
          }
        >
          {t('dictionary.showMoreExamples', {
            count: Math.min(EXAMPLES_PAGE_SIZE, sentences.length - shownCount),
          })}
        </Button>
      )}
      <div className="mt-3">
        <UncertainNote count={uncertain.total(visible.map((example) => keyOf(example.tatoebaId)))} />
      </div>
      <p className="mt-3 text-sm text-ink-muted">{t('dictionary.examplesLicense', { license })}</p>
    </section>
  )
}

/**
 * The sentence with its pinyin. The Tatoeba API doesn't give transcriptions, so
 * the same engine as for custom sentences is used (pinyin-pro checked against
 * CC-CEDICT). While the engine loads, or if it fails, only the Chinese is shown.
 *
 * Once the entries it needs from the full dictionary have loaded, the
 * sentence is split into words, each one opens its entry, and the readings
 * the engine wasn't sure of are filled in from those words (see
 * sentenceReadings.ts). What is still uncertain has no tone color, and its
 * count goes to `onUncertain`.
 */
export function ExampleText({
  chinese,
  opener,
  onUncertain,
}: {
  chinese: string
  opener: EntryOpener
  onUncertain?: (count: number) => void
}) {
  const [annotated, setAnnotated] = useState<{ chinese: string; tokens: SentenceToken[] }>()
  useEffect(() => {
    let active = true
    processSentence(chinese).then(
      (tokens) => active && setAnnotated({ chinese, tokens }),
      () => {},
    )
    return () => {
      active = false
    }
  }, [chinese])

  const store = useDictionaryStore()
  // Re-renders as the chunks arrive, with more words to split the sentence with
  const status = useLoadText(chinese)
  let tokens = annotated?.chinese === chinese ? annotated.tokens : undefined
  let words
  if (tokens && status !== 'loading') {
    tokens = resolveReadings(tokens, segmentSentence(chinese, store.wordIndex, readingsOf(tokens)), store.wordIndex)
    // Again with the filled-in readings, which pick among homographs (长 cháng / zhǎng)
    words = segmentSentence(chinese, store.wordIndex, readingsOf(tokens))
  }

  const uncertain = tokens && countUncertain(tokens)
  useEffect(() => {
    if (uncertain !== undefined) onUncertain?.(uncertain)
  }, [uncertain, onUncertain])

  if (tokens) return <AnnotatedSentence tokens={tokens} links={words && { words, opener }} />
  return <HanziText className="text-xl">{chinese}</HanziText>
}

/** The reading of each character (undefined if uncertain), to pick among homographs. */
function readingsOf(tokens: readonly SentenceToken[]): (string | undefined)[] {
  return tokens.flatMap((token) => Array.from(token.text, () => (token.uncertain ? undefined : token.pinyin)))
}
