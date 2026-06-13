// Tiny local SSH server for trying the app without a real host.
//   node dev/ssh-server.mjs        -> ssh://test:test@127.0.0.1:2222
// Provides an interactive echo shell (type `help`). No SFTP subsystem.
import { generateKeyPairSync } from 'crypto'
import ssh2 from 'ssh2'

const { Server } = ssh2
const PORT = Number(process.env.PORT ?? 2222)
const USER = 'test'
const PASS = 'test'

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' }
})

const server = new Server({ hostKeys: [privateKey] }, (client) => {
  console.log('[ssh] client connected')
  client
    .on('authentication', (ctx) => {
      if (ctx.method === 'password' && ctx.username === USER && ctx.password === PASS) ctx.accept()
      else if (ctx.method === 'none') ctx.reject(['password'])
      else ctx.reject()
    })
    .on('ready', () => {
      client.on('session', (accept) => {
        const session = accept()
        session.on('pty', (accept) => accept && accept())
        session.on('window-change', (accept) => accept && accept())
        session.on('shell', (accept) => {
          const stream = accept()
          const PROMPT = '\x1b[38;5;208mtest@local-dev\x1b[0m:\x1b[34m~\x1b[0m$ '
          let line = ''
          stream.write('\x1b[1mWelcome to the OpenTerm dev SSH server!\x1b[0m\r\n')
          stream.write('This is an echo shell. Try: help, hello, colors, exit\r\n\r\n' + PROMPT)
          stream.on('data', (data) => {
            for (const ch of data.toString('utf8')) {
              if (ch === '\r') {
                stream.write('\r\n')
                const cmd = line.trim()
                line = ''
                if (cmd === 'exit') {
                  stream.write('bye!\r\n')
                  stream.end()
                  return
                } else if (cmd === 'help') {
                  stream.write('commands: help, hello, colors, exit — anything else is echoed\r\n')
                } else if (cmd === 'hello') {
                  stream.write('\x1b[32mHello from the dev server :)\x1b[0m\r\n')
                } else if (cmd === 'colors') {
                  for (let i = 30; i <= 37; i++) stream.write(`\x1b[${i}m█ color ${i} \x1b[0m`)
                  stream.write('\r\n')
                } else if (cmd.length > 0) {
                  stream.write(`you said: ${cmd}\r\n`)
                }
                stream.write(PROMPT)
              } else if (ch === '\x7f' || ch === '\b') {
                if (line.length > 0) {
                  line = line.slice(0, -1)
                  stream.write('\b \b')
                }
              } else if (ch === '\x03') {
                line = ''
                stream.write('^C\r\n' + PROMPT)
              } else if (ch >= ' ') {
                line += ch
                stream.write(ch)
              }
            }
          })
        })
      })
    })
    .on('close', () => console.log('[ssh] client disconnected'))
    .on('error', (err) => console.log('[ssh] client error:', err.message))
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[ssh] dev server listening on 127.0.0.1:${PORT} (user: ${USER} / pass: ${PASS})`)
})
