export interface AppSettings {
  /** Display name shown in the title bar, window title and welcome screen. */
  appName: string
}

export type Protocol = 'ssh' | 'sftp' | 'ftp' | 'ftps'
export type AuthType = 'password' | 'key'
export type SessionState = 'connecting' | 'connected' | 'disconnected' | 'error'

/** Payload sent renderer -> main when creating/updating a saved server. */
export interface ServerInput {
  id?: string
  name: string
  protocol: Protocol
  host: string
  port: number
  username: string
  group: string
  authType: AuthType
  privateKeyPath?: string
  savePassword: boolean
  /** Only present when the user typed one; encrypted in main, never sent back. */
  password?: string
  passphrase?: string
}

/** Saved server as exposed to the renderer — never contains secrets. */
export interface PublicServer {
  id: string
  name: string
  protocol: Protocol
  host: string
  port: number
  username: string
  group: string
  authType: AuthType
  privateKeyPath?: string
  savePassword: boolean
  hasPassword: boolean
  hasPassphrase: boolean
}

/** Connection parameters for a one-off (unsaved) connection. */
export interface AdhocParams {
  protocol: Protocol
  host: string
  port: number
  username: string
  authType: AuthType
  privateKeyPath?: string
}

export interface ConnectRequest {
  sessionId: string
  /** Either a saved server id ... */
  serverId?: string
  /** ... or explicit parameters. */
  params?: AdhocParams
  /** Overrides any stored secret when provided. */
  password?: string
  passphrase?: string
  cols?: number
  rows?: number
}

export interface ConnectResult {
  ok: boolean
  error?: string
  /** Initial remote working directory (file sessions). */
  cwd?: string
}

export interface OpResult {
  ok: boolean
  error?: string
}

export interface FileEntry {
  name: string
  type: 'dir' | 'file' | 'link'
  size: number
  mtime: number | null
}

export interface ListResult extends OpResult {
  entries?: FileEntry[]
  /** Resolved absolute path (local listings). */
  path?: string
}

export interface StatusEvent {
  id: string
  state: SessionState
  message?: string
}

export interface ProgressEvent {
  transferId: string
  transferred: number
  total: number
}
