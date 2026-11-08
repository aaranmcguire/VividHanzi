import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { createFakeFetch, jsonResponse } from '../../test/fakeFetch.ts'
import { SentencesPage } from './SentencesPage.tsx'

const manifest = {
  source: 'Tatoeba',
  license: 'CC BY 2.0 FR',
  exportDate: '2026-11-07',
  levels: [
    { level: 1, count: 1239, audio: 5, ids: [1, 2] },
    { level: 2, count: 1816, audio: 12, ids: [3] },
    { level: 3, count: 3242, audio: 9, ids: [4] },
    { level: 4, count: 4773, audio: 11, ids: [5] },
  ],
}

describe('SentencesPage', () => {
  it('lists the four HSK sentence sets from the manifest', async () => {
    const fake = createFakeFetch([['/sentences/manifest.json', jsonResponse(manifest)]])
    renderWithProviders(<SentencesPage />, { fetchFn: fake.fetch })

    expect(await screen.findByRole('link', { name: 'HSK 1 sentences' })).toHaveAttribute(
      'href',
      '/study/sentences/1',
    )
    expect(screen.getByRole('link', { name: 'HSK 4 sentences' })).toHaveAttribute(
      'href',
      '/study/sentences/4',
    )
    expect(screen.getByText(/1239 sentences/)).toBeInTheDocument()
    expect(screen.getByText(/5 with Tatoeba audio/)).toBeInTheDocument()
  })
})
