/**
 * Live xterm.js instances keyed by tab/session id. Kept outside React
 * state because terminal objects are mutable and event-driven.
 */
export interface TerminalControl {
  write(data: Uint8Array | string): void
  fit(): void
  focus(): void
  cols(): number
  rows(): number
  reset(): void
  /** Underlying xterm Terminal — for debugging only. */
  raw: unknown
}

const terminals = new Map<string, TerminalControl>()

export const registry = {
  set: (id: string, ctl: TerminalControl): void => void terminals.set(id, ctl),
  get: (id: string): TerminalControl | undefined => terminals.get(id),
  delete: (id: string): void => void terminals.delete(id)
}
