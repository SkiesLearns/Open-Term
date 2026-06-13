import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { useStore } from './store'
import * as connect from './connect'
import * as transfers from './transfers'
import { registry } from './terminalRegistry'

// Debug handle for devtools and scripted UI testing (OT_SCRIPT).
;(window as unknown as Record<string, unknown>).__app = { useStore, connect, transfers, registry }

createRoot(document.getElementById('root')!).render(<App />)
