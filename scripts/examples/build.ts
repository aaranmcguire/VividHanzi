/**
 * Rebuilds the HSK 1-4 example sentence files from the Tatoeba exports,
 * without rebuilding the dictionary. It uses the same selection rules as
 * `scripts/dataset/build.ts` (see sources/tatoeba.ts).
 *
 *   npm run examples:build
 *   npm run examples:build -- --no-audio
 *
 * The exports are downloaded by `npm run data:fetch` into
 * scripts/dataset/.cache/tatoeba. Only recordings with a reusable license
 * are copied, into public/audio/sentences/.
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { grammarPoints } from '../../src/data/grammar.ts'
import { hsk1Characters } from '../../src/data/hsk1/characters.ts'
import { hsk1Words } from '../../src/data/hsk1/words.ts'
import { hsk2Characters } from '../../src/data/hsk2/characters.ts'
import { hsk2Words } from '../../src/data/hsk2/words.ts'
import { hsk3Characters } from '../../src/data/hsk3/characters.ts'
import { hsk3Words } from '../../src/data/hsk3/words.ts'
import { hsk4Characters } from '../../src/data/hsk4/characters.ts'
import { hsk4Words } from '../../src/data/hsk4/words.ts'
import { createWordList } from '../../src/features/dictionary/exampleChoice.ts'
import type { Character, ExampleAudio, ExampleSet, HskLevel, Word } from '../../src/features/dictionary/types.ts'
import { validateExampleSet } from '../../src/features/dictionary/validation.ts'
import { createCedictIndex } from '../dataset/sources/cedict.ts'
import {
  parseAudioLine,
  parseLinkLine,
  parseSentenceLine,
  selectExamples,
  type TatoebaSentence,
} from '../dataset/sources/tatoeba.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const cacheDir = join(root, 'scripts/dataset/.cache')
const tatoebaDir = join(cacheDir, 'tatoeba')
const examplesDir = join(root, 'public/examples')
const sentencesDir = join(root, 'public/sentences')
const audioDir = join(root, 'public/audio/sentences')
const downloadAudio = !process.argv.includes('--no-audio')

const LEVELS: readonly HskLevel[] = [1, 2, 3, 4]
const wordsByLevel: Record<HskLevel, readonly Word[]> = {
  1: hsk1Words,
  2: hsk2Words,
  3: hsk3Words,
  4: hsk4Words,
}
const charactersByLevel: Record<HskLevel, readonly Character[]> = {
  1: hsk1Characters,
  2: hsk2Characters,
  3: hsk3Characters,
  4: hsk4Characters,
}

async function* readLines(path: string): AsyncGenerator<string> {
  yield* createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity })
}

function requireSource(path: string): string {
  if (!existsSync(path)) {
    console.error(`Missing ${path}. Run "npm run data:fetch" first.`)
    process.exit(1)
  }
  return path
}

async function main() {
  const chinese = new Map<number, TatoebaSentence>()
  for await (const line of readLines(requireSource(join(tatoebaDir, 'cmn_sentences_detailed.tsv')))) {
    const sentence = parseSentenceLine(line)
    if (sentence) chinese.set(sentence.id, sentence)
  }

  const translations = new Map<number, number[]>()
  for await (const line of readLines(requireSource(join(tatoebaDir, 'cmn-eng_links.tsv')))) {
    const link = parseLinkLine(line)
    if (!link || !chinese.has(link[0])) continue
    translations.set(link[0], [...(translations.get(link[0]) ?? []), link[1]])
  }

  const audio = new Map<number, ExampleAudio>()
  for await (const line of readLines(requireSource(join(tatoebaDir, 'cmn_sentences_with_audio.tsv')))) {
    const parsed = parseAudioLine(line)
    if (parsed) audio.set(parsed.sentenceId, parsed.audio)
  }

  const wantedEnglish = new Set([...translations.values()].flat())
  const english = new Map<number, TatoebaSentence>()
  for await (const line of readLines(requireSource(join(tatoebaDir, 'eng_sentences_detailed.tsv')))) {
    const sentence = parseSentenceLine(line)
    if (sentence && wantedEnglish.has(sentence.id)) english.set(sentence.id, sentence)
  }

  const exportDate = readFileSync(requireSource(join(tatoebaDir, 'export-date.txt')), 'utf8').trim()
  const cedict = createCedictIndex(readFileSync(requireSource(join(cacheDir, 'cedict.json')), 'utf8'))
  const dictionaryWords = createWordList(cedict.keys())
  const grammarSentences = new Set(grammarPoints.flatMap((point) => point.examples.map((example) => example.tatoebaId)))

  mkdirSync(examplesDir, { recursive: true })
  const knownCharacters = new Set<string>()
  const selected = new Map<HskLevel, ExampleSet>()
  for (const level of LEVELS) {
    for (const character of charactersByLevel[level]) knownCharacters.add(character.hanzi)
    const sentences = selectExamples({
      words: [...new Set(wordsByLevel[level].map((word) => word.hanzi))],
      knownCharacters,
      chinese,
      english,
      translations,
      keep: grammarSentences,
      dictionaryWords,
      audio,
    })
    for (const sentence of sentences) grammarSentences.delete(sentence.tatoebaId)
    const set: ExampleSet = { source: 'Tatoeba', license: 'CC BY 2.0 FR', exportDate, sentences }
    const problems = validateExampleSet(set, wordsByLevel[level])
    if (problems.length > 0) {
      console.error(`HSK ${level} examples are invalid:\n- ${problems.join('\n- ')}`)
      process.exit(1)
    }
    selected.set(level, set)
  }

  // Download every licensed recording we know about, so the files stay
  // available even if a sentence is chosen for a word later.
  const downloaded = new Map<number, string>()
  if (downloadAudio) {
    mkdirSync(audioDir, { recursive: true })
    for (const [sentenceId, recording] of audio) {
      const file = `tatoeba-${recording.tatoebaAudioId}.mp3`
      const path = join(audioDir, file)
      downloaded.set(sentenceId, file)
      if (existsSync(path)) continue
      const response = await fetch(`https://tatoeba.org/en/audio/download/${recording.tatoebaAudioId}`)
      if (!response.ok) {
        console.warn(`Could not download Tatoeba audio ${recording.tatoebaAudioId} (HTTP ${response.status})`)
        downloaded.delete(sentenceId)
        continue
      }
      writeFileSync(path, Buffer.from(await response.arrayBuffer()))
      // Be gentle with Tatoeba's server.
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  // A sentence only advertises audio if its file is actually there.
  for (const set of selected.values()) {
    for (const sentence of set.sentences) {
      if (sentence.audio && downloadAudio && !downloaded.has(sentence.tatoebaId)) delete sentence.audio
      else if (sentence.audio && !downloadAudio && !existsSync(join(audioDir, `tatoeba-${sentence.audio.tatoebaAudioId}.mp3`))) {
        delete sentence.audio
      }
    }
  }

  for (const [level, set] of selected) {
    writeFileSync(join(examplesDir, `hsk${level}.json`), `${JSON.stringify(set, null, 1)}\n`)
    const withAudio = set.sentences.filter((sentence) => sentence.audio).length
    console.log(`HSK ${level}: ${set.sentences.length} sentences, ${withAudio} with Tatoeba audio.`)
  }

  // Small index for the Sentences tab: counts and ids, without the sentence texts.
  mkdirSync(sentencesDir, { recursive: true })
  const manifest = {
    source: 'Tatoeba',
    license: 'CC BY 2.0 FR',
    exportDate,
    levels: [...selected].map(([level, set]) => ({
      level,
      count: set.sentences.length,
      audio: set.sentences.filter((sentence) => sentence.audio).length,
      ids: set.sentences.map((sentence) => sentence.tatoebaId),
    })),
  }
  writeFileSync(join(sentencesDir, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`)

  if (downloaded.size > 0) {
    const lines = [
      'Tatoeba sentence recordings',
      'https://tatoeba.org',
      '',
      'Only recordings whose license allows reuse are included. The license and',
      'recorder of each file are listed below and in public/examples/hsk*.json.',
      '',
    ]
    for (const [sentenceId, file] of [...downloaded].sort((a, b) => a[0] - b[0])) {
      const recording = audio.get(sentenceId)!
      lines.push(
        `${file} — Tatoeba sentence ${sentenceId}, recorded by ${recording.author}, ${recording.license}` +
          (recording.attributionUrl ? ` (${recording.attributionUrl})` : ''),
      )
    }
    writeFileSync(join(audioDir, 'ATTRIBUTION.txt'), `${lines.join('\n')}\n`)
    console.log(`Tatoeba audio: ${downloaded.size} files in public/audio/sentences.`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
