import { useStore, type Tab, type TabConnect } from './store'
import { registry } from './terminalRegistry'
import type { AdhocParams, Protocol, PublicServer } from '../../shared/types'

/** What to open for a server: a terminal, a file browser, or both at once. */
export type OpenMode = 'ssh' | 'files' | 'both'

/** A terminal needs a shell, so it only applies to SSH-capable hosts. */
export function serverCanSsh(server: PublicServer): boolean {
  return server.protocol === 'ssh' || server.protocol === 'sftp'
}

/** File transfers over an SSH host use SFTP; FTP hosts keep their protocol. */
function fileProtocol(server: PublicServer): Protocol {
  return server.protocol === 'ssh' ? 'sftp' : server.protocol
}

/** What a one-click connect opens by default (matches how the server was saved). */
function nativeMode(server: PublicServer): OpenMode {
  return server.protocol === 'ssh' ? 'ssh' : 'files'
}

function openConnection(
  kind: Tab['kind'],
  protocol: Protocol,
  connect: TabConnect,
  title: string,
  host: string
): string {
  const id = crypto.randomUUID()
  useStore.getState().addTab({ id, kind, protocol, title, host, status: 'connecting', connect })
  // SSH connects from TerminalView once the terminal is mounted and measured;
  // file sessions can connect immediately.
  if (kind === 'files') void connectFiles(id)
  return id
}

/** Open the requested tab(s) for a server with a connect blob already resolved. */
function openTabs(server: PublicServer, mode: OpenMode, connect: TabConnect): string[] {
  const wantSsh = (mode === 'ssh' || mode === 'both') && serverCanSsh(server)
  const wantFiles = mode === 'files' || mode === 'both'
  const ids: string[] = []
  if (wantSsh) ids.push(openConnection('ssh', 'ssh', { ...connect }, server.name, server.host))
  if (wantFiles) ids.push(openConnection('files', fileProtocol(server), { ...connect }, server.name, server.host))
  return ids
}

/** Prompt for a password only when one is needed and none is stored. */
async function resolveSecret(server: PublicServer): Promise<{ password?: string; cancelled: boolean }> {
  if (server.authType === 'password' && !server.hasPassword) {
    const v = await useStore.getState().promptText({
      title: `Connect to ${server.name}`,
      label: `Password for ${server.username}@${server.host}`,
      password: true,
      submitLabel: 'Connect'
    })
    if (v === null) return { cancelled: true }
    return { password: v, cancelled: false }
  }
  return { cancelled: false }
}

/**
 * Open SSH, files, or both for a single server (dashboard / sidebar).
 * Prompts once for a password if required and reuses it for both sessions.
 */
export async function openServer(server: PublicServer, mode: OpenMode): Promise<void> {
  const wantSsh = (mode === 'ssh' || mode === 'both') && serverCanSsh(server)
  const wantFiles = mode === 'files' || mode === 'both'
  if (!wantSsh && !wantFiles) return
  const secret = await resolveSecret(server)
  if (secret.cancelled) return
  const ids = openTabs(server, mode, { serverId: server.id, password: secret.password })
  if (ids[0]) useStore.getState().setActiveTab(ids[0])
}

/** Bulk-open every server in a group; focuses the first session opened. */
export async function openGroup(servers: PublicServer[], mode: OpenMode): Promise<void> {
  let first: string | undefined
  for (const server of servers) {
    const wantSsh = (mode === 'ssh' || mode === 'both') && serverCanSsh(server)
    const wantFiles = mode === 'files' || mode === 'both'
    if (!wantSsh && !wantFiles) continue
    const secret = await resolveSecret(server)
    if (secret.cancelled) continue // skip this one, keep opening the rest
    const ids = openTabs(server, mode, { serverId: server.id, password: secret.password })
    first ??= ids[0]
  }
  if (first) useStore.getState().setActiveTab(first)
}

/** Open a server using a password already in hand (e.g. straight after saving). */
export function openTabForServer(server: PublicServer, password?: string, passphrase?: string): void {
  const ids = openTabs(server, nativeMode(server), { serverId: server.id, password, passphrase })
  if (ids[0]) useStore.getState().setActiveTab(ids[0])
}

/** Sidebar one-click connect: opens however the server was saved. */
export async function connectSaved(server: PublicServer): Promise<void> {
  await openServer(server, nativeMode(server))
}

export function connectAdhoc(params: AdhocParams, password?: string, passphrase?: string): void {
  const kind: Tab['kind'] = params.protocol === 'ssh' ? 'ssh' : 'files'
  openConnection(kind, params.protocol, { params, password, passphrase }, `${params.username}@${params.host}`, params.host)
}

/** If the key is encrypted and we have no passphrase yet, ask and retry once. */
async function passphraseRetry(tabId: string, error: string, retry: () => Promise<void>): Promise<boolean> {
  const tab = useStore.getState().tabs.find((t) => t.id === tabId)
  if (!tab || tab.connect.passphrase || !/passphrase|encrypted/i.test(error)) return false
  const usesKey =
    tab.connect.params?.authType === 'key' ||
    useStore.getState().servers.find((s) => s.id === tab.connect.serverId)?.authType === 'key'
  if (!usesKey) return false
  const v = await useStore.getState().promptText({
    title: 'Encrypted private key',
    label: 'Key passphrase',
    password: true,
    submitLabel: 'Unlock'
  })
  if (v === null) return false
  useStore.getState().patchTabConnect(tabId, { passphrase: v })
  await retry()
  return true
}

export async function connectSsh(tabId: string, cols: number, rows: number): Promise<void> {
  const st = useStore.getState()
  const tab = st.tabs.find((t) => t.id === tabId)
  if (!tab) return
  st.updateTab(tabId, { status: 'connecting', message: undefined })
  const res = await window.bridge.ssh.connect({ sessionId: tabId, ...tab.connect, cols, rows })
  if (!res.ok) {
    const retried = await passphraseRetry(tabId, res.error ?? '', () => connectSsh(tabId, cols, rows))
    if (!retried) useStore.getState().updateTab(tabId, { status: 'error', message: res.error })
  }
}

export async function connectFiles(tabId: string): Promise<void> {
  const st = useStore.getState()
  const tab = st.tabs.find((t) => t.id === tabId)
  if (!tab) return
  st.updateTab(tabId, { status: 'connecting', message: undefined })
  const res = await window.bridge.files.connect({ sessionId: tabId, ...tab.connect })
  if (!res.ok) {
    const retried = await passphraseRetry(tabId, res.error ?? '', () => connectFiles(tabId))
    if (!retried) useStore.getState().updateTab(tabId, { status: 'error', message: res.error })
    return
  }
  const home = await window.bridge.local.home()
  const prev = useStore.getState().filesPaths[tabId]
  // Some servers report a Windows-style cwd; remote paths are always POSIX here.
  const cwd = (res.cwd ?? '/').replace(/\\/g, '/') || '/'
  useStore.getState().setFilesPaths(tabId, {
    localPath: prev?.localPath || home,
    remotePath: prev?.remotePath && prev.remotePath !== '/' ? prev.remotePath : cwd.startsWith('/') ? cwd : '/' + cwd
  })
  useStore.getState().updateTab(tabId, { status: 'connected', message: undefined })
}

export function reconnectTab(tabId: string): void {
  const tab = useStore.getState().tabs.find((t) => t.id === tabId)
  if (!tab) return
  if (tab.kind === 'ssh') {
    const ctl = registry.get(tabId)
    ctl?.reset()
    void connectSsh(tabId, ctl?.cols() ?? 80, ctl?.rows() ?? 24)
  } else {
    void connectFiles(tabId)
  }
}
