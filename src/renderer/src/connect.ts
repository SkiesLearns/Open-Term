import { useStore, type Tab, type TabConnect } from './store'
import { registry } from './terminalRegistry'
import type { AdhocParams, Protocol, PublicServer } from '../../shared/types'

function openTab(connect: TabConnect, protocol: Protocol, title: string, host: string): void {
  const id = crypto.randomUUID()
  const kind: Tab['kind'] = protocol === 'ssh' ? 'ssh' : 'files'
  useStore.getState().addTab({ id, kind, protocol, title, host, status: 'connecting', connect })
  // SSH connects from TerminalView once the terminal is mounted and measured;
  // file sessions can connect immediately.
  if (kind === 'files') void connectFiles(id)
}

export function openTabForServer(server: PublicServer, password?: string, passphrase?: string): void {
  openTab({ serverId: server.id, password, passphrase }, server.protocol, server.name, server.host)
}

/** Sidebar one-click connect: prompts for a password when none is stored. */
export async function connectSaved(server: PublicServer): Promise<void> {
  let password: string | undefined
  if (server.authType === 'password' && !server.hasPassword) {
    const v = await useStore.getState().promptText({
      title: `Connect to ${server.name}`,
      label: `Password for ${server.username}@${server.host}`,
      password: true,
      submitLabel: 'Connect'
    })
    if (v === null) return
    password = v
  }
  openTabForServer(server, password)
}

export function connectAdhoc(params: AdhocParams, password?: string, passphrase?: string): void {
  openTab({ params, password, passphrase }, params.protocol, `${params.username}@${params.host}`, params.host)
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
