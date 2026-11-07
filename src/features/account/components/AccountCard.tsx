import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button.tsx'
import { Card } from '../../../components/ui/Card.tsx'
import { t, type MessageKey } from '../../../i18n/index.ts'
import { useAccount, type SyncStatus } from '../accountContext.ts'

const SYNC_STATUS_TEXT: Record<SyncStatus, MessageKey> = {
  idle: 'account.syncIdle',
  syncing: 'account.syncing',
  synced: 'account.synced',
  error: 'account.syncError',
}

type EmailState = 'idle' | 'sending' | 'sent' | 'error'

/**
 * Account or cloud-sync card. Supabase shows the sign-in form; Cloudflare
 * Access is handled at the edge, and an anonymous device shows its D1 sync
 * state. Hidden when no cloud backend is configured.
 */
export function AccountCard() {
  const {
    enabled,
    loading,
    user,
    syncStatus,
    provider,
    signInWithGoogle,
    sendEmailLink,
    signOut,
  } = useAccount()
  const [email, setEmail] = useState('')
  const [emailState, setEmailState] = useState<EmailState>('idle')
  const [googleError, setGoogleError] = useState(false)
  const emailId = useId()

  if (!enabled || loading) return null

  if (provider === 'cloudflare-access') {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('account.cloudTitle')}</h2>
        {user ? (
          <>
            <p>{t('account.signedInAs', { email: user.email ?? '' })}</p>
            <SyncStatusLine status={syncStatus} />
            <div>
              <Button variant="secondary" onClick={() => void signOut()}>
                {t('account.signOut')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-ink-muted">{t('account.accessRequired')}</p>
            <div>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                {t('account.reload')}
              </Button>
            </div>
          </>
        )}
      </Card>
    )
  }

  if (provider === 'anonymous') {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('account.cloudTitle')}</h2>
        <p className="text-ink-muted">
          {t(user ? 'account.cloudAnonymous' : 'account.syncUnavailable')}
        </p>
        {user && <SyncStatusLine status={syncStatus} />}
      </Card>
    )
  }

  if (user) {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('account.title')}</h2>
        <p>{t('account.signedInAs', { email: user.email ?? '' })}</p>
        <SyncStatusLine status={syncStatus} />
        <div>
          <Button variant="secondary" onClick={() => void signOut()}>
            {t('account.signOut')}
          </Button>
        </div>
      </Card>
    )
  }

  const continueWithGoogle = async () => {
    setGoogleError(false)
    try {
      await signInWithGoogle()
    } catch {
      setGoogleError(true)
    }
  }

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault()
    if (email.trim() === '') return
    setEmailState('sending')
    try {
      await sendEmailLink(email.trim())
      setEmailState('sent')
    } catch {
      setEmailState('error')
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('account.title')}</h2>
        <p className="text-sm text-ink-muted">{t('account.description')}</p>
      </div>
      <div>
        <Button onClick={() => void continueWithGoogle()}>{t('account.google')}</Button>
        {googleError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {t('account.error')}
          </p>
        )}
      </div>
      <form onSubmit={(event) => void submitEmail(event)} className="flex flex-col gap-1.5">
        <label htmlFor={emailId} className="font-medium">
          {t('account.emailLabel')}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setEmailState('idle')
            }}
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5"
          />
          <Button type="submit" variant="secondary" disabled={emailState === 'sending' || email.trim() === ''}>
            {t('account.sendLink')}
          </Button>
        </div>
        {emailState === 'sent' && (
          <p role="status" className="text-sm text-success">
            {t('account.linkSent')}
          </p>
        )}
        {emailState === 'error' && (
          <p role="alert" className="text-sm text-danger">
            {t('account.error')}
          </p>
        )}
      </form>
    </Card>
  )
}

function SyncStatusLine({ status }: { status: SyncStatus }) {
  return (
    <p role="status" className={`text-sm ${status === 'error' ? 'text-danger' : 'text-ink-muted'}`}>
      {t(SYNC_STATUS_TEXT[status])}
    </p>
  )
}
