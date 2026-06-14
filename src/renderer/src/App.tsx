import { useEffect } from 'react'
import { useStore } from './store'
import { registry } from './terminalRegistry'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { TerminalView } from './components/TerminalView'
import { FilesTab } from './components/FilesTab'
import { StatusBar } from './components/StatusBar'
import { ServerModal } from './components/ServerModal'
import { PromptModal } from './components/PromptModal'
import { SettingsModal } from './components/SettingsModal'
import { Dashboard } from './components/Dashboard'

export default function App(): React.JSX.Element {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const showDashboard = useStore((s) => s.showDashboard)
  const modal = useStore((s) => s.modal)
  const appName = useStore((s) => s.settings.appName)
  const openSettingsModal = useStore((s) => s.openSettingsModal)

  useEffect(() => {
    void useStore.getState().loadSettings()
    void useStore.getState().loadServers()
    void useStore.getState().loadDrives()
    void window.bridge.servers.secureAvailable().then((v) => useStore.getState().setSecureAvailable(v))

    const offData = window.bridge.events.onSshData(({ id, data }) => registry.get(id)?.write(data))
    const offStatus = window.bridge.events.onStatus(({ id, state, message }) => {
      if (useStore.getState().tabs.some((t) => t.id === id)) {
        useStore.getState().updateTab(id, { status: state, message })
      }
    })
    const offProgress = window.bridge.events.onProgress(({ transferId, transferred, total }) => {
      useStore
        .getState()
        .updateTransfer(transferId, { transferred, ...(total > 0 ? { size: total } : {}) })
    })
    return () => {
      offData()
      offStatus()
      offProgress()
    }
  }, [])

  useEffect(() => {
    document.title = appName
  }, [appName])

  return (
    <>
      <div className="titlebar">
        <span className="titlebar-mark" />
        <span className="titlebar-name">{appName}</span>
        <span className="titlebar-spacer" />
        <button
          className="icon-btn titlebar-btn"
          title="Settings"
          onClick={() => openSettingsModal()}
        >
          ⚙
        </button>
      </div>
      <div className="app-body">
        <Sidebar />
        <div className="main">
          <TabBar />
          <div className="content">
            {tabs.map((t) =>
              t.kind === 'ssh' ? (
                <TerminalView key={t.id} tab={t} active={!showDashboard && t.id === activeTabId} />
              ) : (
                <FilesTab key={t.id} tab={t} active={!showDashboard && t.id === activeTabId} />
              )
            )}
            {(showDashboard || tabs.length === 0) && <Dashboard />}
          </div>
          <StatusBar />
        </div>
      </div>
      {modal?.kind === 'server' && <ServerModal editing={modal.editing} />}
      {modal?.kind === 'settings' && <SettingsModal />}
      {modal?.kind === 'prompt' && <PromptModal modal={modal} />}
    </>
  )
}
