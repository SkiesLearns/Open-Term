import type { WebContents } from 'electron'
import type { SessionState } from '../../shared/types'

/** Fully resolved connection parameters (secrets included — main process only). */
export interface ResolvedParams {
  host: string
  port: number
  username: string
  password?: string
  privateKeyPath?: string
  passphrase?: string
}

/** Map low-level network/library errors to something a user can act on. */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; level?: string; code?: string } | undefined
  const msg = String(e?.message ?? err ?? 'Unknown error')
  if (e?.level === 'client-authentication' || /authentication|530 login/i.test(msg)) {
    return 'Authentication failed — check username, password or key'
  }
  if (/ENOTFOUND|getaddrinfo/.test(msg)) return 'Host not found — check the hostname'
  if (/ECONNREFUSED/.test(msg)) return 'Connection refused — is the server listening on that port?'
  if (/ETIMEDOUT|timed? ?out/i.test(msg)) return 'Connection timed out — host unreachable or port blocked'
  if (/EHOSTUNREACH|ENETUNREACH/.test(msg)) return 'Host unreachable — check your network'
  if (/ECONNRESET/.test(msg)) return 'Connection reset by the server'
  return msg
}

export function sendToRenderer(wc: WebContents, channel: string, payload: unknown): void {
  if (!wc.isDestroyed()) wc.send(channel, payload)
}

export function sendStatus(wc: WebContents, id: string, state: SessionState, message?: string): void {
  sendToRenderer(wc, 'session:status', { id, state, message })
}
