import { ToneHanzi } from '../../dictionary/components/ToneHanzi.tsx'
import type { BuiltSentence } from '../types.ts'

type SentenceTextProps = {
  sentence: BuiltSentence
  /** Show the pinyin above each word. */
  showPinyin?: boolean
  className?: string
}

/**
 * The Chinese sentence, word by word: each word keeps its tone colors and
 * can show its pinyin above it (ruby). Punctuation is plain text.
 */
export function SentenceText({ sentence, showPinyin = false, className = '' }: SentenceTextProps) {
  return (
    <p lang="zh-Hans" className={`font-hanzi ${className}`}>
      {sentence.parts.map((part, index) =>
        part.word ? (
          <ruby key={index}>
            <ToneHanzi entry={part.word.word} />
            {showPinyin && (
              <rt className="font-sans text-[0.4em] text-accent-strong">{part.word.word.pinyin}</rt>
            )}
          </ruby>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  )
}
