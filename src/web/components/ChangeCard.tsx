import { Link } from 'react-router-dom'
import type { ChangeSummary } from '../../shared/types'
import { WorkflowGraph, statusBadge } from './WorkflowGraph'

export function ChangeCard({ change }: { change: ChangeSummary }) {
  const badge = statusBadge(change.status)
  const doneCount = change.workflow.filter((n) => n.state === 'done').length
  const missingReq = change.workflow.filter((n) => n.state === 'missing-required').length
  const fm = change.frontmatter

  return (
    <Link
      to={`/changes/${change.id}`}
      className="group block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="font-mono text-[11px] text-zinc-400 truncate">{change.id}</div>
            {change.requirementId && (
              <span
                className="font-mono text-[10px] px-1 py-px rounded bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[140px]"
                title={`requirement: ${change.requirementId}`}
              >
                #{change.requirementId}
              </span>
            )}
            {fm?.type && (
              <span
                className={`font-mono text-[10px] px-1 py-px rounded border ${typeChipCls(fm.type)}`}
                title={`type: ${fm.type}`}
              >
                {fm.type}
              </span>
            )}
            {fm?.area && (
              <span
                className="font-mono text-[10px] px-1 py-px rounded bg-zinc-50 text-zinc-600 border border-zinc-200 truncate max-w-[120px]"
                title={`area: ${fm.area}`}
              >
                {fm.area}
              </span>
            )}
            {fm?.discoveredDuring && (
              <span
                className="font-mono text-[10px] px-1 py-px rounded bg-amber-50 text-amber-700 border border-amber-200"
                title={`派生自 ${fm.discoveredDuring}`}
              >
                ↑ 派生
              </span>
            )}
            {fm?.spawnedBugs && fm.spawnedBugs.length > 0 && (
              <span
                className="font-mono text-[10px] px-1 py-px rounded bg-rose-50 text-rose-700 border border-rose-200"
                title={`派生出 ${fm.spawnedBugs.length} 个 bug：${fm.spawnedBugs.join(', ')}`}
              >
                🐛 {fm.spawnedBugs.length}
              </span>
            )}
          </div>
          <div className="font-medium text-sm text-zinc-900 truncate">{change.title}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {fm?.testStatus && fm.testStatus !== 'pending' && fm.testStatus !== 'n/a' && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${testStatusDotCls(fm.testStatus)}`}
              title={`test_status: ${fm.testStatus}`}
            />
          )}
          {fm?.lifecycle && fm.lifecycle !== 'shipped' && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border ${lifecycleChipCls(fm.lifecycle)} whitespace-nowrap`}
              title={`lifecycle: ${fm.lifecycle}`}
            >
              {fm.lifecycle}
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls} whitespace-nowrap`}>
            {badge.label}
          </span>
        </div>
      </div>

      <WorkflowGraph nodes={change.workflow} variant="compact" />

      <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
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
        {fm?.effort && (
          <>
            <span className="text-zinc-300">·</span>
            <span className={`font-mono ${effortTextCls(fm.effort)}`}>effort: {fm.effort}</span>
          </>
        )}
        {fm?.risk && (
          <>
            <span className="text-zinc-300">·</span>
            <span className={`font-mono ${riskTextCls(fm.risk)}`}>risk: {fm.risk}</span>
          </>
        )}
      </div>
    </Link>
  )
}

function typeChipCls(type: string): string {
  if (type === 'fix') return 'bg-rose-50 border-rose-200 text-rose-700'
  if (type === 'tweak') return 'bg-violet-50 border-violet-200 text-violet-700'
  if (type === 'feature') return 'bg-sky-50 border-sky-200 text-sky-700'
  return 'bg-zinc-50 border-zinc-200 text-zinc-600'
}

function lifecycleChipCls(value: string): string {
  switch (value) {
    case 'in-review':
      return 'bg-blue-50 border-blue-200 text-blue-700'
    case 'drafted':
      return 'bg-zinc-50 border-zinc-200 text-zinc-600'
    case 'reverted':
      return 'bg-red-50 border-red-200 text-red-700'
    case 'blocked':
      return 'bg-amber-50 border-amber-200 text-amber-800'
    default:
      return 'bg-zinc-50 border-zinc-200 text-zinc-600'
  }
}

function testStatusDotCls(value: string): string {
  switch (value) {
    case 'failed':
      return 'bg-red-500'
    case 'passed':
      return 'bg-emerald-500'
    default:
      return 'bg-zinc-300'
  }
}

function riskTextCls(value: string): string {
  if (value === 'high') return 'text-red-600'
  if (value === 'medium') return 'text-amber-700'
  return 'text-zinc-500'
}

function effortTextCls(value: string): string {
  if (value === 'medium') return 'text-amber-700'
  return 'text-zinc-500'
}
