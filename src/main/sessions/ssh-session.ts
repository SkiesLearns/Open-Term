import { Client, type ClientChannel } from 'ssh2'
import { readFile } from 'fs/promises'
import type { WebContents } from 'electron'
import { friendlyError, sendStatus, sendToRenderer, type ResolvedParams } from './common'

/**
 * One interactive SSH shell. Each instance owns its own ssh2 Client,
 * so disposing one session can never affect another.
 */
export class SshSession {
  private client = new Client()
  private stream: ClientChannel | null = null
  private ready = false
  private disposed = false

  constructor(
    private id: string,
    private wc: WebContents
  ) {}

  async connect(p: ResolvedParams, cols: number, rows: number): Promise<void> {
    let privateKey: Buffer | undefined
    if (p.privateKeyPath) privateKey = await readFile(p.privateKeyPath)

    await new Promise<void>((resolve, reject) => {
      this.client
        .once('ready', () => {
          this.ready = true
          resolve()
        })
        .on('error', (err) => {
          if (!this.ready) reject(err)
          else if (!this.disposed) sendStatus(this.wc, this.id, 'error', friendlyError(err))
        })
        .on('close', () => {
          if (this.ready && !this.disposed) {
            sendStatus(this.wc, this.id, 'disconnected', 'Connection closed')
          }
        })
        .connect({
          host: p.host,
          port: p.port,
          username: p.username,
          password: p.password,
          privateKey,
          passphrase: p.passphrase,
          readyTimeout: 15000,
          keepaliveInterval: 15000,
          keepaliveCountMax: 3
        })
    })

    this.stream = await new Promise<ClientChannel>((resolve, reject) => {
      this.client.shell({ term: 'xterm-256color', cols, rows }, (err, stream) =>
        err ? reject(err) : resolve(stream)
      )
    })
    this.stream.on('data', (d: Buffer) => sendToRenderer(this.wc, 'ssh:data', { id: this.id, data: d }))
    this.stream.stderr.on('data', (d: Buffer) =>
      sendToRenderer(this.wc, 'ssh:data', { id: this.id, data: d })
    )
    this.stream.on('close', () => {
      if (!this.disposed) {
        sendStatus(this.wc, this.id, 'disconnected', 'Shell session ended')
        this.client.end()
      }
    })
    sendStatus(this.wc, this.id, 'connected')
  }

  write(data: string): void {
    this.stream?.write(data)
  }

  resize(cols: number, rows: number): void {
    this.stream?.setWindow(rows, cols, 0, 0)
  }

  dispose(): void {
    this.disposed = true
    try {
      this.stream?.end()
    } catch {
      /* already gone */
    }
    try {
      this.client.end()
    } catch {
      /* already gone */
    }
  }
}
