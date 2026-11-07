import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExampleSentence } from '../dictionary/types.ts'
import { SentenceAudioButton } from './SentenceAudioButton.tsx'

const sentence: ExampleSentence = {
  tatoebaId: 8934441,
  zh: '柠檬很酸。',
  author: 'iiujik',
  en: 'Lemon is sour.',
  translationTatoebaId: 29487,
  words: ['柠檬'],
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'speechSynthesis')
})

describe('SentenceAudioButton', () => {
  it('plays the bundled Tatoeba recording', async () => {
    const user = userEvent.setup()
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const { container } = render(
      <SentenceAudioButton
        sentence={{
          ...sentence,
          audio: { tatoebaAudioId: 988876, author: 'GlossaMatik', license: 'CC BY-NC 4.0' },
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Play sentence: 柠檬很酸。' }))

    expect(play).toHaveBeenCalled()
    expect((container.querySelector('audio') as HTMLAudioElement).src).toContain(
      'audio/sentences/tatoeba-988876.mp3',
    )
  })

  it('renders nothing when there is no recording and no speech synthesis', () => {
    const { container } = render(<SentenceAudioButton sentence={sentence} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('reads the sentence with the browser voice when there is no recording', async () => {
    const user = userEvent.setup()
    const speak = vi.fn()
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel: vi.fn(), speak },
    })
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        text: string
        lang = ''
        rate = 1
        onend: (() => void) | undefined
        onerror: (() => void) | undefined
        constructor(text: string) {
          this.text = text
        }
      },
    )
    render(<SentenceAudioButton sentence={sentence} />)

    await user.click(await screen.findByRole('button', { name: 'Play sentence: 柠檬很酸。' }))

    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak.mock.calls[0]![0]).toMatchObject({ text: '柠檬很酸。', lang: 'zh-CN', rate: 0.9 })
  })
})
