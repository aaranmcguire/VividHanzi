import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { LOCAL_BACKEND } from '../features/backend/config.ts'
import { t } from '../i18n/index.ts'
import { memoryStorage } from '../test/memoryStorage.ts'
import { AppProviders } from './AppProviders.tsx'
import { AppRoutes } from './AppRoutes.tsx'
import { NAVIGATION_ITEMS } from './navigation.ts'

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders storage={memoryStorage()} backend={LOCAL_BACKEND}>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
}

function getMainNavigation() {
  return screen.getByRole('navigation', { name: 'Main navigation' })
}

describe('AppRoutes', () => {
  it.each(NAVIGATION_ITEMS)('route $path shows its page', ({ path, labelKey }) => {
    renderAt(path)

    expect(screen.getByRole('heading', { level: 1, name: t(labelKey) })).toBeInTheDocument()
  })

  it('navigates to another section when a link is clicked and marks it as current', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(within(getMainNavigation()).getByRole('link', { name: 'Study' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Study' })).toBeInTheDocument()
    expect(within(getMainNavigation()).getByRole('link', { name: 'Study' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(getMainNavigation()).getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('the home "Start session" button leads to practice', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(screen.getByRole('link', { name: 'Start session' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Practice' })).toBeInTheDocument()
  })

  it('shows an error page on unknown routes', () => {
    renderAt('/no-existe')

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
  })
})
