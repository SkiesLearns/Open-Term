import { useStore } from './store'

type Direction = 'upload' | 'download'

export interface TransferRequest {
  direction: Direction
  name: string
  isDir: boolean
  size: number
  localPath: string
  remotePath: string
}

// One sequential queue per file tab so FTP control connections are never
// asked to do two things at once; SFTP simply benefits from orderly progress.
const queues = new Map<string, Promise<void>>()
const doneListeners = new Map<string, Set<(direction: Direction) => void>>()

export function onTransferDone(tabId: string, cb: (direction: Direction) => void): () => void {
  let set = doneListeners.get(tabId)
  if (!set) {
    set = new Set()
    doneListeners.set(tabId, set)
  }
  set.add(cb)
  return () => {
    set.delete(cb)
  }
}

export function enqueueTransfer(tabId: string, req: TransferRequest): void {
  const id = crypto.randomUUID()
  useStore.getState().addTransfer({
    id,
    tabId,
    name: req.name,
    direction: req.direction,
    size: req.size,
    transferred: 0,
    status: 'queued',
    isDir: req.isDir
  })
  const prev = queues.get(tabId) ?? Promise.resolve()
  queues.set(
    tabId,
    prev.then(() => runTransfer(id, tabId, req)).catch(() => undefined)
  )
}

async function runTransfer(id: string, tabId: string, req: TransferRequest): Promise<void> {
  const st = useStore.getState()
  if (!st.tabs.some((t) => t.id === tabId)) return // tab closed while queued
  st.updateTransfer(id, { status: 'active' })
  const res =
    req.direction === 'download'
      ? await window.bridge.files.download(tabId, id, req.remotePath, req.localPath, req.isDir, req.size)
      : await window.bridge.files.upload(tabId, id, req.localPath, req.remotePath, req.isDir)
  const after = useStore.getState()
  if (res.ok) {
    const final = after.transfers.find((t) => t.id === id)?.size ?? req.size
    after.updateTransfer(id, { status: 'done', transferred: final })
  } else {
    after.updateTransfer(id, { status: 'error', error: res.error })
  }
  doneListeners.get(tabId)?.forEach((cb) => cb(req.direction))
}
