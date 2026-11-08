import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card.tsx'
import { PageHeader } from '../../components/ui/PageHeader.tsx'
import { t } from '../../i18n/index.ts'
import { useRuntimeSources } from '../../features/dictionary/runtime/runtimeSourcesContext.ts'
import { SentenceSetCard } from '../../features/sentences/components/SentenceSetCard.tsx'
import { createSentenceSets, loadSentenceManifest } from '../../features/sentences/sentenceSets.ts'
import type { SentenceSetInfo } from '../../features/sentences/types.ts'

/** The four HSK sentence sets. The manifest only has counts and ids; texts load in the set. */
export function SentencesPage() {
  const { fetchFn } = useRuntimeSources()
  const [sets, setSets] = useState<readonly SentenceSetInfo[]>()
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    loadSentenceManifest(fetchFn).then(
      (manifest) => {
        if (active) setSets(createSentenceSets(manifest))
      },
      () => {
        if (active) setError(true)
      },
    )
    return () => {
      active = false
    }
  }, [fetchFn])

  return (
    <>
      <PageHeader title={t('study.sentences')} description={t('sets.sentences.intro')} />
      {error ? (
        <Card>
          <p className="text-ink-muted">{t('sentences.loadError')}</p>
        </Card>
      ) : sets === undefined ? (
        <Card>
          <p className="text-ink-muted">{t('sentences.loading')}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {sets.map((set) => (
            <li key={set.id} className="flex">
              <div className="flex-1">
                <SentenceSetCard set={set} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
