import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StudyItem } from '../../dictionary/studyItem.ts'
import type { Character } from '../../dictionary/types.ts'
import type { ChoiceExercise, ChoiceExerciseType } from '../types.ts'
import { createDictionary } from '../../dictionary/dictionary.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ChoiceQuestion } from './ChoiceQuestion.tsx'

function character(hanzi: string, pinyin: string, meaning: string): StudyItem {
  return { kind: 'character', entry: { id: hanzi, hanzi, pinyin: [pinyin], meanings: { en: [meaning] }, hskLevel: 1 } }
}

const [one, two, three, four] = [
  character('一', 'yī', 'one'),
  character('二', 'èr', 'two'),
  character('三', 'sān', 'three'),
  character('四', 'sì', 'four'),
] as const

function exerciseOf(type: ChoiceExerciseType): ChoiceExercise {
  return { type, item: two, options: [one, two, three, four] }
}

function renderQuestion(type: ChoiceExerciseType, onAnswer = vi.fn()) {
  const dictionary = createDictionary([one, two, three, four].map((item) => item.entry as Character), [])
  renderWithProviders(
    <ChoiceQuestion exercise={exerciseOf(type)} dictionary={dictionary} onAnswer={onAnswer} onLookUp={() => {}} />,
  )
  return onAnswer
}

function getOptions() {
  return within(screen.getByRole('list', { name: 'Options' })).getAllByRole('button')
}

/** An option's text without its keyboard shortcut hint. */
function optionText(option: HTMLElement) {
  return option.textContent.replace(option.querySelector('kbd')?.textContent ?? '', '')
}

describe('ChoiceQuestion', () => {
  it('meaning-choice: shows the hanzi and the meanings as options', () => {
    renderQuestion('meaning-choice')

    expect(screen.getByText('二')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What does it mean?' })).toBeInTheDocument()
    expect(getOptions().map(optionText)).toEqual(['one', 'two', 'three', 'four'])
  })

  it('pinyin-choice: the options are pinyin', () => {
    renderQuestion('pinyin-choice')

    expect(screen.getByRole('heading', { name: 'How is it pronounced?' })).toBeInTheDocument()
    expect(getOptions().map(optionText)).toEqual(['yī', 'èr', 'sān', 'sì'])
  })

  it('hanzi-choice: shows the meaning and the hanzi as options', () => {
    renderQuestion('hanzi-choice')

    expect(screen.getByText('two')).toBeInTheDocument()
    // The hanzi only appears in the options, not in the question
    expect(screen.getAllByText('二')).toHaveLength(1)
    expect(getOptions().map(optionText)).toEqual(['一', '二', '三', '四'])
  })

  it('on a correct answer says so, marks the option and "Continue" answers true', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion('meaning-choice')

    await user.click(screen.getByRole('button', { name: 'two' }))

    // Focus moves to "Continue", which carries the feedback as its description
    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(continueButton).toHaveFocus()
    expect(continueButton).toHaveAccessibleDescription('Correct! 二 èr two')
    expect(screen.getByRole('button', { name: 'two (correct answer)' })).toBeDisabled()
    expect(onAnswer).not.toHaveBeenCalled()

    await user.keyboard('{Enter}')
    expect(onAnswer).toHaveBeenCalledWith(true)
  })

  it('offers pronunciation in the answer feedback', async () => {
    const user = userEvent.setup()
    renderQuestion('meaning-choice')

    await user.click(screen.getByRole('button', { name: 'two' }))

    expect(screen.getByRole('button', { name: 'Play pronunciation of 二' })).toBeInTheDocument()
  })

  it('on a wrong answer marks the picked and the correct one, and "Continue" answers false', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion('meaning-choice')

    await user.click(screen.getByRole('button', { name: 'four' }))

    expect(screen.getByText('Not quite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'four (your answer)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'two (correct answer)' })).toBeInTheDocument()
    // The answer cannot be changed
    expect(getOptions().every((option) => option.hasAttribute('disabled'))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onAnswer).toHaveBeenCalledWith(false)
  })

  it('keys 1-4 pick an option and Enter continues', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion('meaning-choice')

    await user.keyboard('2')
    expect(screen.getByText('Correct!')).toBeInTheDocument()

    // Focus is on "Continue": the browser presses it, and the shortcut doesn't answer twice
    await user.keyboard('{Enter}')
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('Enter continues even if focus is not on "Continue"', async () => {
    const user = userEvent.setup()
    const onAnswer = renderQuestion('meaning-choice')

    await user.keyboard('3')
    ;(document.activeElement as HTMLElement).blur()
    await user.keyboard('{Enter}')
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(false)
  })
})
