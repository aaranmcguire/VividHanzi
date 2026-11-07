import { createContext, use } from 'react'

export interface AccountUser {
  id: string
  email: string | null
}

/** Where the account/cloud sync comes from. */
export type AccountProviderKind = 'cloudflare-access' | 'supabase' | 'anonymous' | 'local'

/** State of the cloud copy: `idle` when signed out, `error` if the last attempt failed (it retries on its own). */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export interface AccountContextValue {
  /** Cloud sync is configured. Otherwise the app works with local storage only. */
  enabled: boolean
  /** Still loading: we don't know yet whether there is a session. */
  loading: boolean
  user: AccountUser | null
  syncStatus: SyncStatus
  /** Which identity provider is active. */
  provider: AccountProviderKind
  /** Goes to Google's page; on return, the user is signed in. */
  signInWithGoogle: () => Promise<void>
  /** Sends an email with a passwordless sign-in link. */
  sendEmailLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const noAccounts: AccountContextValue = {
  enabled: false,
  loading: false,
  user: null,
  syncStatus: 'idle',
  provider: 'local',
  signInWithGoogle: () => Promise.resolve(),
  sendEmailLink: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
}

export const AccountContext = createContext<AccountContextValue>(noAccounts)

/** The user's account, if any. Without an <AccountProvider> the app works without accounts. */
export function useAccount(): AccountContextValue {
  return use(AccountContext)
}
