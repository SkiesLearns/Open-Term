import { useStore } from '../store'

export function TabBar(): React.JSX.Element {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const closeTab = useStore((s) => s.closeTab)
  const openServerModal = useStore((s) => s.openServerModal)

  return (
    <div className="tabbar">
      <div className="tabs">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`tab ${t.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
            onAuxClick={(e) => {
              if (e.button === 1) closeTab(t.id)
            }}
            title={`${t.protocol.toUpperCase()} · ${t.host} · ${t.status}`}
          >
            <span className={`dot dot-${t.status}`} />
            <span className="tab-kind">{t.kind === 'ssh' ? '❯_' : '⇅'}</span>
            <span className="tab-title">{t.title}</span>
            <button
              className="tab-close"
              title="Close tab"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(t.id)
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button className="tab-new" title="New connection" onClick={() => openServerModal()}>
        +
      </button>
    </div>
  )
}
