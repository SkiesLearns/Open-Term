import type {
  AppSettings,
  ConnectRequest,
  ConnectResult,
  ListResult,
  OpResult,
  ProgressEvent,
  PublicServer,
  ServerInput,
  StatusEvent
} from './types'

export interface BridgeAPI {
  settings: {
    get(): Promise<AppSettings>
    set(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  servers: {
    list(): Promise<PublicServer[]>
    save(server: ServerInput): Promise<{ ok: boolean; error?: string; server?: PublicServer }>
    remove(id: string): Promise<void>
    secureAvailable(): Promise<boolean>
  }
  ssh: {
    connect(req: ConnectRequest): Promise<ConnectResult>
    input(sessionId: string, data: string): void
    resize(sessionId: string, cols: number, rows: number): void
    disconnect(sessionId: string): Promise<void>
  }
  files: {
    connect(req: ConnectRequest): Promise<ConnectResult>
    list(sessionId: string, path: string): Promise<ListResult>
    mkdir(sessionId: string, path: string): Promise<OpResult>
    rename(sessionId: string, from: string, to: string): Promise<OpResult>
    remove(sessionId: string, path: string, isDir: boolean): Promise<OpResult>
    download(
      sessionId: string,
      transferId: string,
      remotePath: string,
      localPath: string,
      isDir: boolean,
      size: number
    ): Promise<OpResult>
    upload(
      sessionId: string,
      transferId: string,
      localPath: string,
      remotePath: string,
      isDir: boolean
    ): Promise<OpResult>
    disconnect(sessionId: string): Promise<void>
  }
  local: {
    home(): Promise<string>
    list(path: string): Promise<ListResult>
    stat(path: string): Promise<{ ok: boolean; error?: string; size?: number; isDir?: boolean }>
    mkdir(path: string): Promise<OpResult>
    rename(from: string, to: string): Promise<OpResult>
    remove(path: string, isDir: boolean): Promise<OpResult>
  }
  dialog: {
    pickFile(): Promise<string | null>
  }
  events: {
    onSshData(cb: (p: { id: string; data: Uint8Array }) => void): () => void
    onStatus(cb: (p: StatusEvent) => void): () => void
    onProgress(cb: (p: ProgressEvent) => void): () => void
  }
  pathForFile(file: File): string
  sep: string
}
