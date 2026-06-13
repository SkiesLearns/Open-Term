import { useEffect, useRef, useState } from 'react'
import { useStore, type ModalState } from '../store'

type PromptState = Extract<NonNullable<ModalState>, { kind: 'prompt' }>

export function PromptModal({ modal }: { modal: PromptState }): React.JSX.Element {
  const closeModal = useStore((s) => s.closeModal)
  const [value, setValue] = useState(modal.initial ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const finish = (v: string | null): void => {
    modal.resolve(v)
    closeModal()
  }

  return (
    <div className="overlay" onMouseDown={() => finish(null)}>
      <div className="modal modal-sm" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{modal.title}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            finish(value)
          }}
        >
          <label className="field">
            <span>{modal.label}</span>
            <input
              ref={inputRef}
              className="input"
              type={modal.password ? 'password' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') finish(null)
              }}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => finish(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {modal.submitLabel ?? 'OK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
