import type { FileEntry } from '../../shared/types'

export function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n
  let i = -1
  do {
    v /= 1024
    i++
  } while (v >= 1024 && i < units.length - 1)
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatDate(ms: number | null): string {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (x: number): string => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function sortEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1
    if (a.type !== 'dir' && b.type === 'dir') return 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  })
}

// ---- remote paths (always POSIX) ----

export function remoteJoin(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`
}

export function remoteParent(p: string): string {
  const norm = p.replace(/\/+$/, '')
  const i = norm.lastIndexOf('/')
  if (i <= 0) return '/'
  return norm.slice(0, i)
}

export function isRemoteRoot(p: string): boolean {
  return p.replace(/\/+$/, '') === ''
}

// ---- local paths (platform separator from preload) ----

const sep = (): string => window.bridge.sep

export function localJoin(dir: string, name: string): string {
  const s = sep()
  return dir.endsWith(s) ? dir + name : dir + s + name
}

export function localParent(p: string): string {
  const s = sep()
  const norm = p.length > 3 && p.endsWith(s) ? p.slice(0, -1) : p
  const i = norm.lastIndexOf(s)
  if (i < 0) return norm
  const parent = norm.slice(0, i)
  if (s === '\\' && parent.length === 2 && parent[1] === ':') return parent + '\\'
  return parent || s
}

export function isLocalRoot(p: string): boolean {
  const s = sep()
  if (s === '\\') return /^[a-zA-Z]:\\?$/.test(p)
  return p === '/'
}
