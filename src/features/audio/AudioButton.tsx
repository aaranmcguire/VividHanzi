import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/index.ts'
import type { StudyItem } from '../dictionary/studyItem.ts'
import { audioSources } from './audio.ts'
import { claimAudio, releaseAudio, stopAllAudio } from './playback.ts'

type AudioButtonProps = {
  item: StudyItem
  className?: string
  /** Start playing when the button appears (listening exercises). */
  autoPlay?: boolean
  /** Accessible label; use one that doesn't reveal the hanzi in listening exercises. */
  label?: string
}

/**
 * Speaker button for a word or character with a recording. A word may be
 * played as one file or as its syllables (还 huán, 北京). The MP3s are only
 * requested on click; they live in public/audio. Nothing is rendered for
 * items without a recording.
 */
export function AudioButton({ item, className = '', autoPlay = false, label }: AudioButtonProps) {
  const sources = audioSources(item)
  if (sources.length === 0) return null
  return <AudioButtonInner item={item} sources={sources} className={className} autoPlay={autoPlay} label={label} />
}

function AudioButtonInner({
  item,
  sources,
  className,
  autoPlay,
  label,
}: AudioButtonProps & { sources: readonly string[] }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const indexRef = useRef(0)
  const switching = useRef(false)
  const autoPlayed = useRef(false)
  const playRef = useRef<() => void>(() => {})
  const [playing, setPlaying] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio) {
        if (!audio.paused) audio.pause()
        releaseAudio(audio)
      }
    }
  }, [])

  const playCurrent = () => {
    const audio = audioRef.current
    const source = sources[indexRef.current]
    if (!audio || !source) {
      setPlaying(false)
      return
    }
    switching.current = true
    audio.src = source
    audio.currentTime = 0
    void Promise.resolve()
      .then(() => audio.play())
      .then(
        () => {
          switching.current = false
          setPlaying(true)
        },
        () => {
          // Autoplay may be blocked; the button stays so the user can press it.
          switching.current = false
          setPlaying(false)
        },
      )
  }

  const play = () => {
    const audio = audioRef.current
    if (!audio) return
    stopAllAudio()
    claimAudio(audio)
    indexRef.current = 0
    setPlaying(true)
    playCurrent()
  }

  // Keep the ref current for the autoplay effect without re-running it on
  // every render.
  useEffect(() => {
    playRef.current = play
  })

  // Listening exercises start the audio by themselves. Browsers may block
  // this until the user has interacted with the page; the button still works.
  useEffect(() => {
    if (!autoPlay || autoPlayed.current) return
    autoPlayed.current = true
    const timer = window.setTimeout(() => playRef.current(), 0)
    return () => window.clearTimeout(timer)
  }, [autoPlay])

  if (unavailable) return null

  const onEnded = () => {
    indexRef.current += 1
    if (indexRef.current >= sources.length) {
      setPlaying(false)
      return
    }
    playCurrent()
  }

  const buttonLabel = label ?? t('audio.play', { hanzi: item.entry.hanzi })

  return (
    <>
      <button
        type="button"
        onClick={play}
        aria-label={buttonLabel}
        title={buttonLabel}
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:border-accent hover:text-accent-strong ${playing ? 'text-accent-strong' : ''} ${className}`}
      >
        <SpeakerIcon />
      </button>
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => {
          if (!switching.current) setPlaying(false)
        }}
        onEnded={onEnded}
        onError={() => {
          setPlaying(false)
          setUnavailable(true)
        }}
      />
    </>
  )
}

export function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}
