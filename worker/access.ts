/**
 * Cloudflare Access identity.
 *
 * When the Worker is behind an Access application, Access adds a signed JWT
 * (`Cf-Access-Jwt-Assertion`). We verify it against the team's certs and the
 * application audience; the email in it is the user's identity. For local
 * development, `ACCESS_TRUST_HEADER=true` trusts the email header instead.
 */

export interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  ACCESS_TRUST_HEADER?: string
}

export interface AccessIdentity {
  email: string
}

interface Certs {
  fetchedAt: number
  keys: Map<string, JsonWebKey>
}

const CERTS_TTL_MS = 60 * 60 * 1000
let certsCache: Certs | undefined

export async function getAccessIdentity(
  request: Request,
  env: AccessEnv,
): Promise<AccessIdentity | undefined> {
  const emailHeader = request.headers.get('Cf-Access-Authenticated-User-Email')
  if (env.ACCESS_TRUST_HEADER === 'true' && emailHeader) return { email: emailHeader }

  const jwt = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!jwt || !env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) return undefined

  const payload = await verifyAccessJwt(jwt, env)
  if (!payload) return undefined
  const email = typeof payload.email === 'string' ? payload.email : undefined
  return email ? { email } : undefined
}

async function verifyAccessJwt(jwt: string, env: AccessEnv): Promise<Record<string, unknown> | undefined> {
  const [encodedHeader, encodedPayload, encodedSignature] = jwt.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature) return undefined

  let header: Record<string, unknown>
  let payload: Record<string, unknown>
  try {
    header = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedHeader))) as Record<string, unknown>
    payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as Record<string, unknown>
  } catch {
    return undefined
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return undefined
  const key = await findKey(header.kid, env)
  if (!key) return undefined

  const imported = await crypto.subtle.importKey(
    'jwk',
    key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    imported,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  )
  if (!valid) return undefined

  const now = Math.floor(Date.now() / 1000)
  const audience = payload.aud
  const audiences = Array.isArray(audience) ? audience : [audience]
  if (!audiences.includes(env.ACCESS_AUD)) return undefined
  if (typeof payload.exp !== 'number' || payload.exp <= now) return undefined
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return undefined
  const issuer = typeof payload.iss === 'string' ? payload.iss : ''
  if (!issuer.includes(normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN ?? ''))) return undefined

  return payload
}

async function findKey(kid: string, env: AccessEnv): Promise<JsonWebKey | undefined> {
  const now = Date.now()
  if (!certsCache || now - certsCache.fetchedAt > CERTS_TTL_MS) {
    const domain = normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN ?? '')
    const response = await fetch(`https://${domain}/cdn-cgi/access/certs`)
    if (!response.ok) return undefined
    const data: unknown = await response.json()
    const keys = isRecord(data) && Array.isArray(data.keys) ? data.keys : []
    certsCache = {
      fetchedAt: now,
      keys: new Map(
        keys.flatMap((key) =>
          isRecord(key) && typeof key.kid === 'string' ? [[key.kid, key as JsonWebKey] as const] : [],
        ),
      ),
    }
  }
  return certsCache.keys.get(kid)
}

function normalizeTeamDomain(domain: string): string {
  return domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
}

function decodeBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer as ArrayBuffer
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
