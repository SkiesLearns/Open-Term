import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

export function SettingsModal(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const saveSettings = useStore((s) => s.saveSettings)
  const closeModal = useStore((s) => s.closeModal)
  const [appName, setAppName] = useState(settings.appName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const save = async (): Promise<void> => {
    await saveSettings({ appName })
    closeModal()
  }

  return (
    <div className="overlay" onMouseDown={closeModal}>
      <div className="modal modal-sm" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <label className="field">
            <span>Application name</span>
            <input
              ref={inputRef}
              className="input"
              value={appName}
              maxLength={40}
              onChange={(e) => setAppName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeModal()
              }}
            />
          </label>
          <p className="field-hint">
            Shown in the title bar, taskbar and welcome screen. Leave as is or make it your own —
            this doesn’t rename the installed program on disk.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!appName.trim()}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
