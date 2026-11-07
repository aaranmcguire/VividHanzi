import { AUDIO_HANZI } from '../../data/audio.ts'
import type { StudyItem } from '../dictionary/studyItem.ts'

/**
 * Is there a recording for this item? audio-cmn has one file per hanzi, so
 * characters with several readings (了, 还) and the few homograph words are
 * left out rather than playing the wrong reading.
 */
export function hasAudio(item: StudyItem): boolean {
  if (!AUDIO_HANZI.has(item.entry.hanzi)) return false
  if (item.kind === 'character' && item.entry.pinyin.length > 1) return false
  return true
}

/** Static file in public/audio, copied from audio-cmn's 24k-abr/hsk. */
export function audioUrl(hanzi: string): string {
  return `${import.meta.env.BASE_URL}audio/cmn-${encodeURIComponent(hanzi)}.mp3`
}
