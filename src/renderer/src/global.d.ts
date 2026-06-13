import type { BridgeAPI } from '../../shared/api'

declare global {
  interface Window {
    bridge: BridgeAPI
  }
}

export {}
