import type { ChangeStatus, Phase, WorkflowNode } from '../../shared/types'

interface Props {
  nodes: WorkflowNode[]
  variant: 'compact' | 'full'
}

const PHASE_LABEL: Record<Phase, string> = {
  requirement: '需求',
  design: '设计',
  implementation: '实施',
}

const PHASE_ORDER: Phase[] = ['requirement', 'design', 'implementation']

export function WorkflowGraph({ nodes, variant }: Props) {
  const byPhase = PHASE_ORDER.map((phase) => ({
    phase,
    nodes: nodes.filter((n) => n.phase === phase),
  }))

  if (variant === 'compact') {
    return (
      <div className="space-y-1.5">
        {byPhase.map(({ phase, nodes: ns }) => (
          <div key={phase} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-400 w-6">{PHASE_LABEL[phase]}</span>
            <div className="flex items-center gap-1">
              {ns.map((n) => (
                <NodeDot key={n.id} node={n} size="sm" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // full variant
  return (
    <div className="space-y-6">
      {byPhase.map(({ phase, nodes: ns }) => (
        <div key={phase}>
          <div className="text-xs font-medium text-zinc-500 mb-2">{PHASE_LABEL[phase]}阶段</div>
          <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
            {ns.map((n, i) => (
              <div key={n.id} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1 w-24">
                  <NodeDot node={n} size="md" />
                  <div className="text-[11px] text-center text-zinc-700 leading-tight">
                    {n.label}
                  </div>
                  {n.required && (
                    <div className="text-[9px] uppercase tracking-wider text-zinc-400">must</div>
                  )}
                </div>
                {i < ns.length - 1 && <div className="w-3 h-px bg-zinc-200 mt-3" />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function NodeDot({ node, size }: { node: WorkflowNode; size: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const ring = node.required ? 'ring-2 ring-offset-1' : ''
  const ringColor = node.state === 'missing-required' ? 'ring-red-200' : 'ring-zinc-200'

  let bg = ''
  let title = `${node.label}`
  if (node.state === 'done') {
    bg = 'bg-emerald-500'
    title += ' · 已完成'
  } else if (node.state === 'missing-required') {
    bg = 'bg-red-400'
    title += ' · 必填,缺失'
  } else {
    bg = 'bg-zinc-300'
    title += node.required ? ' · 必填' : ' · 可选'
  }

  if (node.count !== undefined && node.count > 0) {
    return (
      <div className="relative" title={`${title} · ${node.count} 次`}>
        <div className={`${dim} ${bg} rounded-full ${node.required ? ring + ' ' + ringColor : ''}`} />
        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold leading-none bg-zinc-900 text-white rounded-full px-1 py-0.5 min-w-[14px] text-center">
          {node.count}
        </span>
      </div>
    )
  }

  return (
    <div
      title={title}
      className={`${dim} ${bg} rounded-full ${node.required ? ring + ' ' + ringColor : ''}`}
    />
  )
}

export function statusBadge(status: ChangeStatus) {
  const map: Record<ChangeStatus, { label: string; cls: string }> = {
    incomplete: { label: 'incomplete', cls: 'bg-red-50 text-red-700 border-red-200' },
    in_progress: { label: 'in progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    done: { label: 'done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    archived: { label: 'archived', cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
  }
  return map[status]
}
