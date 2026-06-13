import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { BridgeAPI } from '../shared/api'

function listen<T>(channel: string) {
  return (cb: (p: T) => void): (() => void) => {
    const handler = (_e: unknown, p: T): void => cb(p)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

const api: BridgeAPI = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },
  servers: {
    list: () => ipcRenderer.invoke('servers:list'),
    save: (server) => ipcRenderer.invoke('servers:save', server),
    remove: (id) => ipcRenderer.invoke('servers:delete', id),
    secureAvailable: () => ipcRenderer.invoke('secure:available')
  },
  ssh: {
    connect: (req) => ipcRenderer.invoke('ssh:connect', req),
    input: (id, data) => ipcRenderer.send('ssh:input', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.send('ssh:resize', { id, cols, rows }),
    disconnect: (id) => ipcRenderer.invoke('ssh:disconnect', id)
  },
  files: {
    connect: (req) => ipcRenderer.invoke('files:connect', req),
    list: (sessionId, path) => ipcRenderer.invoke('files:list', { sessionId, path }),
    mkdir: (sessionId, path) => ipcRenderer.invoke('files:mkdir', { sessionId, path }),
    rename: (sessionId, from, to) => ipcRenderer.invoke('files:rename', { sessionId, from, to }),
    remove: (sessionId, path, isDir) => ipcRenderer.invoke('files:remove', { sessionId, path, isDir }),
    download: (sessionId, transferId, remotePath, localPath, isDir, size) =>
      ipcRenderer.invoke('files:download', { sessionId, transferId, remotePath, localPath, isDir, size }),
    upload: (sessionId, transferId, localPath, remotePath, isDir) =>
      ipcRenderer.invoke('files:upload', { sessionId, transferId, localPath, remotePath, isDir }),
    disconnect: (id) => ipcRenderer.invoke('files:disconnect', id)
  },
  local: {
    home: () => ipcRenderer.invoke('local:home'),
    list: (path) => ipcRenderer.invoke('local:list', path),
    stat: (path) => ipcRenderer.invoke('local:stat', path),
    mkdir: (path) => ipcRenderer.invoke('local:mkdir', path),
    rename: (from, to) => ipcRenderer.invoke('local:rename', { from, to }),
    remove: (path, isDir) => ipcRenderer.invoke('local:remove', { path, isDir })
  },
  dialog: {
    pickFile: () => ipcRenderer.invoke('dialog:pickFile')
  },
  events: {
    onSshData: listen('ssh:data'),
    onStatus: listen('session:status'),
    onProgress: listen('transfer:progress')
  },
  pathForFile: (file) => webUtils.getPathForFile(file),
  sep: process.platform === 'win32' ? '\\' : '/'
}

contextBridge.exposeInMainWorld('bridge', api)
