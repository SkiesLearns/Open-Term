<div align="center">

# OpenTerm

**An open-source SSH terminal + FTP/SFTP file-transfer client in one desktop app.**

Manage many connections at once, browse and move files in a dual-pane view, and keep your
saved servers encrypted on disk — all in a clean, dark, keyboard-friendly window.

Built with Electron · React · TypeScript · xterm.js

![protocols](https://img.shields.io/badge/protocols-SSH%20%7C%20SFTP%20%7C%20FTP%20%7C%20FTPS-ff6223)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-272c36)
![license](https://img.shields.io/badge/license-MIT-272c36)

</div>

---

## What it is

OpenTerm puts an **SSH terminal client** and an **FTP/SFTP file manager** in the same window,
so you can open a shell and move files to the same box (or a dozen different ones) without
juggling separate apps. Every connection lives in its own tab and runs independently — closing
or losing one never drops the others.

It's free, MIT-licensed, and made to be self-hosted: clone it, run it, fork it, rebrand it.
The display name is even a setting.

## Features

- 🖥️ **Multiple SSH terminals** — full xterm-compatible shells (256 colors, resize, scrollback,
  Ctrl-key sequences, copy/paste) — as many tabs as you want, each its own live connection.
- 📁 **SFTP / FTP / FTPS file transfers** — dual-pane local ⇄ remote browser with upload,
  download, rename, delete, mkdir, drag-and-drop between panes, and a per-tab transfer queue
  with live progress and throughput.
- 🗂️ **Connection manager** — sidebar of saved servers with folder groups, quick search, and
  one-click connect. Edit and delete inline.
- 🔐 **Encrypted credentials** — passwords and key passphrases are encrypted at rest with your
  OS keychain (DPAPI on Windows, Keychain on macOS, libsecret on Linux). Secrets never touch
  the UI layer, are never logged, and never hit disk in plaintext. Saving a password is optional
  per server — leave it off and you'll be prompted at connect time.
- 🔄 **Resilient sessions** — clear connected / connecting / disconnected status per tab, a
  one-click reconnect, and human-readable errors for bad hosts, auth failures and dropped links.
- ⚙️ **Make it yours** — rename the app from the in-app Settings dialog; theme the whole UI by
  editing six CSS variables.

## Quick start (run from source)

You need **[Node.js 18+](https://nodejs.org/)**. No native build tools or compilers required.

```bash
# 1. Clone
git clone https://github.com/SkiesLearns/Open-Term.git
cd Open-Term

# 2. Install dependencies
npm install

# 3. Run it
npm run dev      # development mode with hot reload
# — or —
npm run start    # build once, then launch the built app
```

That's it — the app window opens. Click **+ New connection**, pick a protocol, enter your host
and credentials, and hit **Save & Connect**.

## Build a standalone app (no Node needed to run)

Package it into a double-clickable installer / executable:

```bash
npm run dist       # → installers in release/
npm run dist:dir   # → unpacked app folder only (fastest, for a quick test)
```

On Windows this produces two files in `release/`:

| File | What it is |
|------|------------|
| `OpenTerm-Setup-<version>.exe` | One-click installer (per-user, no admin needed) |
| `OpenTerm-Portable-<version>.exe` | Single portable executable — run from anywhere, no install |

> For macOS or Linux builds, run `npx electron-builder --mac` or `--linux` **on that platform**.
> The binaries are unsigned, so Windows SmartScreen / macOS Gatekeeper may warn on first launch —
> choose *Run anyway* / right-click → *Open*, or sign them with your own certificate.

## Try it without a real server

Two tiny throwaway servers are bundled so you can test the app on `localhost`:

```bash
npm run dev:ssh-server   # SSH echo shell   → 127.0.0.1:2222   (user: test  pass: test)
npm run dev:ftp-server   # FTP file server  → 127.0.0.1:2121   (user: test  pass: test)
```

Add them in the app via **+ New** and connect. *(The SSH dev server is an echo shell only — for
SFTP testing, point the app at any real `sshd`.)*

## Handy shortcuts

| Action | Shortcut |
|--------|----------|
| Copy / paste in terminal | `Ctrl+Shift+C` / `Ctrl+Shift+V` (or right-click) |
| Interrupt (sent to shell) | `Ctrl+C` |
| Navigate file pane | double-click a folder, or edit the path bar and press Enter |
| Transfer files | select + *Upload → / ← Download*, double-click a file, or drag between panes |

## Tech stack

| Layer | Choice |
|-------|--------|
| App shell | Electron |
| UI | React + TypeScript, Zustand for state |
| Terminal | xterm.js (+ fit & web-links addons) |
| SSH / SFTP | `ssh2`, `ssh2-sftp-client` |
| FTP / FTPS | `basic-ftp` |
| Packaging | electron-vite + electron-builder |

All network I/O runs in the Electron main process and is exposed to the UI through a single
context-isolated, typed bridge — the renderer never gets Node or raw socket access.

## Contributing

Issues and pull requests are welcome. To get going: `npm install`, then `npm run dev`.
Run `npm run typecheck` before opening a PR (strict TypeScript across main, preload and renderer).

## License

[MIT](../LICENSE) — do whatever you like, just keep the copyright notice. © OpenTerm contributors.
