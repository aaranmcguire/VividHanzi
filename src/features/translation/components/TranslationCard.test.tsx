import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { hskWordItems } from '../../dictionary/hskDictionary.ts'
import { getStudyItemId } from '../../dictionary/studyItem.ts'
import { applyHskLevel, createEmptyProgress } from '../../progress/progress.ts'
import { seededRandom } from '../../../test/random.ts'
import { createFakeFetch, jsonResponse } from '../../../test/fakeFetch.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { createSentenceSession } from '../sentenceBuilder.ts'
import { TranslationCard } from './TranslationCard.tsx'

function sentenceForTest() {
  const progress = applyHskLevel(
    createEmptyProgress(),
    hskWordItems.flatMap((item) =>
      item.entry.hskLevel === undefined
        ? []
        : [{ itemId: getStudyItemId(item), hskLevel: item.entry.hskLevel }],
    ),
    1,
    new Date(),
  )
  const [sentence] = createSentenceSession(progress, {
    size: 1,
    level: 1,
    random: seededRandom(1),
  })
  return sentence!
}

describe('TranslationCard with Workers AI', () => {
  it('shows a hint, grades the answer and reports the verdict', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    const fake = createFakeFetch([
      [
        '/api/ai/hint',
        jsonResponse({ hint: 'Start with the subject.', memoryTip: '我 is the speaker.' }),
      ],
      [
        '/api/ai/grade',
        jsonResponse({ verdict: 'correct', feedback: 'Nice work.', memoryTip: '猫 is a cat.' }),
      ],
    ])
    renderWithProviders(
      <TranslationCard
        sentence={sentenceForTest()}
        aiAvailable
        fetchFn={fake.fetch}
        onAnswer={onAnswer}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Get a hint' }))
    expect(await screen.findByText('Start with the subject.')).toBeInTheDocument()
    expect(screen.getByText('我 is the speaker.')).toBeInTheDocument()

    await user.type(
      screen.getByRole('textbox', { name: 'Your translation (in English)' }),
      'I like cats.',
    )
    await user.click(screen.getByRole('button', { name: 'Check' }))

    expect(await screen.findByText('AI: Correct')).toBeInTheDocument()
    expect(screen.getByText('Nice work.')).toBeInTheDocument()
    expect(screen.getByText('猫 is a cat.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onAnswer).toHaveBeenCalledWith(true)
  })

  it('falls back to self-grading when the model needs a paid plan', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    const fake = createFakeFetch([
      [
        '/api/ai/grade',
        jsonResponse({ error: 'Workers AI is unavailable', code: 'plan' }, { status: 502 }),
      ],
    ])
    renderWithProviders(
      <TranslationCard
        sentence={sentenceForTest()}
        aiAvailable
        fetchFn={fake.fetch}
        onAnswer={onAnswer}
      />,
    )

    await user.type(
      screen.getByRole('textbox', { name: 'Your translation (in English)' }),
      'I like cats.',
    )
    await user.click(screen.getByRole('button', { name: 'Check' }))

    expect(await screen.findByText(/needs a paid Workers plan/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'I got it right' }))
    expect(onAnswer).toHaveBeenCalledWith(true)
  })
})
