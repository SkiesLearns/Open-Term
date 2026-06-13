// Run after e2e.js (servers already saved): restart-restore + SSH independence + error handling.
;(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const { useStore, connect } = window.__app
  const out = {}
  try {
    await sleep(400) // let the initial loadServers() settle
    const servers = useStore.getState().servers
    out.restoredServers = servers.map((s) => `${s.name} (hasPassword=${s.hasPassword})`)

    const ssh = servers.find((s) => s.name === 'Dev SSH')
    await connect.connectSaved(ssh) // must use the stored encrypted password
    await sleep(2000)
    const tab1 = useStore.getState().tabs[0]
    window.bridge.ssh.input(tab1.id, 'hello\r')
    await sleep(400)
    window.bridge.ssh.input(tab1.id, 'colors\r')
    await sleep(400)
    window.bridge.ssh.input(tab1.id, 'help\r')
    await sleep(600)

    // Second independent SSH tab: type something only here.
    await connect.connectSaved(ssh)
    await sleep(1800)
    const tab2 = useStore.getState().tabs[1]
    window.bridge.ssh.input(tab2.id, 'this text belongs to tab two only\r')
    await sleep(500)

    // Error handling: connect to a dead port, expect an error tab.
    connect.connectAdhoc(
      { protocol: 'ssh', host: '127.0.0.1', port: 9, username: 'x', authType: 'password' },
      'x'
    )
    await sleep(2500)
    out.tabs = useStore.getState().tabs.map((t) => ({ title: t.title, status: t.status, message: t.message }))

    // Close the failed tab, leave tab 1 active for the screenshot.
    const failed = useStore.getState().tabs[2]
    if (failed) useStore.getState().closeTab(failed.id)
    useStore.getState().setActiveTab(tab1.id)
    await sleep(400)
    out.afterClose = useStore.getState().tabs.map((t) => ({ title: t.title, status: t.status }))
  } catch (err) {
    out.error = String((err && err.stack) || err)
  }
  return out
})()
