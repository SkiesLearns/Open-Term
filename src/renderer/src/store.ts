import { create } from 'zustand'
import type { AdhocParams, AppSettings, Protocol, PublicServer, SessionState } from '../../shared/types'

/** Everything needed to (re)connect a tab. Secrets live only in renderer memory. */
export interface TabConnect {
  serverId?: string
  params?: AdhocParams
  password?: string
  passphrase?: string
}

export interface Tab {
  id: string
  kind: 'ssh' | 'files'
  protocol: Protocol
  title: string
  host: string
  status: SessionState
  message?: string
  connect: TabConnect
}

export interface Transfer {
  id: string
  tabId: string
  name: string
  direction: 'upload' | 'download'
  size: number
  transferred: number
  status: 'queued' | 'active' | 'done' | 'error'
  error?: string
  isDir: boolean
}

export type ModalState =
  | null
  | { kind: 'server'; editing?: PublicServer }
  | { kind: 'settings' }
  | {
      kind: 'prompt'
      title: string
      label: string
      password?: boolean
      initial?: string
      submitLabel?: string
      resolve: (value: string | null) => void
    }

interface AppState {
  settings: AppSettings
  servers: PublicServer[]
  secureAvailable: boolean
  tabs: Tab[]
  activeTabId: string | null
  transfers: Transfer[]
  filesPaths: Record<string, { localPath: string; remotePath: string }>
  modal: ModalState

  loadSettings: () => Promise<void>
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
  loadServers: () => Promise<void>
  setSecureAvailable: (v: boolean) => void
  addTab: (t: Tab) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTab: (id: string, patch: Partial<Omit<Tab, 'id' | 'connect'>>) => void
  patchTabConnect: (id: string, patch: Partial<TabConnect>) => void
  setFilesPaths: (id: string, patch: Partial<{ localPath: string; remotePath: string }>) => void
  addTransfer: (t: Transfer) => void
  updateTransfer: (id: string, patch: Partial<Transfer>) => void
  clearFinishedTransfers: (tabId: string) => void
  openServerModal: (editing?: PublicServer) => void
  openSettingsModal: () => void
  closeModal: () => void
  promptText: (opts: {
    title: string
    label: string
    password?: boolean
    initial?: string
    submitLabel?: string
  }) => Promise<string | null>
}

export const useStore = create<AppState>((set, get) => ({
  settings: { appName: 'OpenTerm' },
  servers: [],
  secureAvailable: false,
  tabs: [],
  activeTabId: null,
  transfers: [],
  filesPaths: {},
  modal: null,

  loadSettings: async () => {
    const settings = await window.bridge.settings.get()
    set({ settings })
  },
  saveSettings: async (patch) => {
    const settings = await window.bridge.settings.set(patch)
    set({ settings })
  },
  loadServers: async () => {
    const servers = await window.bridge.servers.list()
    set({ servers })
  },
  setSecureAvailable: (v) => set({ secureAvailable: v }),

  addTab: (t) => set((s) => ({ tabs: [...s.tabs, t], activeTabId: t.id })),

  closeTab: (id) => {
    const tab = get().tabs.find((x) => x.id === id)
    if (tab) {
      void (tab.kind === 'ssh' ? window.bridge.ssh.disconnect(id) : window.bridge.files.disconnect(id))
    }
    set((s) => {
      const idx = s.tabs.findIndex((x) => x.id === id)
      const tabs = s.tabs.filter((x) => x.id !== id)
      let activeTabId = s.activeTabId
      if (activeTabId === id) activeTabId = tabs[Math.min(Math.max(idx, 0), tabs.length - 1)]?.id ?? null
      const filesPaths = { ...s.filesPaths }
      delete filesPaths[id]
      return { tabs, activeTabId, filesPaths, transfers: s.transfers.filter((tr) => tr.tabId !== id) }
    })
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, patch) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  patchTabConnect: (id, patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, connect: { ...t.connect, ...patch } } : t))
    })),

  setFilesPaths: (id, patch) =>
    set((s) => {
      const prev = s.filesPaths[id] ?? { localPath: '', remotePath: '/' }
      return { filesPaths: { ...s.filesPaths, [id]: { ...prev, ...patch } } }
    }),

  addTransfer: (t) => set((s) => ({ transfers: [...s.transfers, t] })),

  updateTransfer: (id, patch) =>
    set((s) => ({ transfers: s.transfers.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  clearFinishedTransfers: (tabId) =>
    set((s) => ({
      transfers: s.transfers.filter(
        (t) => t.tabId !== tabId || (t.status !== 'done' && t.status !== 'error')
      )
    })),

  openServerModal: (editing) => set({ modal: { kind: 'server', editing } }),
  openSettingsModal: () => set({ modal: { kind: 'settings' } }),
  closeModal: () => set({ modal: null }),

  promptText: (opts) =>
    new Promise<string | null>((resolve) => set({ modal: { kind: 'prompt', ...opts, resolve } }))
}))
