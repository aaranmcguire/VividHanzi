import { describe, expect, it, vi } from 'vitest'
import { getExamplesFor, loadExampleSet, tatoebaSentenceUrl } from './examples.ts'
import { ningCharacter, ningmengWord, testCharacters, testExampleSet } from './testData.ts'

describe('example sentences', () => {
  it('loads the level file from public/examples', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(testExampleSet)))
    await expect(loadExampleSet(1, fetchMock)).resolves.toEqual(testExampleSet)
    expect(fetchMock).toHaveBeenCalledWith('/examples/hsk1.json')
  })

  it('fails if the file does not exist', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }))
    await expect(loadExampleSet(1, fetchMock)).rejects.toThrow(/HSK 1/)
  })

  it('gives a word\'s sentences and those of the words containing a character', () => {
    expect(getExamplesFor(testExampleSet, { kind: 'word', entry: ningmengWord })).toHaveLength(1)
    expect(getExamplesFor(testExampleSet, { kind: 'character', entry: ningCharacter })).toHaveLength(1)
    expect(getExamplesFor(testExampleSet, { kind: 'character', entry: testCharacters[0]! })).toEqual([])
  })

  it('returns many sentences for a word, up to the display limit', () => {
    const set = {
      ...testExampleSet,
      sentences: Array.from({ length: 25 }, (_, index) => ({
        ...testExampleSet.sentences[0]!,
        tatoebaId: 100 + index,
        zh: `柠檬很酸${index}。`,
        ...(index === 0 && {
          audio: { tatoebaAudioId: 988876, author: 'GlossaMatik', license: 'CC BY-NC 4.0' },
        }),
      })),
    }
    const examples = getExamplesFor(set, { kind: 'word', entry: ningmengWord })
    expect(examples).toHaveLength(20)
    expect(examples[0]?.audio?.tatoebaAudioId).toBe(988876)
  })

  it('links each sentence to its Tatoeba page', () => {
    expect(tatoebaSentenceUrl(8934441)).toBe('https://tatoeba.org/en/sentences/show/8934441')
  })
})
