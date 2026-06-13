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

function Welcome(): React.JSX.Element {
  const appName = useStore((s) => s.settings.appName)
  const openServerModal = useStore((s) => s.openServerModal)
  return (
    <div className="welcome">
      <div className="welcome-logo" />
      <h1>{appName}</h1>
      <p>SSH terminals and FTP/SFTP file transfers, side by side.</p>
      <button className="btn btn-primary" onClick={() => openServerModal()}>
        + New connection
      </button>
      <p className="welcome-hint">or pick a saved server from the sidebar</p>
    </div>
  )
}

export default function App(): React.JSX.Element {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const modal = useStore((s) => s.modal)
  const appName = useStore((s) => s.settings.appName)
  const openSettingsModal = useStore((s) => s.openSettingsModal)

  useEffect(() => {
    void useStore.getState().loadSettings()
    void useStore.getState().loadServers()
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
            {tabs.length === 0 && <Welcome />}
            {tabs.map((t) =>
              t.kind === 'ssh' ? (
                <TerminalView key={t.id} tab={t} active={t.id === activeTabId} />
              ) : (
                <FilesTab key={t.id} tab={t} active={t.id === activeTabId} />
              )
            )}
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
