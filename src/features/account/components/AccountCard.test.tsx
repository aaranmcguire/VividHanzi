import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AccountContext, type AccountContextValue } from '../accountContext.ts'
import { AccountCard } from './AccountCard.tsx'

function renderCard(overrides: Partial<AccountContextValue> = {}) {
  const value: AccountContextValue = {
    enabled: true,
    loading: false,
    user: null,
    syncStatus: 'idle',
    provider: 'supabase',
    signInWithGoogle: vi.fn(() => Promise.resolve()),
    sendEmailLink: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
  render(
    <AccountContext value={value}>
      <AccountCard />
    </AccountContext>,
  )
  return value
}

describe('AccountCard', () => {
  it('is hidden when accounts are not configured', () => {
    renderCard({ enabled: false })
    expect(screen.queryByRole('heading', { name: 'Account' })).not.toBeInTheDocument()
  })

  it('signed out, offers Google or an email link', async () => {
    const user = userEvent.setup()
    const account = renderCard()

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(account.signInWithGoogle).toHaveBeenCalled()

    await user.type(screen.getByLabelText('Or get a sign-in link by email'), 'arnau@example.com')
    await user.click(screen.getByRole('button', { name: 'Send link' }))
    expect(account.sendEmailLink).toHaveBeenCalledWith('arnau@example.com')
    expect(await screen.findByText('Check your email and open the link in this browser.')).toBeInTheDocument()
  })

  it('shows D1 cloud sync for an anonymous device', () => {
    renderCard({
      provider: 'anonymous',
      user: { id: 'u1', email: null },
      syncStatus: 'synced',
    })

    expect(screen.getByRole('heading', { name: 'Cloud sync' })).toBeInTheDocument()
    expect(screen.getByText(/Cloudflare D1/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Your progress is synced.')
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('shows a Cloudflare Access account and can sign out', async () => {
    const user = userEvent.setup()
    const account = renderCard({
      provider: 'cloudflare-access',
      user: { id: 'u1', email: 'arnau@example.com' },
      syncStatus: 'synced',
    })

    expect(screen.getByRole('heading', { name: 'Cloud sync' })).toBeInTheDocument()
    expect(screen.getByText('Signed in as arnau@example.com.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(account.signOut).toHaveBeenCalled()
  })

  it('signed in, shows the account and sync state and can sign out', async () => {
    const user = userEvent.setup()
    const account = renderCard({ user: { id: 'u1', email: 'arnau@example.com' }, syncStatus: 'synced' })

    expect(screen.getByText('Signed in as arnau@example.com.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Your progress is synced.')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(account.signOut).toHaveBeenCalled()
  })
})
