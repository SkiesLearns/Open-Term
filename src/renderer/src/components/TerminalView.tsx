import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { registry } from '../terminalRegistry'
import { connectSsh, reconnectTab } from '../connect'
import type { Tab } from '../store'

const TERMINAL_THEME = {
  background: '#272c36',
  foreground: '#e9eaec',
  cursor: '#ff6223',
  cursorAccent: '#272c36',
  selectionBackground: 'rgba(255, 98, 35, 0.35)',
  black: '#3b4252',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#dcdfe4',
  brightBlack: '#5c6370',
  brightRed: '#e8848b',
  brightGreen: '#b5d99c',
  brightYellow: '#efd7a2',
  brightBlue: '#8cc6f5',
  brightMagenta: '#d8a1e6',
  brightCyan: '#7bc6d0',
  brightWhite: '#ffffff'
}

export function TerminalView({ tab, active }: { tab: Tab; active: boolean }): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const termRef = useRef<Terminal | null>(null)

  useEffect(() => {
    const host = hostRef.current!
    const term = new Terminal({
      fontFamily: '"Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 8000,
      theme: TERMINAL_THEME
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(host)
    fit.fit()

    term.onData((d) => window.bridge.ssh.input(tab.id, d))
    term.onResize(({ cols, rows }) => window.bridge.ssh.resize(tab.id, cols, rows))

    // Ctrl+Shift+C / Ctrl+Shift+V for copy/paste (plain Ctrl+C must reach the shell).
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
        const sel = term.getSelection()
        if (sel) void navigator.clipboard.writeText(sel)
        return false
      }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
        void navigator.clipboard.readText().then((t) => t && term.paste(t))
        return false
      }
      return true
    })
    // Right-click: copy selection if any, otherwise paste.
    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault()
      const sel = term.getSelection()
      if (sel) {
        void navigator.clipboard.writeText(sel)
        term.clearSelection()
      } else {
        void navigator.clipboard.readText().then((t) => t && term.paste(t))
      }
    }
    host.addEventListener('contextmenu', onContextMenu)

    const safeFit = (): void => {
      if (host.clientWidth > 0 && host.clientHeight > 0) fit.fit()
    }
    registry.set(tab.id, {
      write: (d) => term.write(d),
      fit: safeFit,
      focus: () => term.focus(),
      cols: () => term.cols,
      rows: () => term.rows,
      reset: () => term.reset(),
      raw: term
    })
    termRef.current = term
    fitRef.current = fit

    const ro = new ResizeObserver(safeFit)
    ro.observe(host)

    void connectSsh(tab.id, term.cols, term.rows)
    term.focus()

    return () => {
      ro.disconnect()
      host.removeEventListener('contextmenu', onContextMenu)
      registry.delete(tab.id)
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => {
        registry.get(tab.id)?.fit()
        termRef.current?.focus()
      })
    }
  }, [active, tab.id])

  const showBanner = tab.status === 'error' || tab.status === 'disconnected'
  return (
    <div className={`terminal-wrap tab-view ${active ? '' : 'view-hidden'}`}>
      {showBanner && (
        <div className="session-banner">
          <span className="dot dot-disconnected" />
          <span className="banner-text">
            {tab.message ?? (tab.status === 'error' ? 'Connection error' : 'Disconnected')}
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => reconnectTab(tab.id)}>
            Reconnect
          </button>
        </div>
      )}
      {tab.status === 'connecting' && (
        <div className="session-banner">
          <span className="dot dot-connecting" />
          <span className="banner-text">Connecting to {tab.host}…</span>
        </div>
      )}
      <div ref={hostRef} className="terminal-host" />
    </div>
  )
}
