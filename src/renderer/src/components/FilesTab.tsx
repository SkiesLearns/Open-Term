import { useCallback, useEffect, useState } from 'react'
import { useStore, type Tab } from '../store'
import { reconnectTab } from '../connect'
import { enqueueTransfer, onTransferDone } from '../transfers'
import { TransferQueue } from './TransferQueue'
import {
  formatBytes,
  formatDate,
  isLocalRoot,
  isRemoteRoot,
  localJoin,
  localParent,
  remoteJoin,
  remoteParent,
  sortEntries
} from '../utils'
import type { FileEntry } from '../../../shared/types'

type Side = 'local' | 'remote'

interface PaneData {
  entries: FileEntry[]
  error?: string
  loading: boolean
}

interface DragPayload {
  tabId: string
  side: Side
  names: string[]
}

interface PaneProps {
  tabId: string
  side: Side
  title: string
  path: string
  data: PaneData
  sel: Set<string>
  setSel: (s: Set<string>) => void
  atRoot: boolean
  connected: boolean
  transferLabel: string
  onNavigate: (path: string) => void
  onUp: () => void
  onRefresh: () => void
  onOpen: (e: FileEntry) => void
  onMkdir: () => void
  onRename: () => void
  onDelete: () => void
  onTransfer: () => void
  onDropItems: (names: string[]) => void
  onDropOsFiles: (files: File[]) => void
}

function Pane(p: PaneProps): React.JSX.Element {
  const [pathInput, setPathInput] = useState(p.path)
  const [dragOver, setDragOver] = useState(false)
  useEffect(() => setPathInput(p.path), [p.path])

  const select = (e: React.MouseEvent, name: string): void => {
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(p.sel)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      p.setSel(next)
    } else {
      p.setSel(new Set([name]))
    }
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    const raw = e.dataTransfer.getData('application/x-openterm')
    if (raw) {
      try {
        const payload = JSON.parse(raw) as DragPayload
        if (payload.tabId === p.tabId && payload.side !== p.side) p.onDropItems(payload.names)
      } catch {
        /* not ours */
      }
      return
    }
    if (p.side === 'remote' && e.dataTransfer.files.length > 0) {
      p.onDropOsFiles(Array.from(e.dataTransfer.files))
    }
  }

  const singleSel = p.sel.size === 1
  return (
    <div className={`pane ${dragOver ? 'drag-over' : ''} ${p.connected ? '' : 'pane-disabled'}`}>
      <div className="pane-head">
        <span className="pane-title">{p.title}</span>
        <form
          className="path-form"
          onSubmit={(e) => {
            e.preventDefault()
            p.onNavigate(pathInput)
          }}
        >
          <input
            className="input path-input"
            value={pathInput}
            spellCheck={false}
            onChange={(e) => setPathInput(e.target.value)}
          />
        </form>
      </div>
      <div className="pane-tools">
        <button className="btn btn-sm" onClick={p.onUp} disabled={p.atRoot} title="Parent directory">
          ↑ Up
        </button>
        <button className="btn btn-sm" onClick={p.onRefresh} title="Refresh">
          ⟳
        </button>
        <button className="btn btn-sm" onClick={p.onMkdir} title="Create directory">
          + Folder
        </button>
        <button className="btn btn-sm" onClick={p.onRename} disabled={!singleSel} title="Rename selected">
          Rename
        </button>
        <button className="btn btn-sm" onClick={p.onDelete} disabled={p.sel.size === 0} title="Delete selected">
          Delete
        </button>
        <span className="pane-tools-spacer" />
        <button
          className="btn btn-primary btn-sm"
          onClick={p.onTransfer}
          disabled={p.sel.size === 0}
          title={p.transferLabel}
        >
          {p.transferLabel}
        </button>
      </div>
      <div
        className="pane-body"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {p.data.error && (
          <div className="pane-error">
            {p.data.error}{' '}
            <button className="btn btn-sm" onClick={p.onRefresh}>
              Retry
            </button>
          </div>
        )}
        <table className="files">
          <thead>
            <tr>
              <th>Name</th>
              <th className="col-size">Size</th>
              <th className="col-date">Modified</th>
            </tr>
          </thead>
          <tbody>
            {!p.atRoot && (
              <tr className="updir" onDoubleClick={p.onUp}>
                <td colSpan={3}>
                  <span className="fi dir" />..
                </td>
              </tr>
            )}
            {p.data.entries.map((e) => (
              <tr
                key={e.name}
                className={p.sel.has(e.name) ? 'selected' : ''}
                draggable
                onClick={(ev) => select(ev, e.name)}
                onDoubleClick={() => p.onOpen(e)}
                onDragStart={(ev) => {
                  const names = p.sel.has(e.name) ? [...p.sel] : [e.name]
                  ev.dataTransfer.setData(
                    'application/x-openterm',
                    JSON.stringify({ tabId: p.tabId, side: p.side, names } satisfies DragPayload)
                  )
                }}
              >
                <td>
                  <span className={`fi ${e.type}`} />
                  {e.name}
                </td>
                <td className="col-size">{e.type === 'dir' ? '—' : formatBytes(e.size)}</td>
                <td className="col-date">{formatDate(e.mtime)}</td>
              </tr>
            ))}
            {p.data.entries.length === 0 && !p.data.loading && !p.data.error && (
              <tr className="empty-row">
                <td colSpan={3}>Empty directory</td>
              </tr>
            )}
          </tbody>
        </table>
        {p.data.loading && <div className="pane-loading">Loading…</div>}
      </div>
    </div>
  )
}

