import { Button } from '../../../components/ui/Button.tsx'
import { ButtonLink } from '../../../components/ui/ButtonLink.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { t } from '../../../i18n/index.ts'
import { formatPinyin, getMeanings } from '../../dictionary/dictionary.ts'
import type { StudyItem } from '../../dictionary/studyItem.ts'
import type { SessionSummary as Summary } from '../session.ts'
import { PinyinText } from '../../dictionary/components/PinyinText.tsx'
import { ToneHanzi } from '../../dictionary/components/ToneHanzi.tsx'
import { AudioButton } from '../../audio/AudioButton.tsx'
import { SentenceText } from '../../translation/components/SentenceText.tsx'
import type { BuiltSentence } from '../../translation/types.ts'
import { BackButton } from './BackButton.tsx'

type SessionSummaryProps = {
  summary: Summary
  /** Items the user did not know, to review them at a glance. */
  missedItems: readonly StudyItem[]
  /** Sentences the user did not translate correctly, with their translation. */
  missedSentences?: readonly BuiltSentence[]
  onRestart: () => void
  /** Goes back to the last card, undoing its answer. */
  onBack?: () => void
}

export function SessionSummary({
  summary,
  missedItems,
  missedSentences = [],
  onRestart,
  onBack,
}: SessionSummaryProps) {
  return (
    <Card className="mx-auto flex max-w-xl flex-col gap-4 sm:gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{t('practice.summary.title')}</h2>
        <p className="mt-2 text-lg text-ink-muted">
          {t('practice.summary.score', { correct: summary.correct, total: summary.total })}
        </p>
      </div>

      {missedItems.length > 0 && (
        <section>
          <h3 className="mb-3 font-medium">{t('practice.summary.toReview')}</h3>
          <ul className="divide-y divide-line">
            {missedItems.map((item) => (
              <li key={`${item.kind}:${item.entry.id}`} className="flex items-baseline gap-4 py-2">
                <ToneHanzi entry={item.entry} className="text-2xl" />
                <PinyinText pinyin={formatPinyin(item.entry)} className="text-accent-strong" />
                <span className="text-ink-muted">{getMeanings(item.entry.meanings)[0]}</span>
                <AudioButton item={item} className="ml-auto" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {missedSentences.length > 0 && (
        <section>
          <h3 className="mb-3 font-medium">{t('practice.summary.sentencesToReview')}</h3>
          <ul className="divide-y divide-line">
            {missedSentences.map((sentence) => (
              <li key={sentence.id} className="flex flex-col gap-1 py-3">
                <SentenceText sentence={sentence} className="text-2xl" />
                <p className="text-ink-muted">{sentence.english}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {missedItems.length === 0 && missedSentences.length === 0 && (
        <p className="text-center text-success">{t('practice.summary.allKnown')}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ButtonLink to="/" variant="secondary">
          {t('notFound.backHome')}
        </ButtonLink>
        <Button onClick={onRestart}>{t('practice.again')}</Button>
        {onBack && <BackButton onBack={onBack} className="sm:col-span-2" />}
      </div>
    </Card>
  )
}
