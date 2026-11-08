import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { createFakeFetch, jsonResponse } from '../../test/fakeFetch.ts'
import { testExampleSet } from '../../features/dictionary/testData.ts'
import { SentenceSetPage } from './SentenceSetPage.tsx'

describe('SentenceSetPage', () => {
  it('shows the level progress and its sentences', async () => {
    const fake = createFakeFetch([['/examples/hsk1.json', jsonResponse(testExampleSet)]])
    renderWithProviders(
      <Routes>
        <Route path="/study/sentences/:level" element={<SentenceSetPage />} />
      </Routes>,
      { path: '/study/sentences/1', fetchFn: fake.fetch },
    )

    expect(await screen.findByRole('heading', { name: 'HSK 1 sentences' })).toBeInTheDocument()
    expect(screen.getByText('1 sentence')).toBeInTheDocument()
    expect(screen.getByText('柠檬很酸。')).toBeInTheDocument()
    expect(screen.getByText('Lemon is sour.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute(
      'href',
      '/study/sentences/1/learn',
    )
  })
})
