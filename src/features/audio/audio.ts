import { AUDIO_HANZI, AUDIO_SYLLABLES } from '../../data/audio.ts'
import { toToneNumbers } from '../../lib/tones.ts'
import type { StudyItem } from '../dictionary/studyItem.ts'

/**
 * Is there a whole-word recording for this item? audio-cmn has one file per
 * hanzi, so characters with several readings (了, 还) and the few homograph
 * words are left out of this direct check; audioSources uses syllables then.
 */
export function hasAudio(item: StudyItem): boolean {
  if (!AUDIO_HANZI.has(item.entry.hanzi)) return false
  if (item.kind === 'character' && item.entry.pinyin.length > 1) return false
  return true
}

/** Static whole-word file in public/audio, copied from audio-cmn's 24k-abr/hsk. */
export function audioUrl(hanzi: string): string {
  return `${import.meta.env.BASE_URL}audio/cmn-${encodeURIComponent(hanzi)}.mp3`
}

/** Static syllable file in public/audio/syllables, from audio-cmn's 24k-abr/syllabs. */
export function syllableUrl(syllable: string): string {
  return `${import.meta.env.BASE_URL}audio/syllables/cmn-${encodeURIComponent(syllable)}.mp3`
}

/** A bundled Tatoeba recording of a sentence (public/audio/sentences). */
export function sentenceAudioUrl(tatoebaAudioId: number): string {
  return `${import.meta.env.BASE_URL}audio/sentences/tatoeba-${tatoebaAudioId}.mp3`
}

/**
 * The recording(s) for an item: the whole word when there is one, otherwise
 * its syllables (还 huán → huan2, 北京 → bei3 jing1). The syllable fallback
 * is skipped if any syllable is missing, so a button never plays a partial
 * word. Characters with several readings are not guessed.
 */
export function audioSources(item: StudyItem): readonly string[] {
  if (hasAudio(item)) return [audioUrl(item.entry.hanzi)]
  if (item.kind === 'character' && item.entry.pinyin.length > 1) return []

  const pinyin = item.kind === 'word' ? item.entry.pinyin : item.entry.pinyin[0]
  if (!pinyin) return []
  const syllables = toToneNumbers(pinyin).trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (syllables.length === 0 || !syllables.every((syllable) => AUDIO_SYLLABLES.has(syllable))) {
    return []
  }
  return syllables.map(syllableUrl)
}
