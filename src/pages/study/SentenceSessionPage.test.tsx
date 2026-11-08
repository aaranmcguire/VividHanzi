import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { createFakeFetch, jsonResponse } from '../../test/fakeFetch.ts'
import { testExampleSet } from '../../features/dictionary/testData.ts'
import { SentenceSessionPage } from './SentenceSessionPage.tsx'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SentenceSessionPage', () => {
  it('starts a Learn session for the level', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const fake = createFakeFetch([['/examples/hsk1.json', jsonResponse(testExampleSet)]])
    renderWithProviders(
      <Routes>
        <Route path="/study/sentences/:level/learn" element={<SentenceSessionPage mode="learn" />} />
      </Routes>,
      { path: '/study/sentences/1/learn', fetchFn: fake.fetch },
    )

    expect(await screen.findByText('New sentence')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show translation' })).toBeInTheDocument()
    expect(screen.getByText('柠檬很酸。')).toBeInTheDocument()
  })
})
