import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n/index.ts'
import type { StudyItem } from '../dictionary/studyItem.ts'
import { audioUrl, hasAudio } from './audio.ts'

/** Only one recording plays at a time. */
let currentAudio: HTMLAudioElement | undefined

type AudioButtonProps = {
  item: StudyItem
  className?: string
}

/**
 * Speaker button for a word or character with a recording. The MP3 is only
 * requested on click; the files live in public/audio so playback works
 * offline. Nothing is rendered for items without a recording.
 */
export function AudioButton({ item, className = '' }: AudioButtonProps) {
  if (!hasAudio(item)) return null
  return <AudioButtonInner item={item} className={className} />
}

function AudioButtonInner({ item, className }: AudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio && !audio.paused) audio.pause()
    }
  }, [])

  if (unavailable) return null

  const label = t('audio.play', { hanzi: item.entry.hanzi })
  const play = () => {
    const audio = audioRef.current
    if (!audio) return
    if (currentAudio && currentAudio !== audio) {
      if (!currentAudio.paused) currentAudio.pause()
      currentAudio.currentTime = 0
    }
    currentAudio = audio
    audio.currentTime = 0
    void audio.play().then(
      () => setPlaying(true),
      () => setUnavailable(true),
    )
  }

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
        src={audioUrl(item.entry.hanzi)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false)
          setUnavailable(true)
        }}
      />
    </>
  )
}

function SpeakerIcon() {
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
