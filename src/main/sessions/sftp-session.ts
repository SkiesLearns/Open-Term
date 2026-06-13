import SftpClient from 'ssh2-sftp-client'
import { readFile } from 'fs/promises'
import type { WebContents } from 'electron'
import type { FileEntry } from '../../shared/types'
import { friendlyError, sendStatus, type ResolvedParams } from './common'

type ProgressCb = (transferred: number, total: number) => void

export class SftpSession {
  private client = new SftpClient()
  private disposed = false

  constructor(
    private id: string,
    private wc: WebContents
  ) {}

  async connect(p: ResolvedParams): Promise<string> {
    let privateKey: Buffer | undefined
    if (p.privateKeyPath) privateKey = await readFile(p.privateKeyPath)

    await this.client.connect({
      host: p.host,
      port: p.port,
      username: p.username,
      password: p.password,
      privateKey,
      passphrase: p.passphrase,
      readyTimeout: 15000,
      keepaliveInterval: 15000
    })

    const emitter = this.client as unknown as {
      on?: (ev: string, cb: (arg?: unknown) => void) => void
    }
    emitter.on?.('close', () => {
      if (!this.disposed) sendStatus(this.wc, this.id, 'disconnected', 'Connection closed')
    })
    emitter.on?.('error', (err) => {
      if (!this.disposed) sendStatus(this.wc, this.id, 'error', friendlyError(err))
    })

    const cwd = await this.client.cwd()
    return cwd || '/'
  }

  async list(path: string): Promise<FileEntry[]> {
    const entries = await this.client.list(path)
    return entries.map((e) => ({
      name: e.name,
      type: e.type === 'd' ? 'dir' : e.type === 'l' ? 'link' : 'file',
      size: e.size,
      mtime: e.modifyTime ?? null
    }))
  }

  async mkdir(path: string): Promise<void> {
    await this.client.mkdir(path, false)
  }

  async rename(from: string, to: string): Promise<void> {
    await this.client.rename(from, to)
  }

  async remove(path: string, isDir: boolean): Promise<void> {
    if (isDir) await this.client.rmdir(path, true)
    else await this.client.delete(path)
  }

  async download(
    remote: string,
    local: string,
    isDir: boolean,
    _size: number,
    onProgress: ProgressCb
  ): Promise<void> {
    if (isDir) {
      await this.client.downloadDir(remote, local)
    } else {
      await this.client.fastGet(remote, local, {
        step: (transferred, _chunk, total) => onProgress(transferred, total)
      })
    }
  }

  async upload(
    local: string,
    remote: string,
    isDir: boolean,
    _size: number,
    onProgress: ProgressCb
  ): Promise<void> {
    if (isDir) {
      await this.client.uploadDir(local, remote)
    } else {
      await this.client.fastPut(local, remote, {
        step: (transferred, _chunk, total) => onProgress(transferred, total)
      })
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true
    try {
      await this.client.end()
    } catch {
      /* already gone */
    }
  }
}
