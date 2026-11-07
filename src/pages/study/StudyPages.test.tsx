import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders.tsx'
import { AppRoutes } from '../../app/AppRoutes.tsx'
import { LOCAL_BACKEND } from '../../features/backend/config.ts'
import { topicDefinitions } from '../../data/topics.ts'
import { loadMyStudies } from '../../features/myStudies/storage.ts'
import { createEmptyProgress, introduceItem, recordAnswer } from '../../features/progress/progress.ts'
import { loadProgress, saveProgress } from '../../features/progress/storage.ts'
import type { KeyValueStorage } from '../../lib/storage.ts'
import { memoryStorage } from '../../test/memoryStorage.ts'

function renderAt(path: string, storage: KeyValueStorage = memoryStorage()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders storage={storage} backend={LOCAL_BACKEND}>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
}

function getStudyTabs() {
  return screen.getByRole('navigation', { name: 'Study sections' })
}

describe('Study: HSK and topic sets', () => {
  it('the HSK tab lists levels 1-4 with their size', () => {
    renderAt('/study/hsk')

    for (const [level, words] of [
      [1, 150],
      [2, 149],
      [3, 299],
      [4, 598],
    ]) {
      const card = screen.getByRole('heading', { name: `HSK ${level}` }).closest('article')!
      expect(within(card).getByText(`${words} words`)).toBeInTheDocument()
    }
  })

  it('the Topics tab lists all defined topics', () => {
    renderAt('/study/topics')

    expect(screen.getAllByRole('article')).toHaveLength(topicDefinitions.length)
    expect(screen.getByRole('heading', { name: 'Food & drink' })).toBeInTheDocument()
  })

  it('adding a set shows it in My Studies and removing it takes it out, without losing progress', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/hsk', storage)

    await user.click(screen.getByRole('button', { name: 'Add HSK 2 to My Studies' }))
    expect(screen.getByRole('button', { name: 'Remove HSK 2 from My Studies' })).toBeInTheDocument()
    expect(loadMyStudies(storage).sets.map((set) => set.setId)).toEqual(['hsk-2'])

    await user.click(within(getStudyTabs()).getByRole('link', { name: 'My Studies' }))
    expect(screen.getByRole('link', { name: 'HSK 2' })).toBeInTheDocument()
    // With nothing learned you can only learn: Study does not appear
    expect(screen.getByRole('link', { name: 'Learn HSK 2' })).toHaveAttribute('href', '/study/practice?set=hsk-2&mode=learn')
    expect(screen.queryByRole('link', { name: 'Study HSK 2' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove HSK 2 from My Studies' }))
    expect(screen.getByRole('heading', { name: 'No sets yet' })).toBeInTheDocument()
    expect(loadMyStudies(storage).sets).toEqual([])
  })

  it('the same item counts in every set that contains it', () => {
    const storage = memoryStorage()
    // 苹果 is in HSK 1 and in Food & drink: mastering it once counts in both
    let progress = createEmptyProgress()
    for (let day = 1; day <= 6; day++) {
      progress = recordAnswer(progress, 'word:苹果', true, new Date(2026, 0, day * 10))
    }
    saveProgress(progress, storage)

    renderAt('/study/sets/hsk-1', storage)
    expect(screen.getByText(/· 1 of 150 mastered$/)).toBeInTheDocument()
  })
})

describe('Set page', () => {
  it('shows the progress, the vocabulary linked to the dictionary and the start button', () => {
    renderAt('/study/sets/topic-food')

    expect(screen.getByRole('heading', { level: 1, name: 'Food & drink' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Learn Food & drink' })).toHaveAttribute(
      'href',
      '/study/practice?set=topic-food&mode=learn',
    )
    const vocabulary = screen.getByRole('region', { name: 'Vocabulary' })
    expect(within(vocabulary).getByRole('link', { name: /苹果/ })).toHaveAttribute('href', `/vocabulary/${encodeURIComponent('苹果')}`)
    expect(screen.getByText(/· 0 of 51 mastered$/)).toBeInTheDocument()
  })

  it('marks a word as known from the vocabulary list and can undo it', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/sets/topic-food', storage)
    const vocabulary = screen.getByRole('region', { name: 'Vocabulary' })
    const row = within(vocabulary).getByRole('link', { name: /苹果/ }).closest('li')!

    await user.click(within(row).getByRole('button', { name: 'Mark 苹果 as known' }))

    expect(within(row).getByText('Mastered')).toBeInTheDocument()
    expect(loadProgress(storage).items['word:苹果']).toBeDefined()
    expect(screen.getByText(/· 1 of 51 mastered/)).toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: 'Undo marking 苹果 as known' }))

    expect(within(row).getByText('New')).toBeInTheDocument()
    expect(loadProgress(storage).items['word:苹果']).toBeUndefined()
  })

  it('the Learn and Study actions count using real progress', () => {
    const storage = memoryStorage()
    const now = new Date()
    let progress = createEmptyProgress()
    progress = introduceItem(progress, 'word:苹果', now) // learned: due for review today
    progress = recordAnswer(progress, 'word:米饭', true, now) // learned: up to date
    saveProgress(progress, storage)
    renderAt('/study/sets/topic-food', storage)

    const learn = screen.getByRole('heading', { name: 'Learn' }).closest('section')!
    expect(within(learn).getByText('49 new items to learn')).toBeInTheDocument()
    const study = screen.getByRole('heading', { name: 'Study' }).closest('section')!
    expect(within(study).getByText('1 item ready to review')).toBeInTheDocument()
    expect(within(study).getByRole('link', { name: 'Study Food & drink' })).toHaveAttribute(
      'href',
      '/study/practice?set=topic-food&mode=study',
    )
  })

  it('with nothing learned, Study says so and offers to start learning', () => {
    renderAt('/study/sets/topic-colors')

    const study = screen.getByRole('heading', { name: 'Study' }).closest('section')!
    expect(within(study).getByText("You haven't learned any words from this set yet.")).toBeInTheDocument()
    expect(within(study).getByRole('link', { name: 'Start learning' })).toHaveAttribute(
      'href',
      '/study/practice?set=topic-colors&mode=learn',
    )
  })

  it('with everything learned and up to date, Learn is up to date and Study offers to review anyway', () => {
    const storage = memoryStorage()
    const colors = topicDefinitions.find((topic) => topic.id === 'colors')!
    const progress = colors.words.reduce(
      (result, word) => recordAnswer(result, `word:${word}`, true, new Date()),
      createEmptyProgress(),
    )
    saveProgress(progress, storage)
    renderAt('/study/sets/topic-colors', storage)

    expect(screen.getByText("You're caught up. There are no new words to learn in this set.")).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Learn Colors' })).not.toBeInTheDocument()
    expect(screen.getByText('All learned items are currently up to date.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review learned vocabulary anyway' })).toHaveAttribute(
      'href',
      '/study/practice?set=topic-colors&mode=study&scope=all',
    )
  })

  it('a nonexistent set shows the not found page', () => {
    renderAt('/study/sets/topic-nope')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  })
})
