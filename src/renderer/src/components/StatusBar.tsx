import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { formatSpeed } from '../utils'

const STATE_LABEL: Record<string, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Error'
}

export function StatusBar(): React.JSX.Element {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const transfers = useStore((s) => s.transfers)
  const filesPaths = useStore((s) => s.filesPaths)
  const tab = tabs.find((t) => t.id === activeTabId)

  const [speed, setSpeed] = useState(0)
  const sample = useRef({ bytes: 0, at: Date.now() })

  useEffect(() => {
    const iv = setInterval(() => {
      const sum = useStore.getState().transfers.reduce((a, t) => a + t.transferred, 0)
      const now = Date.now()
      const dt = (now - sample.current.at) / 1000
      setSpeed(dt > 0 ? Math.max(0, (sum - sample.current.bytes) / dt) : 0)
      sample.current = { bytes: sum, at: now }
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  const activeCount = transfers.filter((t) => t.status === 'active').length
  const queuedCount = transfers.filter((t) => t.status === 'queued').length
  const paths = tab && tab.kind === 'files' ? filesPaths[tab.id] : undefined

  return (
    <div className="statusbar">
      {tab ? (
        <>
          <span className={`dot dot-${tab.status}`} />
          <span className="status-state">{STATE_LABEL[tab.status]}</span>
          <span className="status-host">{tab.host}</span>
          {paths && (
            <span className="status-paths" title={`${paths.localPath}  ⇄  ${paths.remotePath}`}>
              {paths.localPath} ⇄ {paths.remotePath}
            </span>
          )}
        </>
      ) : (
        <span className="status-state muted">No active session</span>
      )}
      <span className="status-spacer" />
      {(activeCount > 0 || queuedCount > 0) && (
        <span className="status-transfers">
          {activeCount} active{queuedCount > 0 ? ` · ${queuedCount} queued` : ''} · {formatSpeed(speed)}
        </span>
      )}
    </div>
  )
}
