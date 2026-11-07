/**
 * One recording plays at a time, whether it is a word from audio-cmn, a
 * Tatoeba sentence or the browser's speech synthesis.
 */

let currentAudio: HTMLAudioElement | undefined

/** Stops whatever is playing: an audio file or speech synthesis. */
export function stopAllAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = undefined
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

/** Makes `audio` the only playing file, pausing the previous one. */
export function claimAudio(audio: HTMLAudioElement) {
  if (currentAudio && currentAudio !== audio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
  }
  currentAudio = audio
}

/** Forgets `audio` if it is the current one (used when its button unmounts). */
export function releaseAudio(audio: HTMLAudioElement) {
  if (currentAudio === audio) currentAudio = undefined
}
