import { Client as FtpClient } from 'basic-ftp'
import type { WebContents } from 'electron'
import type { FileEntry } from '../../shared/types'
import { sendStatus, type ResolvedParams } from './common'

type ProgressCb = (transferred: number, total: number) => void

/**
 * Plain FTP / FTPS session via basic-ftp. FTP allows only one command
 * in flight per control connection, so every operation is funneled
 * through a promise queue.
 */
export class FtpSession {
  private client = new FtpClient(30000)
  private queue: Promise<unknown> = Promise.resolve()
  private keepalive: ReturnType<typeof setInterval> | null = null
  private disposed = false

  constructor(
    private id: string,
    private wc: WebContents
  ) {}

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.queue.then(fn, fn)
    this.queue = task.then(
      () => undefined,
      () => undefined
    )
    return task
  }

  async connect(p: ResolvedParams & { secure: boolean }): Promise<string> {
    await this.client.access({
      host: p.host,
      port: p.port,
      user: p.username || undefined,
      password: p.password || undefined,
      secure: p.secure,
      // Many private FTPS servers use self-signed certificates; accept them
      // like FileZilla's default. Tighten if you need strict verification.
      secureOptions: { rejectUnauthorized: false }
    })

    this.keepalive = setInterval(() => {
      if (this.disposed) return
      void this.run(() => this.client.send('NOOP')).catch(() => {
        if (!this.disposed && this.client.closed) {
          sendStatus(this.wc, this.id, 'disconnected', 'Connection lost')
          this.stopKeepalive()
        }
      })
    }, 25000)

    return this.run(() => this.client.pwd())
  }

  async list(path: string): Promise<FileEntry[]> {
    const entries = await this.run(() => this.client.list(path))
    return entries.map((e) => ({
      name: e.name,
      type: e.isDirectory ? 'dir' : e.isSymbolicLink ? 'link' : 'file',
      size: e.size,
      mtime: e.modifiedAt ? e.modifiedAt.getTime() : null
    }))
  }

  async mkdir(path: string): Promise<void> {
    await this.run(() => this.client.send('MKD ' + path))
  }

  async rename(from: string, to: string): Promise<void> {
    await this.run(() => this.client.rename(from, to))
  }

  async remove(path: string, isDir: boolean): Promise<void> {
    await this.run<unknown>(() => (isDir ? this.client.removeDir(path) : this.client.remove(path)))
  }

  async download(
    remote: string,
    local: string,
    isDir: boolean,
    size: number,
    onProgress: ProgressCb
  ): Promise<void> {
    await this.run(async () => {
      if (isDir) {
        await this.client.downloadToDir(local, remote)
        return
      }
      this.client.trackProgress((info) => onProgress(info.bytes, size))
      try {
        await this.client.downloadTo(local, remote)
      } finally {
        this.client.trackProgress()
      }
    })
  }

  async upload(
    local: string,
    remote: string,
    isDir: boolean,
    size: number,
    onProgress: ProgressCb
  ): Promise<void> {
    await this.run(async () => {
      if (isDir) {
        await this.client.uploadFromDir(local, remote)
        return
      }
      this.client.trackProgress((info) => onProgress(info.bytes, size))
      try {
        await this.client.uploadFrom(local, remote)
      } finally {
        this.client.trackProgress()
      }
    })
  }

  private stopKeepalive(): void {
    if (this.keepalive) {
      clearInterval(this.keepalive)
      this.keepalive = null
    }
  }

  dispose(): void {
    this.disposed = true
    this.stopKeepalive()
    this.client.close()
  }
}
