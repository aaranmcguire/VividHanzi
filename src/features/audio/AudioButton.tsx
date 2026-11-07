import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/index.ts'
import type { StudyItem } from '../dictionary/studyItem.ts'
import { audioSources } from './audio.ts'
import { claimAudio, releaseAudio, stopAllAudio } from './playback.ts'

type AudioButtonProps = {
  item: StudyItem
  className?: string
}

/**
 * Speaker button for a word or character with a recording. A word may be
 * played as one file or as its syllables (还 huán, 北京). The MP3s are only
 * requested on click; they live in public/audio. Nothing is rendered for
 * items without a recording.
 */
export function AudioButton({ item, className = '' }: AudioButtonProps) {
  const sources = audioSources(item)
  if (sources.length === 0) return null
  return <AudioButtonInner item={item} sources={sources} className={className} />
}

function AudioButtonInner({
  item,
  sources,
  className,
}: AudioButtonProps & { sources: readonly string[] }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const indexRef = useRef(0)
  const switching = useRef(false)
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

  if (unavailable) return null

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
    void audio.play().then(
      () => {
        switching.current = false
        setPlaying(true)
      },
      () => {
        switching.current = false
        setUnavailable(true)
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

  const onEnded = () => {
    indexRef.current += 1
    if (indexRef.current >= sources.length) {
      setPlaying(false)
      return
    }
    playCurrent()
  }

  const label = t('audio.play', { hanzi: item.entry.hanzi })

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
