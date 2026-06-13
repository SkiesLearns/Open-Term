import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import type { AppSettings } from '../../shared/types'

/** App-wide preferences. Plain JSON in the user-data dir — never holds secrets. */
export const DEFAULT_SETTINGS: AppSettings = {
  appName: 'OpenTerm'
}

let cache: AppSettings | null = null

const filePath = (): string => join(app.getPath('userData'), 'settings.json')

export async function getSettings(): Promise<AppSettings> {
  if (cache) return cache
  try {
    const raw = JSON.parse(await fs.readFile(filePath(), 'utf8')) as Partial<AppSettings>
    cache = { ...DEFAULT_SETTINGS, ...sanitize(raw) }
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  cache = { ...current, ...sanitize(patch) }
  await fs.writeFile(filePath(), JSON.stringify(cache, null, 2))
  return cache
}

function sanitize(patch: Partial<AppSettings>): Partial<AppSettings> {
  const out: Partial<AppSettings> = {}
  if (typeof patch.appName === 'string') {
    const name = patch.appName.trim().slice(0, 40)
    if (name) out.appName = name
  }
  return out
}
