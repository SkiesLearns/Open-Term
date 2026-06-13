import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { connectSaved } from '../connect'
import type { PublicServer } from '../../../shared/types'

function ServerRow({ server }: { server: PublicServer }): React.JSX.Element {
  const openServerModal = useStore((s) => s.openServerModal)
  const loadServers = useStore((s) => s.loadServers)

  const remove = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!window.confirm(`Delete saved server "${server.name}"?`)) return
    await window.bridge.servers.remove(server.id)
    await loadServers()
  }

  return (
    <div
      className="server-row"
      onClick={() => void connectSaved(server)}
      title={`Connect to ${server.username}@${server.host}:${server.port}`}
    >
      <span className={`proto proto-${server.protocol}`}>{server.protocol.toUpperCase()}</span>
      <span className="server-info">
        <span className="server-name">{server.name}</span>
        <span className="server-host">
          {server.username}@{server.host}:{server.port}
        </span>
      </span>
      <span className="server-actions">
        <button
          className="icon-btn"
          title="Edit"
          onClick={(e) => {
            e.stopPropagation()
            openServerModal(server)
          }}
        >
          ✎
        </button>
        <button className="icon-btn" title="Delete" onClick={(e) => void remove(e)}>
          ✕
        </button>
      </span>
    </div>
  )
}

export function Sidebar(): React.JSX.Element {
  const servers = useStore((s) => s.servers)
  const openServerModal = useStore((s) => s.openServerModal)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const { ungrouped, groups } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? servers.filter((s) =>
          [s.name, s.host, s.username, s.group].some((f) => f.toLowerCase().includes(q))
        )
      : servers
    const ungrouped = filtered.filter((s) => !s.group)
    const map = new Map<string, PublicServer[]>()
    for (const s of filtered) {
      if (!s.group) continue
      const list = map.get(s.group) ?? []
      list.push(s)
      map.set(s.group, list)
    }
    return { ungrouped, groups: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])) }
  }, [servers, query])

  const toggleGroup = (g: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="sidebar-title">Servers</span>
        <button className="btn btn-primary btn-sm" onClick={() => openServerModal()}>
          + New
        </button>
      </div>
      <input
        className="input search"
        placeholder="Search servers…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="server-list">
        {ungrouped.map((s) => (
          <ServerRow key={s.id} server={s} />
        ))}
        {groups.map(([name, list]) => (
          <div key={name} className="server-group">
            <button className="group-head" onClick={() => toggleGroup(name)}>
              <span className={`chev ${collapsed.has(name) ? '' : 'open'}`}>▸</span>
              {name}
              <span className="group-count">{list.length}</span>
            </button>
            {!collapsed.has(name) && list.map((s) => <ServerRow key={s.id} server={s} />)}
          </div>
        ))}
        {servers.length === 0 && (
          <p className="sidebar-empty">No saved servers yet. Click “+ New” to add one.</p>
        )}
        {servers.length > 0 && ungrouped.length === 0 && groups.length === 0 && (
          <p className="sidebar-empty">No servers match “{query}”.</p>
        )}
      </div>
    </aside>
  )
}
