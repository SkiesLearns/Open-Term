import { useMemo } from 'react'
import { useStore } from '../store'
import { openGroup, openServer, serverCanSsh } from '../connect'
import type { PublicServer } from '../../../shared/types'

const UNGROUPED = 'Ungrouped'

function groupServers(servers: PublicServer[]): [string, PublicServer[]][] {
  const map = new Map<string, PublicServer[]>()
  for (const s of servers) {
    const g = s.group || UNGROUPED
    const list = map.get(g) ?? []
    list.push(s)
    map.set(g, list)
  }
  return [...map.entries()].sort((a, b) => {
    if (a[0] === UNGROUPED) return 1
    if (b[0] === UNGROUPED) return -1
    return a[0].localeCompare(b[0])
  })
}

function ProtoBadge({ server }: { server: PublicServer }): React.JSX.Element {
  return <span className={`proto proto-${server.protocol}`}>{server.protocol.toUpperCase()}</span>
}

/** Server-dashboard card: open SSH or FTP individually. */
function ServerCard({ server }: { server: PublicServer }): React.JSX.Element {
  const canSsh = serverCanSsh(server)
  return (
    <div className="dash-card">
      <div className="dash-card-head">
        <ProtoBadge server={server} />
        <div className="dash-card-info">
          <span className="dash-card-name">{server.name}</span>
          <span className="dash-card-host">
            {server.username ? `${server.username}@` : ''}
            {server.host}:{server.port}
          </span>
        </div>
      </div>
      <div className="dash-card-actions">
        <button
          className="btn btn-sm"
          disabled={!canSsh}
          title={canSsh ? 'Open SSH terminal' : 'This server has no SSH shell'}
          onClick={() => void openServer(server, 'ssh')}
        >
          SSH
        </button>
        <button
          className="btn btn-sm"
          title="Open file transfer"
          onClick={() => void openServer(server, 'files')}
        >
          FTP
        </button>
      </div>
    </div>
  )
}

/** Group-dashboard section: per-server and whole-group SSH / FTP / Both. */
function GroupSection({ name, servers }: { name: string; servers: PublicServer[] }): React.JSX.Element {
  const anySsh = servers.some(serverCanSsh)
  return (
    <div className="dash-group">
      <div className="dash-group-head">
        <span className="dash-group-name">{name}</span>
        <span className="dash-group-count">
          {servers.length} server{servers.length === 1 ? '' : 's'}
        </span>
        <span className="dash-group-spacer" />
        <span className="dash-open-label">Open all</span>
        <button className="btn btn-sm" disabled={!anySsh} onClick={() => void openGroup(servers, 'ssh')}>
          SSH
        </button>
        <button className="btn btn-sm" onClick={() => void openGroup(servers, 'files')}>
          FTP
        </button>
        <button
          className="btn btn-primary btn-sm"
          title="Open SSH + files for every server in this group"
          onClick={() => void openGroup(servers, 'both')}
        >
          Both
        </button>
      </div>
      <div className="dash-group-servers">
        {servers.map((s) => {
          const canSsh = serverCanSsh(s)
          return (
            <div key={s.id} className="dash-row">
              <ProtoBadge server={s} />
              <div className="dash-row-info">
                <span className="dash-row-name">{s.name}</span>
                <span className="dash-row-host">
                  {s.username ? `${s.username}@` : ''}
                  {s.host}:{s.port}
                </span>
              </div>
              <div className="dash-row-actions">
                <button
                  className="btn btn-sm"
                  disabled={!canSsh}
                  title={canSsh ? 'Open SSH terminal' : 'This server has no SSH shell'}
                  onClick={() => void openServer(s, 'ssh')}
                >
                  SSH
                </button>
                <button className="btn btn-sm" title="Open file transfer" onClick={() => void openServer(s, 'files')}>
                  FTP
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!canSsh}
                  title={canSsh ? 'Open SSH + files together' : 'No SSH shell on this server'}
                  onClick={() => void openServer(s, 'both')}
                >
                  Both
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Dashboard(): React.JSX.Element {
  const servers = useStore((s) => s.servers)
  const appName = useStore((s) => s.settings.appName)
  const dashboardTab = useStore((s) => s.dashboardTab)
  const setDashboardTab = useStore((s) => s.setDashboardTab)
  const openServerModal = useStore((s) => s.openServerModal)
  const groups = useMemo(() => groupServers(servers), [servers])

  return (
    <div className="dashboard">
      <header className="dash-head">
        <div className="dash-brand">
          <span className="dash-logo" />
          <div className="dash-brand-text">
            <h1>{appName}</h1>
            <p className="dash-sub">Your servers, terminals and file transfers in one place.</p>
          </div>
        </div>
        <div className="dash-head-right">
          <div className="dash-switch">
            <button
              className={dashboardTab === 'servers' ? 'active' : ''}
              onClick={() => setDashboardTab('servers')}
            >
              Servers
            </button>
            <button
              className={dashboardTab === 'groups' ? 'active' : ''}
              onClick={() => setDashboardTab('groups')}
            >
              Groups
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => openServerModal()}>
            + New connection
          </button>
        </div>
      </header>

      {servers.length === 0 ? (
        <div className="dash-empty">
          <div className="welcome-logo" />
          <h2>No servers yet</h2>
          <p>Add your first SSH or FTP connection to get started.</p>
          <button className="btn btn-primary" onClick={() => openServerModal()}>
            + New connection
          </button>
        </div>
      ) : dashboardTab === 'servers' ? (
        <>
          <p className="dash-hint">Open a connection — SSH terminal or FTP file transfer.</p>
          <div className="dash-grid">
            {servers.map((s) => (
              <ServerCard key={s.id} server={s} />
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="dash-hint">
            Open SSH, FTP, or both — for a single server or a whole group at once.
          </p>
          <div className="dash-groups">
            {groups.map(([name, list]) => (
              <GroupSection key={name} name={name} servers={list} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
