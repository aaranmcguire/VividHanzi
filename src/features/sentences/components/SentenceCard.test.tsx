import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { testExampleSet } from '../../dictionary/testData.ts'
import type { SentenceItem } from '../types.ts'
import { SentenceCard } from './SentenceCard.tsx'

const sentence: SentenceItem = {
  ...testExampleSet.sentences[0]!,
  id: 'sentence:8934441',
  hskLevel: 1,
}

afterEach(() => {
  vi.restoreAllMocks()
})

function renderCard(mode: 'learn' | 'study' = 'learn', onAnswer = vi.fn(), onSkip = vi.fn()) {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  renderWithProviders(
    <SentenceCard
      sentence={sentence}
      mode={mode}
      opener={{ getHref: () => '/dictionary' }}
      onAnswer={onAnswer}
      onSkip={mode === 'learn' ? onSkip : undefined}
    />,
  )
  return { onAnswer, onSkip }
}

describe('SentenceCard', () => {
  it('shows the sentence and audio first, then reveals the translation', async () => {
    const user = userEvent.setup()
    renderCard('learn')

    expect(screen.getByText('柠檬很酸。')).toBeInTheDocument()
    expect(screen.queryByText('Lemon is sour.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show translation' }))

    expect(screen.getByText('Lemon is sour.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Tatoeba #8934441/ })).toBeInTheDocument()
  })

  it('grades the card and can skip in Learn', async () => {
    const user = userEvent.setup()
    const { onAnswer, onSkip } = renderCard('learn')

    await user.click(screen.getByRole('button', { name: 'Show translation' }))
    await user.click(screen.getByRole('button', { name: /I understand it/ }))
    expect(onAnswer).toHaveBeenCalledWith(true)

    await user.click(screen.getByRole('button', { name: /Skip/ }))
    expect(onSkip).toHaveBeenCalled()
  })

  it('uses "I understood it" in Study and has no skip', async () => {
    const user = userEvent.setup()
    renderCard('study')

    await user.click(screen.getByRole('button', { name: 'Show translation' }))

    expect(screen.getByRole('button', { name: /I understood it/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Skip/ })).not.toBeInTheDocument()
  })
})
