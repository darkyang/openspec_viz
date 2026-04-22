import { Link } from 'react-router-dom'
import type { RequirementSummary } from '../../shared/types'
import { statusBadge } from './WorkflowGraph'
import { UNGROUPED_ID } from '../../shared/types'

function Bar({ progress }: { progress: RequirementSummary['progress'] }) {
  const { byStatus, totalChanges } = progress
  if (totalChanges === 0) {
    return (
      <div className="h-2 rounded bg-zinc-100" title="no changes" />
    )
  }
  const segs: Array<{ key: string; count: number; cls: string }> = [
    { key: 'done', count: byStatus.done, cls: 'bg-emerald-400' },
    { key: 'in_progress', count: byStatus.in_progress, cls: 'bg-blue-400' },
    { key: 'incomplete', count: byStatus.incomplete, cls: 'bg-red-300' },
    { key: 'archived', count: byStatus.archived, cls: 'bg-zinc-300' },
  ]
  return (
    <div className="flex h-2 rounded overflow-hidden bg-zinc-100">
      {segs.map(
        (s) =>
          s.count > 0 && (
            <div
              key={s.key}
              className={s.cls}
              style={{ width: `${(s.count / totalChanges) * 100}%` }}
              title={`${s.key}: ${s.count}`}
            />
          )
      )}
    </div>
  )
}

export function RequirementCard({ requirement }: { requirement: RequirementSummary }) {
  const { id, title, description, progress, changeIds } = requirement
  const badge = statusBadge(progress.overallStatus)
  const taskText = progress.totalTasks > 0 ? `${progress.doneTasks}/${progress.totalTasks}` : '—'
  const nodeText = progress.totalNodes > 0 ? `${progress.doneNodes}/${progress.totalNodes}` : '—'

  return (
    <Link
      to={`/requirements/${encodeURIComponent(id)}`}
      className="group block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] text-zinc-400 truncate">
            {id === UNGROUPED_ID ? 'ungrouped' : id}
          </div>
          <div className="font-medium text-sm text-zinc-900 truncate">{title}</div>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls} whitespace-nowrap`}>
          {badge.label}
        </span>
      </div>

      {description && (
        <div className="text-xs text-zinc-500 line-clamp-2 mb-3">{description}</div>
      )}

      <Bar progress={progress} />

      <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-3 text-[11px] text-zinc-500">
        <span className="font-mono">
          {changeIds.length} change{changeIds.length === 1 ? '' : 's'}
        </span>
        <span className="text-zinc-300">·</span>
        <span className="font-mono">tasks {taskText}</span>
        <span className="text-zinc-300">·</span>
        <span className="font-mono">nodes {nodeText}</span>
      </div>
    </Link>
  )
}
