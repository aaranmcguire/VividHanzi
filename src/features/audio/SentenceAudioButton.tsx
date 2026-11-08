import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { t } from '../../i18n/index.ts'
import type { ExampleSentence } from '../dictionary/types.ts'
import { sentenceAudioUrl } from './audio.ts'
import { SpeakerIcon } from './AudioButton.tsx'
import { claimAudio, releaseAudio, stopAllAudio } from './playback.ts'

/**
 * Speaker button for an example sentence. Tatoeba has recordings for only a
 * few Chinese sentences, so when there isn't one the browser's Chinese voice
 * reads the sentence instead. Nothing is shown if neither is available.
 */
export function SentenceAudioButton({
  sentence,
  className = '',
  autoPlay = false,
}: {
  sentence: ExampleSentence
  className?: string
  /** Start playing when the card appears (sentence Learn/Study). */
  autoPlay?: boolean
}) {
  // False during prerendering, where speech synthesis doesn't exist.
  const speechAvailable = useSyncExternalStore(
    () => () => {},
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    () => false,
  )

  if (!sentence.audio && !speechAvailable) return null
  return <SentenceAudioButtonInner sentence={sentence} className={className} autoPlay={autoPlay} />
}

function SentenceAudioButtonInner({
  sentence,
  className,
  autoPlay,
}: {
  sentence: ExampleSentence
  className: string
  autoPlay: boolean
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const autoPlayed = useRef(false)
  const playRef = useRef<() => void>(() => {})

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio) {
        if (!audio.paused) audio.pause()
        releaseAudio(audio)
      }
    }
  }, [])

  const play = () => {
    stopAllAudio()
    const audio = audioRef.current
    if (audio) {
      claimAudio(audio)
      audio.currentTime = 0
      void Promise.resolve()
        .then(() => audio.play())
        .then(
          () => setPlaying(true),
          () => setPlaying(false),
        )
      return
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(sentence.zh)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
    utterance.onend = () => setPlaying(false)
    utterance.onerror = () => setPlaying(false)
    setPlaying(true)
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    playRef.current = play
  })

  useEffect(() => {
    if (!autoPlay || autoPlayed.current) return
    autoPlayed.current = true
    const timer = window.setTimeout(() => playRef.current(), 0)
    return () => window.clearTimeout(timer)
  }, [autoPlay])

  const label = t('audio.playSentence', { text: sentence.zh })

  return (
    <>
      <button
        type="button"
        onClick={play}
        aria-label={label}
        title={label}
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:border-accent hover:text-accent-strong ${playing ? 'text-accent-strong' : ''} ${className}`}
      >
        <SpeakerIcon />
      </button>
      {sentence.audio && (
        <audio
          ref={audioRef}
          preload="none"
          src={sentenceAudioUrl(sentence.audio.tatoebaAudioId)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setPlaying(false)}
        />
      )}
    </>
  )
}
