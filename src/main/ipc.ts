import { BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import * as store from './store/credential-store'
import * as settings from './store/settings-store'
import { friendlyError, type ResolvedParams } from './sessions/common'
import { SshSession } from './sessions/ssh-session'
import { SftpSession } from './sessions/sftp-session'
import { FtpSession } from './sessions/ftp-session'
import type { ConnectRequest, FileEntry, Protocol, ServerInput } from '../shared/types'

const sshSessions = new Map<string, SshSession>()
const fileSessions = new Map<string, SftpSession | FtpSession>()

async function resolveConnect(req: ConnectRequest): Promise<ResolvedParams & { protocol: Protocol }> {
  if (req.serverId) {
    const s = await store.getServer(req.serverId)
    if (!s) throw new Error('Saved server not found')
    const secrets = store.getSecrets(s)
    return {
      protocol: s.protocol,
      host: s.host,
      port: s.port,
      username: s.username,
      password: req.password ?? secrets.password,
      privateKeyPath: s.authType === 'key' ? s.privateKeyPath : undefined,
      passphrase: req.passphrase ?? secrets.passphrase
    }
  }
  if (!req.params) throw new Error('Missing connection parameters')
  return {
    protocol: req.params.protocol,
    host: req.params.host,
    port: req.params.port,
    username: req.params.username,
    password: req.password,
    privateKeyPath: req.params.authType === 'key' ? req.params.privateKeyPath : undefined,
    passphrase: req.passphrase
  }
}

/** Rate-limited progress reporter so big transfers don't flood IPC. */
function progressSender(wc: WebContents, transferId: string) {
  let last = 0
  return (transferred: number, total: number): void => {
    const now = Date.now()
    if (now - last < 100 && transferred < total) return
    last = now
    if (!wc.isDestroyed()) wc.send('transfer:progress', { transferId, transferred, total })
  }
}

async function disposeFileSession(id: string): Promise<void> {
  const s = fileSessions.get(id)
  fileSessions.delete(id)
  if (!s) return
  if (s instanceof SftpSession) await s.dispose()
  else s.dispose()
}

export function disposeAllSessions(): void {
  for (const s of sshSessions.values()) s.dispose()
  sshSessions.clear()
  for (const id of [...fileSessions.keys()]) void disposeFileSession(id)
}

export function registerIpc(): void {
  // ---- app settings ----
  ipcMain.handle('settings:get', () => settings.getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<import('../shared/types').AppSettings>) =>
    settings.updateSettings(patch)
  )

  // ---- saved servers ----
  ipcMain.handle('servers:list', () => store.listServers())
  ipcMain.handle('servers:save', async (_e, input: ServerInput) => {
    try {
      return { ok: true, server: await store.saveServer(input) }
    } catch (err) {
      return { ok: false, error: friendlyError(err) }
    }
  })
  ipcMain.handle('servers:delete', (_e, id: string) => store.deleteServer(id))
  ipcMain.handle('secure:available', () => store.encryptionAvailable())

  // ---- ssh terminal sessions ----
  ipcMain.handle('ssh:connect', async (e, req: ConnectRequest) => {
    sshSessions.get(req.sessionId)?.dispose()
    sshSessions.delete(req.sessionId)
    try {
      const p = await resolveConnect(req)
      const session = new SshSession(req.sessionId, e.sender)
      sshSessions.set(req.sessionId, session)
      await session.connect(p, req.cols ?? 80, req.rows ?? 24)
      return { ok: true }
    } catch (err) {
      sshSessions.get(req.sessionId)?.dispose()
      sshSessions.delete(req.sessionId)
      return { ok: false, error: friendlyError(err) }
    }
  })
  ipcMain.on('ssh:input', (_e, p: { id: string; data: string }) => {
    sshSessions.get(p.id)?.write(p.data)
  })
  ipcMain.on('ssh:resize', (_e, p: { id: string; cols: number; rows: number }) => {
    sshSessions.get(p.id)?.resize(p.cols, p.rows)
  })
  ipcMain.handle('ssh:disconnect', (_e, id: string) => {
    sshSessions.get(id)?.dispose()
    sshSessions.delete(id)
  })

  // ---- sftp/ftp file sessions ----
  ipcMain.handle('files:connect', async (e, req: ConnectRequest) => {
    await disposeFileSession(req.sessionId)
    try {
      const p = await resolveConnect(req)
      let cwd: string
      let session: SftpSession | FtpSession
      if (p.protocol === 'sftp' || p.protocol === 'ssh') {
        session = new SftpSession(req.sessionId, e.sender)
        cwd = await session.connect(p)
      } else {
        session = new FtpSession(req.sessionId, e.sender)
        cwd = await session.connect({ ...p, secure: p.protocol === 'ftps' })
      }
      fileSessions.set(req.sessionId, session)
      return { ok: true, cwd }
    } catch (err) {
      return { ok: false, error: friendlyError(err) }
    }
  })

  const withFileSession = async (
    sessionId: string,
    fn: (s: SftpSession | FtpSession) => Promise<void>
  ): Promise<{ ok: boolean; error?: string }> => {
    const s = fileSessions.get(sessionId)
    if (!s) return { ok: false, error: 'Not connected' }
    try {
      await fn(s)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: friendlyError(err) }
    }
  }

  ipcMain.handle('files:list', async (_e, p: { sessionId: string; path: string }) => {
    const s = fileSessions.get(p.sessionId)
    if (!s) return { ok: false, error: 'Not connected' }
    try {
      return { ok: true, entries: await s.list(p.path), path: p.path }
    } catch (err) {
      return { ok: false, error: friendlyError(err) }
    }
  })
  ipcMain.handle('files:mkdir', (_e, p: { sessionId: string; path: string }) =>
    withFileSession(p.sessionId, (s) => s.mkdir(p.path))
  )
  ipcMain.handle('files:rename', (_e, p: { sessionId: string; from: string; to: string }) =>
    withFileSession(p.sessionId, (s) => s.rename(p.from, p.to))
  )
  ipcMain.handle('files:remove', (_e, p: { sessionId: string; path: string; isDir: boolean }) =>
    withFileSession(p.sessionId, (s) => s.remove(p.path, p.isDir))
  )
  ipcMain.handle(
    'files:download',
    async (
      e,
      p: {
        sessionId: string
        transferId: string
        remotePath: string
        localPath: string
        isDir: boolean
        size: number
      }
    ) =>
      withFileSession(p.sessionId, (s) =>
        s.download(p.remotePath, p.localPath, p.isDir, p.size, progressSender(e.sender, p.transferId))
      )
  )
  ipcMain.handle(
    'files:upload',
    async (
      e,
      p: { sessionId: string; transferId: string; localPath: string; remotePath: string; isDir: boolean }
    ) =>
      withFileSession(p.sessionId, async (s) => {
        const size = p.isDir ? 0 : (await fs.stat(p.localPath)).size
        await s.upload(p.localPath, p.remotePath, p.isDir, size, progressSender(e.sender, p.transferId))
      })
  )
  ipcMain.handle('files:disconnect', (_e, id: string) => disposeFileSession(id))

  // ---- local filesystem ----
  ipcMain.handle('local:home', () => homedir())
  ipcMain.handle('local:list', async (_e, path: string) => {
    try {
      const abs = resolve(path)
      const dirents = await fs.readdir(abs, { withFileTypes: true })
      const entries: FileEntry[] = []
      for (const d of dirents) {
        let size = 0
        let mtime: number | null = null
        try {
          const st = await fs.stat(join(abs, d.name))
          size = st.size
          mtime = st.mtimeMs
        } catch {
          // permission denied / broken link — still show the name
        }
        entries.push({
          name: d.name,
          type: d.isDirectory() ? 'dir' : d.isSymbolicLink() ? 'link' : 'file',
          size,
          mtime
        })
      }
      return { ok: true, path: abs, entries }
    } catch (err) {
      return { ok: false, error: friendlyError(err) }
    }
  })
  ipcMain.handle('local:stat', async (_e, path: string) => {
    try {
      const st = await fs.stat(path)
      return { ok: true, size: st.size, isDir: st.isDirectory() }
    } catch (err) {
      return { ok: false, error: friendlyError(err) }
    }
  })
  ipcMain.handle('local:mkdir', async (_e, path: string) => {
    try {
      await fs.mkdir(path)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: friendlyError(err) }
    }
  })
  ipcMain.handle('local:rename', async (_e, p: { from: string; to: string }) => {
    try {
      await fs.rename(p.from, p.to)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: friendlyError(err) }
    }
  })
  ipcMain.handle('local:remove', async (_e, p: { path: string; isDir: boolean }) => {
    try {
      await fs.rm(p.path, { recursive: p.isDir })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: friendlyError(err) }
    }
  })

  // ---- dialogs ----
  ipcMain.handle('dialog:pickFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const res = await dialog.showOpenDialog(win!, {
      title: 'Choose private key file',
      properties: ['openFile', 'showHiddenFiles']
    })
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })
}
