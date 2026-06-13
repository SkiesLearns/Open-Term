import { app, safeStorage } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import type { PublicServer, ServerInput, Protocol, AuthType } from '../../shared/types'

/**
 * Saved-server store. Persisted as JSON in the app's user-data dir.
 * Secrets (passwords / key passphrases) are encrypted at rest with
 * Electron safeStorage (OS keychain-backed: DPAPI on Windows, Keychain
 * on macOS, libsecret on Linux) and are never sent to the renderer.
 */
interface StoredServer {
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
  encPassword?: string
  encPassphrase?: string
}

let cache: StoredServer[] | null = null

const filePath = (): string => join(app.getPath('userData'), 'servers.json')

async function load(): Promise<StoredServer[]> {
  if (cache) return cache
  try {
    cache = JSON.parse(await fs.readFile(filePath(), 'utf8')) as StoredServer[]
  } catch {
    cache = []
  }
  return cache
}

async function persist(): Promise<void> {
  const tmp = filePath() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(cache ?? [], null, 2), { mode: 0o600 })
  await fs.rename(tmp, filePath())
}

export function encryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

function encrypt(secret: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is unavailable — secrets cannot be saved')
  }
  return safeStorage.encryptString(secret).toString('base64')
}

function decrypt(blob: string): string {
  return safeStorage.decryptString(Buffer.from(blob, 'base64'))
}

function toPublic(s: StoredServer): PublicServer {
  return {
    id: s.id,
    name: s.name,
    protocol: s.protocol,
    host: s.host,
    port: s.port,
    username: s.username,
    group: s.group,
    authType: s.authType,
    privateKeyPath: s.privateKeyPath,
    savePassword: s.savePassword,
    hasPassword: !!s.encPassword,
    hasPassphrase: !!s.encPassphrase
  }
}

export async function listServers(): Promise<PublicServer[]> {
  return (await load()).map(toPublic)
}

export async function getServer(id: string): Promise<StoredServer | undefined> {
  return (await load()).find((s) => s.id === id)
}

export async function saveServer(input: ServerInput): Promise<PublicServer> {
  const servers = await load()
  let s = input.id ? servers.find((x) => x.id === input.id) : undefined
  if (!s) {
    s = { id: randomUUID() } as StoredServer
    servers.push(s)
  }
  s.name = input.name
  s.protocol = input.protocol
  s.host = input.host
  s.port = input.port
  s.username = input.username
  s.group = input.group ?? ''
  s.authType = input.authType
  s.privateKeyPath = input.authType === 'key' ? input.privateKeyPath : undefined
  s.savePassword = input.savePassword

  if (!input.savePassword) {
    delete s.encPassword
    delete s.encPassphrase
  } else {
    // Empty fields mean "keep whatever is already stored".
    if (input.password) s.encPassword = encrypt(input.password)
    if (input.passphrase) s.encPassphrase = encrypt(input.passphrase)
  }
  if (s.authType === 'key') delete s.encPassword
  if (s.authType === 'password') delete s.encPassphrase

  await persist()
  return toPublic(s)
}

export async function deleteServer(id: string): Promise<void> {
  const servers = await load()
  cache = servers.filter((s) => s.id !== id)
  await persist()
}

export function getSecrets(s: StoredServer): { password?: string; passphrase?: string } {
  return {
    password: s.encPassword ? decrypt(s.encPassword) : undefined,
    passphrase: s.encPassphrase ? decrypt(s.encPassphrase) : undefined
  }
}
