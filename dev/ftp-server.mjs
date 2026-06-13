// Tiny local FTP server for trying the app without a real host.
//   node dev/ftp-server.mjs        -> ftp://test:test@127.0.0.1:2121
// Serves dev/tmp/ftp-root (created with a couple of sample files).
import { mkdirSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import ftpSrvPkg from 'ftp-srv'

const FtpSrv = ftpSrvPkg.FtpSrv ?? ftpSrvPkg
const PORT = Number(process.env.PORT ?? 2121)
const USER = 'test'
const PASS = 'test'

const root = join(dirname(fileURLToPath(import.meta.url)), 'tmp', 'ftp-root')
mkdirSync(join(root, 'docs'), { recursive: true })
writeFileSync(join(root, 'readme.txt'), 'Hello from the OpenTerm dev FTP server!\n')
writeFileSync(join(root, 'docs', 'notes.md'), '# Notes\n\nSample file for download tests.\n')
writeFileSync(join(root, 'sample.bin'), Buffer.alloc(512 * 1024, 7))

const server = new FtpSrv({
  url: `ftp://127.0.0.1:${PORT}`,
  pasv_url: '127.0.0.1',
  anonymous: false,
  greeting: 'OpenTerm dev FTP server'
})

server.on('login', ({ username, password }, resolve, reject) => {
  if (username === USER && password === PASS) resolve({ root })
  else reject(new Error('Invalid credentials'))
})

server.listen().then(() => {
  console.log(`[ftp] dev server listening on 127.0.0.1:${PORT} (user: ${USER} / pass: ${PASS})`)
  console.log(`[ftp] root: ${root}`)
})
