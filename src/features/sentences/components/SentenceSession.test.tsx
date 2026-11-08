import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryStorage } from '../../../test/memoryStorage.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { testExampleSet } from '../../dictionary/testData.ts'
import { createEmptyProgress, introduceSentence } from '../../progress/progress.ts'
import { loadProgress, saveProgress } from '../../progress/storage.ts'
import type { SentenceItem } from '../types.ts'
import { SentenceSession } from './SentenceSession.tsx'

const sentence: SentenceItem = {
  ...testExampleSet.sentences[0]!,
  id: 'sentence:8934441',
  hskLevel: 1,
}

afterEach(() => {
  vi.restoreAllMocks()
})

function mockAudio() {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
}

describe('SentenceSession', () => {
  it('learns a sentence and saves its progress', async () => {
    mockAudio()
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderWithProviders(
      <SentenceSession items={[sentence]} mode="learn" backPath="/study/sentences/1" />,
      { storage },
    )

    await user.click(screen.getByRole('button', { name: 'Show translation' }))
    await user.click(screen.getByRole('button', { name: /I understand it/ }))

    expect(screen.getByRole('heading', { name: 'Sentences learned' })).toBeInTheDocument()
    expect(loadProgress(storage).sentences['sentence:8934441']).toBeDefined()
  })

  it('reviews a due sentence and counts the answer', async () => {
    mockAudio()
    const user = userEvent.setup()
    const storage = memoryStorage()
    saveProgress(introduceSentence(createEmptyProgress(), 'sentence:8934441', new Date()), storage)
    renderWithProviders(
      <SentenceSession items={[sentence]} mode="study" backPath="/study/sentences/1" />,
      { storage },
    )

    await user.click(screen.getByRole('button', { name: 'Show translation' }))
    await user.click(screen.getByRole('button', { name: /I understood it/ }))

    expect(screen.getByRole('heading', { name: 'Sentences complete' })).toBeInTheDocument()
    expect(loadProgress(storage).sentences['sentence:8934441']).toMatchObject({
      timesSeen: 1,
      timesCorrect: 1,
    })
  })
})
