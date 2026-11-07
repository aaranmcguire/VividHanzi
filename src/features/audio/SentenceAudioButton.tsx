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
}: {
  sentence: ExampleSentence
  className?: string
}) {
  // False during prerendering, where speech synthesis doesn't exist.
  const speechAvailable = useSyncExternalStore(
    () => () => {},
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    () => false,
  )

  if (!sentence.audio && !speechAvailable) return null
  return <SentenceAudioButtonInner sentence={sentence} className={className} />
}

function SentenceAudioButtonInner({
  sentence,
  className,
}: {
  sentence: ExampleSentence
  className: string
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

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
      void audio.play().then(
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
