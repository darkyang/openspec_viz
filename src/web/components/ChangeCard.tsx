import { Link } from 'react-router-dom'
import type { ChangeSummary } from '../../shared/types'
import { WorkflowGraph, statusBadge } from './WorkflowGraph'

export function ChangeCard({ change }: { change: ChangeSummary }) {
  const badge = statusBadge(change.status)
  const doneCount = change.workflow.filter((n) => n.state === 'done').length
  const missingReq = change.workflow.filter((n) => n.state === 'missing-required').length

  return (
    <Link
      to={`/changes/${change.id}`}
      className="group block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] text-zinc-400 truncate">{change.id}</div>
          <div className="font-medium text-sm text-zinc-900 truncate">{change.title}</div>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls} whitespace-nowrap`}>
          {badge.label}
        </span>
      </div>

      <WorkflowGraph nodes={change.workflow} variant="compact" />

      <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-3 text-[11px] text-zinc-500">
        <span className="font-mono">
          tasks {change.taskProgress.done}/{change.taskProgress.total}
        </span>
        <span className="text-zinc-300">·</span>
        <span className="font-mono">
          {doneCount}/{change.workflow.length} nodes
        </span>
        {missingReq > 0 && (
          <>
            <span className="text-zinc-300">·</span>
            <span className="font-mono text-red-600">{missingReq} must missing</span>
          </>
        )}
      </div>
    </Link>
  )
}
