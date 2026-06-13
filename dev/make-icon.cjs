// Renders the app icon to build/icon.png (256x256) using an offscreen
// Electron window. Run with:  npx electron dev/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const html = `<!doctype html><html><body style="margin:0;background:transparent">
  <div style="width:256px;height:256px;display:flex;align-items:center;justify-content:center">
    <div style="width:236px;height:236px;border-radius:58px;background:#272c36;
                border:10px solid #ff6223;box-sizing:border-box;
                display:flex;align-items:center;justify-content:center">
      <span style="font:700 92px Consolas,monospace;color:#ff6223;letter-spacing:-6px">&gt;_</span>
    </div>
  </div>
</body></html>`

app.disableHardwareAcceleration()
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  })
  win.webContents.once('did-finish-load', () => {
    setTimeout(async () => {
      const img = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 })
      const out = path.join(__dirname, '..', 'build', 'icon.png')
      fs.mkdirSync(path.dirname(out), { recursive: true })
      fs.writeFileSync(out, img.toPNG())
      console.log('icon written:', out, img.getSize())
      app.exit(0)
    }, 500)
  })
  void win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
})
