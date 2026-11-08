import { describe, expect, it } from 'vitest'
import { createFakeFetch, jsonResponse } from '../../test/fakeFetch.ts'
import { testExampleSet } from '../dictionary/testData.ts'
import {
  createSentenceSets,
  getSentenceSessionPath,
  getSentenceSetPath,
  isHskLevel,
  loadSentenceItems,
  loadSentenceManifest,
} from './sentenceSets.ts'
import type { SentenceManifest } from './types.ts'

const manifest: SentenceManifest = {
  source: 'Tatoeba',
  license: 'CC BY 2.0 FR',
  exportDate: '2026-11-07',
  levels: [{ level: 1, count: 1, audio: 0, ids: [8934441] }],
}

describe('sentence sets', () => {
  it('builds the HSK sets from the manifest', () => {
    const [set] = createSentenceSets(manifest)

    expect(set).toMatchObject({
      id: 'sentences-hsk-1',
      level: 1,
      name: 'HSK 1 sentences',
      count: 1,
      audioCount: 0,
    })
    expect(set?.ids).toEqual(['sentence:8934441'])
  })

  it('loads the manifest from public/sentences', async () => {
    const fake = createFakeFetch([['/sentences/manifest.json', jsonResponse(manifest)]])
    await expect(loadSentenceManifest(fake.fetch)).resolves.toEqual(manifest)
    expect(fake.requested).toEqual(['/sentences/manifest.json'])
  })

  it('loads a level with ids and hsk levels, shortest first', async () => {
    const fake = createFakeFetch([['/examples/hsk1.json', jsonResponse(testExampleSet)]])
    const items = await loadSentenceItems(1, fake.fetch)

    expect(items).toEqual([
      {
        ...testExampleSet.sentences[0],
        id: 'sentence:8934441',
        hskLevel: 1,
      },
    ])
  })

  it('validates levels and builds the paths', () => {
    expect(isHskLevel('1')).toBe(true)
    expect(isHskLevel('5')).toBe(false)
    expect(getSentenceSetPath(2)).toBe('/study/sentences/2')
    expect(getSentenceSessionPath(2, 'study')).toBe('/study/sentences/2/study')
    expect(getSentenceSessionPath(2, 'study', true)).toBe('/study/sentences/2/study?scope=all')
  })
})
