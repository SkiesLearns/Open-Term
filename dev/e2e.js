// Driven by OT_SCRIPT (dev only): exercises save/connect/type/transfer flows.
// Run the dev servers first:  npm run dev:ssh-server  /  npm run dev:ftp-server
;(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const { useStore, connect, transfers } = window.__app
  // Repo root, derived from the built renderer's file:// URL.
  const ROOT = decodeURIComponent(location.pathname)
    .replace(/^\//, '')
    .replace(/\/out\/renderer\/.*$/, '')
    .replace(/\//g, '\\')
  const out = { steps: [], root: ROOT }
  try {
    // Start clean so reruns don't accumulate duplicate saved servers.
    for (const s of await window.bridge.servers.list()) await window.bridge.servers.remove(s.id)
    const a = await window.bridge.servers.save({
      name: 'Dev SSH', protocol: 'ssh', host: '127.0.0.1', port: 2222,
      username: 'test', group: 'Local', authType: 'password', savePassword: true, password: 'test'
    })
    const b = await window.bridge.servers.save({
      name: 'Dev FTP', protocol: 'ftp', host: '127.0.0.1', port: 2121,
      username: 'test', group: 'Local', authType: 'password', savePassword: true, password: 'test'
    })
    out.steps.push(`saved ssh=${a.ok} ftp=${b.ok}`)
    await useStore.getState().loadServers()
    const servers = useStore.getState().servers

    await connect.connectSaved(servers.find((s) => s.name === 'Dev SSH'))
    await sleep(2200)
    const sshTab = useStore.getState().tabs.find((t) => t.kind === 'ssh')
    window.bridge.ssh.input(sshTab.id, 'hello\r')
    await sleep(500)
    window.bridge.ssh.input(sshTab.id, 'colors\r')
    await sleep(700)
    out.steps.push('typed into ssh terminal')

    await connect.connectSaved(servers.find((s) => s.name === 'Dev FTP'))
    await sleep(2200)
    const ftpTab = useStore.getState().tabs.find((t) => t.kind === 'files')
    useStore.getState().setFilesPaths(ftpTab.id, { localPath: ROOT + '\\dev\\tmp' })
    await sleep(700)

    transfers.enqueueTransfer(ftpTab.id, {
      direction: 'download', name: 'sample.bin', isDir: false, size: 524288,
      localPath: ROOT + '\\dev\\tmp\\downloaded-sample.bin',
      remotePath: '/sample.bin'
    })
    transfers.enqueueTransfer(ftpTab.id, {
      direction: 'upload', name: 'upload-test.txt', isDir: false, size: 0,
      localPath: ROOT + '\\dev\\tmp\\upload-test.txt',
      remotePath: '/upload-test.txt'
    })
    await sleep(3000)

    const st = useStore.getState()
    out.tabs = st.tabs.map((t) => ({ kind: t.kind, title: t.title, status: t.status, message: t.message }))
    out.transfers = st.transfers.map((t) => ({
      name: t.name, dir: t.direction, status: t.status, error: t.error,
      transferred: t.transferred, size: t.size
    }))
  } catch (err) {
    out.error = String((err && err.stack) || err)
  }
  return out
})()