export function FilesTab({ tab, active }: { tab: Tab; active: boolean }): React.JSX.Element {
  const paths = useStore((s) => s.filesPaths[tab.id])
  const setFilesPaths = useStore((s) => s.setFilesPaths)
  const promptText = useStore((s) => s.promptText)
  const [local, setLocal] = useState<PaneData>({ entries: [], loading: false })
  const [remote, setRemote] = useState<PaneData>({ entries: [], loading: false })
  const [localSel, setLocalSel] = useState<Set<string>>(new Set())
  const [remoteSel, setRemoteSel] = useState<Set<string>>(new Set())

  const connected = tab.status === 'connected'
  const localPath = paths?.localPath ?? ''
  const remotePath = paths?.remotePath ?? '/'

  const loadLocal = useCallback(async (path: string): Promise<void> => {
    setLocal((prev) => ({ ...prev, loading: true }))
    const res = await window.bridge.local.list(path)
    setLocal({
      entries: res.ok && res.entries ? sortEntries(res.entries) : [],
      error: res.ok ? undefined : res.error,
      loading: false
    })
    setLocalSel(new Set())
  }, [])

  const loadRemote = useCallback(
    async (path: string): Promise<void> => {
      setRemote((prev) => ({ ...prev, loading: true }))
      const res = await window.bridge.files.list(tab.id, path)
      setRemote({
        entries: res.ok && res.entries ? sortEntries(res.entries) : [],
        error: res.ok ? undefined : res.error,
        loading: false
      })
      setRemoteSel(new Set())
    },
    [tab.id]
  )

  useEffect(() => {
    if (connected && localPath) void loadLocal(localPath)
  }, [connected, localPath, loadLocal])
  useEffect(() => {
    if (connected) void loadRemote(remotePath)
  }, [connected, remotePath, loadRemote])

  // Refresh the destination pane when a transfer for this tab finishes.
  useEffect(
    () =>
      onTransferDone(tab.id, (direction) => {
        if (direction === 'upload') void loadRemote(useStore.getState().filesPaths[tab.id]?.remotePath ?? '/')
        else void loadLocal(useStore.getState().filesPaths[tab.id]?.localPath ?? '')
      }),
    [tab.id, loadLocal, loadRemote]
  )

  const queueUpload = (names: string[]): void => {
    for (const name of names) {
      const e = local.entries.find((x) => x.name === name)
      if (!e || e.type === 'link') continue
      enqueueTransfer(tab.id, {
        direction: 'upload',
        name,
        isDir: e.type === 'dir',
        size: e.size,
        localPath: localJoin(localPath, name),
        remotePath: remoteJoin(remotePath, name)
      })
    }
  }

  const queueDownload = (names: string[]): void => {
    for (const name of names) {
      const e = remote.entries.find((x) => x.name === name)
      if (!e || e.type === 'link') continue
      enqueueTransfer(tab.id, {
        direction: 'download',
        name,
        isDir: e.type === 'dir',
        size: e.size,
        localPath: localJoin(localPath, name),
        remotePath: remoteJoin(remotePath, name)
      })
    }
  }

  const dropOsFiles = async (files: File[]): Promise<void> => {
    for (const f of files) {
      const path = window.bridge.pathForFile(f)
      if (!path) continue
      const st = await window.bridge.local.stat(path)
      if (!st.ok) continue
      enqueueTransfer(tab.id, {
        direction: 'upload',
        name: f.name,
        isDir: !!st.isDir,
        size: st.size ?? 0,
        localPath: path,
        remotePath: remoteJoin(remotePath, f.name)
      })
    }
  }

  const mkdir = async (side: Side): Promise<void> => {
    const name = await promptText({ title: 'New folder', label: 'Folder name', submitLabel: 'Create' })
    if (!name) return
    if (side === 'local') {
      const res = await window.bridge.local.mkdir(localJoin(localPath, name))
      if (!res.ok) window.alert(res.error)
      void loadLocal(localPath)
    } else {
      const res = await window.bridge.files.mkdir(tab.id, remoteJoin(remotePath, name))
      if (!res.ok) window.alert(res.error)
      void loadRemote(remotePath)
    }
  }

  const rename = async (side: Side): Promise<void> => {
    const sel = side === 'local' ? localSel : remoteSel
    const old = [...sel][0]
    if (!old) return
    const next = await promptText({ title: 'Rename', label: 'New name', initial: old, submitLabel: 'Rename' })
    if (!next || next === old) return
    if (side === 'local') {
      const res = await window.bridge.local.rename(localJoin(localPath, old), localJoin(localPath, next))
      if (!res.ok) window.alert(res.error)
      void loadLocal(localPath)
    } else {
      const res = await window.bridge.files.rename(
        tab.id,
        remoteJoin(remotePath, old),
        remoteJoin(remotePath, next)
      )
      if (!res.ok) window.alert(res.error)
      void loadRemote(remotePath)
    }
  }

  const removeSelected = async (side: Side): Promise<void> => {
    const sel = side === 'local' ? localSel : remoteSel
    const entries = side === 'local' ? local.entries : remote.entries
    if (sel.size === 0) return
    if (!window.confirm(`Delete ${sel.size} item(s)? This cannot be undone.`)) return
    for (const name of sel) {
      const e = entries.find((x) => x.name === name)
      if (!e) continue
      const res =
        side === 'local'
          ? await window.bridge.local.remove(localJoin(localPath, name), e.type === 'dir')
          : await window.bridge.files.remove(tab.id, remoteJoin(remotePath, name), e.type === 'dir')
      if (!res.ok) window.alert(res.error)
    }
    side === 'local' ? void loadLocal(localPath) : void loadRemote(remotePath)
  }

  const showBanner = tab.status === 'error' || tab.status === 'disconnected'
  return (
    <div className={`files-wrap tab-view ${active ? '' : 'view-hidden'}`}>
      {showBanner && (
        <div className="session-banner">
          <span className="dot dot-disconnected" />
          <span className="banner-text">
            {tab.message ?? (tab.status === 'error' ? 'Connection error' : 'Disconnected')}
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => reconnectTab(tab.id)}>
            Reconnect
          </button>
        </div>
      )}
      {tab.status === 'connecting' && (
        <div className="session-banner">
          <span className="dot dot-connecting" />
          <span className="banner-text">Connecting to {tab.host}…</span>
        </div>
      )}
      <div className="panes">
        <Pane
          tabId={tab.id}
          side="local"
          title="Local"
          path={localPath}
          data={local}
          sel={localSel}
          setSel={setLocalSel}
          atRoot={isLocalRoot(localPath)}
          connected={true}
          transferLabel="Upload →"
          onNavigate={(p) => setFilesPaths(tab.id, { localPath: p })}
          onUp={() => setFilesPaths(tab.id, { localPath: localParent(localPath) })}
          onRefresh={() => void loadLocal(localPath)}
          onOpen={(e) => {
            if (e.type === 'dir') setFilesPaths(tab.id, { localPath: localJoin(localPath, e.name) })
            else queueUpload([e.name])
          }}
          onMkdir={() => void mkdir('local')}
          onRename={() => void rename('local')}
          onDelete={() => void removeSelected('local')}
          onTransfer={() => queueUpload([...localSel])}
          onDropItems={(names) => queueDownload(names)}
          onDropOsFiles={() => undefined}
        />
        <Pane
          tabId={tab.id}
          side="remote"
          title={`Remote · ${tab.host}`}
          path={remotePath}
          data={remote}
          sel={remoteSel}
          setSel={setRemoteSel}
          atRoot={isRemoteRoot(remoteParent(remotePath)) && remotePath === '/'}
          connected={connected}
          transferLabel="← Download"
          onNavigate={(p) => setFilesPaths(tab.id, { remotePath: p })}
          onUp={() => setFilesPaths(tab.id, { remotePath: remoteParent(remotePath) })}
          onRefresh={() => void loadRemote(remotePath)}
          onOpen={(e) => {
            if (e.type === 'dir') setFilesPaths(tab.id, { remotePath: remoteJoin(remotePath, e.name) })
            else queueDownload([e.name])
          }}
          onMkdir={() => void mkdir('remote')}
          onRename={() => void rename('remote')}
          onDelete={() => void removeSelected('remote')}
          onTransfer={() => queueDownload([...remoteSel])}
          onDropItems={(names) => queueUpload(names)}
          onDropOsFiles={(files) => void dropOsFiles(files)}
        />
      </div>
      <TransferQueue tabId={tab.id} />
    </div>
  )
}
