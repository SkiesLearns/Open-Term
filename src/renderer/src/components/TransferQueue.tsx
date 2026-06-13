import { useStore } from '../store'
import { formatBytes } from '../utils'

export function TransferQueue({ tabId }: { tabId: string }): React.JSX.Element | null {
  const transfers = useStore((s) => s.transfers)
  const clearFinished = useStore((s) => s.clearFinishedTransfers)
  const mine = transfers.filter((t) => t.tabId === tabId)
  if (mine.length === 0) return null

  const hasFinished = mine.some((t) => t.status === 'done' || t.status === 'error')

  return (
    <div className="transfer-queue">
      <div className="tq-head">
        <span className="tq-title">Transfers</span>
        {hasFinished && (
          <button className="btn btn-sm" onClick={() => clearFinished(tabId)}>
            Clear finished
          </button>
        )}
      </div>
      <div className="tq-list">
        {mine.map((t) => {
          const pct =
            t.status === 'done'
              ? 100
              : t.size > 0
                ? Math.min(100, Math.round((t.transferred / t.size) * 100))
                : 0
          const indeterminate = t.status === 'active' && (t.isDir || t.size === 0)
          return (
            <div key={t.id} className={`tq-item tq-${t.status}`}>
              <span className="tq-dir">{t.direction === 'upload' ? '↑' : '↓'}</span>
              <span className="tq-name" title={t.name}>
                {t.name}
                {t.isDir ? '/' : ''}
              </span>
              <span className="tq-progress">
                <span
                  className={`tq-bar ${indeterminate ? 'indeterminate' : ''}`}
                  style={indeterminate ? undefined : { width: `${pct}%` }}
                />
              </span>
              <span className="tq-status">
                {t.status === 'error'
                  ? (t.error ?? 'Failed')
                  : t.status === 'done'
                    ? 'Done'
                    : t.status === 'queued'
                      ? 'Queued'
                      : t.isDir
                        ? 'Copying folder…'
                        : `${formatBytes(t.transferred)} / ${formatBytes(t.size)} · ${pct}%`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
