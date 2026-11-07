import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hskDictionary, hskWordItems } from '../../dictionary/hskDictionary.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import type { ListeningTranslateExercise } from '../types.ts'
import { ListeningTranslateQuestion } from './ListeningTranslateQuestion.tsx'

const thanks = hskWordItems.find((item) => item.entry.hanzi === '谢谢')!
const exercise: ListeningTranslateExercise = { type: 'listening-translate', item: thanks }

afterEach(() => {
  vi.restoreAllMocks()
})

function renderQuestion() {
  const onAnswer = vi.fn()
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  renderWithProviders(
    <ListeningTranslateQuestion
      exercise={exercise}
      dictionary={hskDictionary}
      onAnswer={onAnswer}
      onLookUp={() => {}}
    />,
  )
  return onAnswer
}

describe('ListeningTranslateQuestion', () => {
  it('plays the audio and keeps the hanzi hidden until the answer is checked', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion()

    expect(screen.getByRole('heading', { name: 'Type the meaning you heard.' })).toBeInTheDocument()
    expect(screen.queryByText('谢谢')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play the audio again' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Your answer in English'), 'thanks')
    await user.click(screen.getByRole('button', { name: 'Check' }))

    expect(screen.getByText('谢谢')).toBeInTheDocument()
    expect(screen.getByText('Your answer: thanks')).toBeInTheDocument()
    expect(screen.getByText('Did you get it right?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'I got it right' }))
    expect(onAnswer).toHaveBeenCalledWith(true)
  })

  it('can show the answer without typing and lets the user mark a miss', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion()

    await user.click(screen.getByRole('button', { name: 'Show answer' }))
    expect(screen.getByText('谢谢')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'I missed it' }))
    expect(onAnswer).toHaveBeenCalledWith(false)
  })
})
