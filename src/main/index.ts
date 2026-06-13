import { app, BrowserWindow, shell } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { registerIpc, disposeAllSessions } from './ipc'

// Windows marks fully covered windows as occluded and stops producing frames,
// which freezes xterm rendering (rAF) while another app is on top of this one.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#272c36',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#272c36', symbolColor: '#ffffff', height: 38 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Terminals must keep rendering while the window is occluded/minimized,
      // otherwise xterm's rAF-driven renderer stalls until refocus.
      backgroundThrottling: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  setupDevHooks(win)
  return win
}

/**
 * Developer-only hooks (never active in packaged builds):
 *   OT_SCRIPT=<file>  run a JS file in the renderer after load (UI driving)
 *   OT_SHOT=<file>    write a PNG screenshot of the window
 *   OT_SHOT_DELAY=ms  delay before the screenshot (default 3000)
 */
function setupDevHooks(win: BrowserWindow): void {
  if (app.isPackaged) return
  const shot = process.env.OT_SHOT
  const script = process.env.OT_SCRIPT
  if (!shot && !script) return
  const toFront = (): void => {
    win.show()
    win.moveTop()
    win.focus()
  }
  win.webContents.once('did-finish-load', () => {
    void (async () => {
      toFront()
      if (script) {
        try {
          const result = await win.webContents.executeJavaScript(await fs.readFile(script, 'utf8'))
          console.log('[dev] OT_SCRIPT result:', JSON.stringify(result))
        } catch (err) {
          console.error('[dev] OT_SCRIPT failed:', err)
        }
      }
      if (shot) {
        const delay = Number(process.env.OT_SHOT_DELAY ?? 3000)
        setTimeout(() => {
          toFront()
          setTimeout(() => {
            void win.webContents.capturePage().then(async (img) => {
              await fs.writeFile(shot, img.toPNG())
              console.log('[dev] screenshot written:', shot)
            })
          }, 400)
        }, delay)
      }
    })()
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => disposeAllSessions())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
