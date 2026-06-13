import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { connectAdhoc, openTabForServer } from '../connect'
import type { AdhocParams, AuthType, Protocol, PublicServer, ServerInput } from '../../../shared/types'

const PORT_DEFAULTS: Record<Protocol, number> = { ssh: 22, sftp: 22, ftp: 21, ftps: 21 }
const PROTOCOLS: { value: Protocol; label: string; hint: string }[] = [
  { value: 'ssh', label: 'SSH', hint: 'terminal' },
  { value: 'sftp', label: 'SFTP', hint: 'files' },
  { value: 'ftp', label: 'FTP', hint: 'files' },
  { value: 'ftps', label: 'FTPS', hint: 'files · TLS' }
]

export function ServerModal({ editing }: { editing?: PublicServer }): React.JSX.Element {
  const closeModal = useStore((s) => s.closeModal)
  const loadServers = useStore((s) => s.loadServers)
  const secureAvailable = useStore((s) => s.secureAvailable)
  const servers = useStore((s) => s.servers)

  const [protocol, setProtocol] = useState<Protocol>(editing?.protocol ?? 'ssh')
  const [name, setName] = useState(editing?.name ?? '')
  const [host, setHost] = useState(editing?.host ?? '')
  const [port, setPort] = useState(editing?.port ?? PORT_DEFAULTS[editing?.protocol ?? 'ssh'])
  const [portTouched, setPortTouched] = useState(!!editing)
  const [username, setUsername] = useState(editing?.username ?? '')
  const [group, setGroup] = useState(editing?.group ?? '')
  const [authType, setAuthType] = useState<AuthType>(editing?.authType ?? 'password')
  const [password, setPassword] = useState('')
  const [savePassword, setSavePassword] = useState(editing?.savePassword ?? true)
  const [keyPath, setKeyPath] = useState(editing?.privateKeyPath ?? '')
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)

  const groupOptions = useMemo(
    () => [...new Set(servers.map((s) => s.group).filter(Boolean))].sort(),
    [servers]
  )
  const keyAllowed = protocol === 'ssh' || protocol === 'sftp'
  const effectiveAuth: AuthType = keyAllowed ? authType : 'password'

  const pickProtocol = (p: Protocol): void => {
    setProtocol(p)
    if (!portTouched) setPort(PORT_DEFAULTS[p])
  }

  const validate = (): string | null => {
    if (!host.trim()) return 'Host is required'
    if (!port || port < 1 || port > 65535) return 'Port must be between 1 and 65535'
    if (protocol !== 'ftp' && protocol !== 'ftps' && !username.trim()) return 'Username is required'
    if (effectiveAuth === 'key' && !keyPath.trim()) return 'Choose a private key file'
    return null
  }

  const buildInput = (): ServerInput => ({
    id: editing?.id,
    name: name.trim() || `${username.trim() || 'anonymous'}@${host.trim()}`,
    protocol,
    host: host.trim(),
    port,
    username: username.trim(),
    group: group.trim(),
    authType: effectiveAuth,
    privateKeyPath: effectiveAuth === 'key' ? keyPath.trim() : undefined,
    savePassword: secureAvailable && savePassword,
    password: password || undefined,
    passphrase: passphrase || undefined
  })

  const buildParams = (): AdhocParams => ({
    protocol,
    host: host.trim(),
    port,
    username: username.trim(),
    authType: effectiveAuth,
    privateKeyPath: effectiveAuth === 'key' ? keyPath.trim() : undefined
  })

  const save = async (thenConnect: boolean): Promise<void> => {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    const res = await window.bridge.servers.save(buildInput())
    if (!res.ok || !res.server) {
      setError(res.error ?? 'Could not save server')
      return
    }
    await loadServers()
    closeModal()
    if (thenConnect) {
      openTabForServer(res.server, password || undefined, passphrase || undefined)
    }
  }

  const connectOnly = (): void => {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    closeModal()
    connectAdhoc(buildParams(), password || undefined, passphrase || undefined)
  }

  const browseKey = async (): Promise<void> => {
    const file = await window.bridge.dialog.pickFile()
    if (file) setKeyPath(file)
  }

  return (
    <div className="overlay" onMouseDown={closeModal}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{editing ? 'Edit server' : 'New connection'}</h2>

        <div className="proto-picker">
          {PROTOCOLS.map((p) => (
            <button
              key={p.value}
              className={`proto-option ${protocol === p.value ? 'active' : ''}`}
              onClick={() => pickProtocol(p.value)}
            >
              <span className="proto-option-label">{p.label}</span>
              <span className="proto-option-hint">{p.hint}</span>
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label className="field span-2">
            <span>Name</span>
            <input
              className="input"
              value={name}
              placeholder="My web server"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field span-2">
            <span>Group</span>
            <input
              className="input"
              value={group}
              placeholder="e.g. Production"
              list="group-options"
              onChange={(e) => setGroup(e.target.value)}
            />
            <datalist id="group-options">
              {groupOptions.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <label className="field span-3">
            <span>Host</span>
            <input
              className="input"
              value={host}
              placeholder="example.com or 192.168.1.10"
              spellCheck={false}
              onChange={(e) => setHost(e.target.value)}
            />
          </label>
          <label className="field span-1">
            <span>Port</span>
            <input
              className="input"
              type="number"
              value={port}
              min={1}
              max={65535}
              onChange={(e) => {
                setPortTouched(true)
                setPort(Number(e.target.value))
              }}
            />
          </label>
          <label className="field span-2">
            <span>Username</span>
            <input
              className="input"
              value={username}
              placeholder={protocol === 'ftp' || protocol === 'ftps' ? 'anonymous' : 'root'}
              spellCheck={false}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          {keyAllowed && (
            <div className="field span-2">
              <span>Authentication</span>
              <div className="seg">
                <button
                  className={`seg-option ${effectiveAuth === 'password' ? 'active' : ''}`}
                  onClick={() => setAuthType('password')}
                >
                  Password
                </button>
                <button
                  className={`seg-option ${effectiveAuth === 'key' ? 'active' : ''}`}
                  onClick={() => setAuthType('key')}
                >
                  Private key
                </button>
              </div>
            </div>
          )}

          {effectiveAuth === 'password' ? (
            <>
              <label className="field span-2">
                <span>Password</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  placeholder={editing?.hasPassword ? '•••••• (saved — leave blank to keep)' : ''}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="field-check span-2" title={secureAvailable ? '' : 'OS secure storage unavailable'}>
                <input
                  type="checkbox"
                  checked={secureAvailable && savePassword}
                  disabled={!secureAvailable}
                  onChange={(e) => setSavePassword(e.target.checked)}
                />
                <span>
                  Save password (encrypted with OS keychain)
                  {!secureAvailable && ' — unavailable on this system'}
                </span>
              </label>
            </>
          ) : (
            <>
              <label className="field span-3">
                <span>Private key file</span>
                <span className="input-row">
                  <input
                    className="input"
                    value={keyPath}
                    placeholder="C:\Users\you\.ssh\id_ed25519"
                    spellCheck={false}
                    onChange={(e) => setKeyPath(e.target.value)}
                  />
                  <button className="btn" onClick={() => void browseKey()}>
                    Browse…
                  </button>
                </span>
              </label>
              <label className="field span-1">
                <span>Passphrase</span>
                <input
                  className="input"
                  type="password"
                  value={passphrase}
                  placeholder={editing?.hasPassphrase ? '(saved)' : 'optional'}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </label>
              <label className="field-check span-4" title={secureAvailable ? '' : 'OS secure storage unavailable'}>
                <input
                  type="checkbox"
                  checked={secureAvailable && savePassword}
                  disabled={!secureAvailable}
                  onChange={(e) => setSavePassword(e.target.checked)}
                />
                <span>Save passphrase (encrypted with OS keychain)</span>
              </label>
            </>
          )}
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={closeModal}>
            Cancel
          </button>
          <span className="modal-actions-spacer" />
          <button className="btn" onClick={connectOnly}>
            Connect only
          </button>
          <button className="btn" onClick={() => void save(false)}>
            Save
          </button>
          <button className="btn btn-primary" onClick={() => void save(true)}>
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  )
}
