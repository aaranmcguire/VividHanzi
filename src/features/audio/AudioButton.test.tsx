import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hskWordItems } from '../dictionary/hskDictionary.ts'
import { AudioButton } from './AudioButton.tsx'

const thanks = hskWordItems.find((item) => item.entry.hanzi === '谢谢')!
const beijing = hskWordItems.find((item) => item.entry.hanzi === '北京')!

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AudioButton', () => {
  it('plays the recording for a word with audio', async () => {
    const user = userEvent.setup()
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const { container } = render(<AudioButton item={thanks} />)

    await user.click(screen.getByRole('button', { name: 'Play pronunciation of 谢谢' }))

    expect(play).toHaveBeenCalled()
    expect(container.querySelector('audio')?.getAttribute('src')).toContain(
      'audio/cmn-%E8%B0%A2%E8%B0%A2.mp3',
    )
  })

  it('renders nothing when the word has no recording', () => {
    const { container } = render(<AudioButton item={beijing} />)

    expect(container).toBeEmptyDOMElement()
  })
})
