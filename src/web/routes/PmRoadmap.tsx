import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { api } from '../lib/api'
import type {
  RequirementRisk,
  RequirementStage,
  RequirementSummary,
} from '../../shared/types'
import { REQUIREMENT_STAGES, UNGROUPED_ID } from '../../shared/types'

/** PM 需求路线图（Kanban）：按 stage 分列，每张卡片展示需求的目标 + 进度 + 风险信号。 */
export function PmRoadmapRoute({ embedded = false }: { embedded?: boolean }) {
  const { data, loading, error, reload } = useFetch(() => api.requirements(), [])
  useLiveEvents(() => reload())

  const grouped = useMemo(
    () => groupByStage(data?.requirements ?? []),
    [data]
  )

  return (
    <div>
      {!embedded && (
        <>
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-2xl font-semibold">PM Roadmap</h1>
            <span className="text-sm text-zinc-500">需求按阶段视图（按时上线追踪）</span>
          </div>
          <p className="text-xs text-zinc-500 mb-5">
            每张卡片代表一个需求，按当前 stage 分列。红 / 黄圆点是延期风险信号，hover 看明细。
          </p>
        </>
      )}

      {loading && <div className="text-zinc-400 text-sm">loading…</div>}
      {error && <div className="text-red-600 text-sm">error: {error.message}</div>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {REQUIREMENT_STAGES.map((stage) => (
            <Column key={stage} stage={stage} requirements={grouped.get(stage) ?? []} />
          ))}
        </div>
      )}
    </div>
  )
}

function groupByStage(reqs: RequirementSummary[]): Map<RequirementStage, RequirementSummary[]> {
  const map = new Map<RequirementStage, RequirementSummary[]>()
  for (const stage of REQUIREMENT_STAGES) map.set(stage, [])

  for (const r of reqs) {
    if (r.id === UNGROUPED_ID) continue // 未归类不进 roadmap
    const stage = r.effectiveStage ?? 'planning'
    const arr = map.get(stage)!
    arr.push(r)
  }

  // 列内按 target_date 升序（无 date 排末尾）
  for (const [stage, list] of map) {
    list.sort((a, b) => {
      const da = a.meta?.targetDate ?? '9999-99-99'
      const db = b.meta?.targetDate ?? '9999-99-99'
      return da.localeCompare(db)
    })
    map.set(stage, list)
  }

  return map
}

function Column({ stage, requirements }: { stage: RequirementStage; requirements: RequirementSummary[] }) {
  const meta = stageMeta(stage)
  return (
    <div className="rounded-lg bg-zinc-100/60 p-3 min-h-[200px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
        <h2 className="text-sm font-semibold text-zinc-700">{meta.label}</h2>
        <span className="text-xs text-zinc-400 font-mono">{requirements.length}</span>
      </div>
      <div className="space-y-2">
        {requirements.map((r) => (
          <RequirementCard key={r.id} req={r} />
        ))}
        {requirements.length === 0 && (
          <div className="text-xs text-zinc-400 text-center py-6">空</div>
        )}
      </div>
    </div>
  )
}

function RequirementCard({ req }: { req: RequirementSummary }) {
  const m = req.meta
  const risks = req.risks ?? []
  const reds = risks.filter((r) => r.level === 'red')
  const yellows = risks.filter((r) => r.level === 'yellow')
  const hasAnyRisk = risks.length > 0

  const completion = req.progress.totalTasks > 0
    ? req.progress.doneTasks / req.progress.totalTasks
    : (req.progress.totalNodes > 0 ? req.progress.doneNodes / req.progress.totalNodes : 0)

  const dateInfo = m?.targetDate ? computeDateInfo(m.targetDate) : null

  return (
    <Link
      to={`/requirements/${req.id}`}
      className={`block rounded-md border bg-white p-3 hover:shadow-sm transition-all ${
        reds.length > 0
          ? 'border-red-300'
          : yellows.length > 0
          ? 'border-amber-200'
          : 'border-zinc-200'
      }`}
    >
      {/* header: title + risk dots */}
      <div className="flex items-start gap-2 mb-1">
        <div className="font-medium text-sm text-zinc-900 leading-tight flex-1 min-w-0">
          {req.title}
        </div>
        {hasAnyRisk && (
          <div className="flex items-center gap-0.5 shrink-0" title={summarizeRisks(risks)}>
            {reds.slice(0, 3).map((_, i) => (
              <span key={`r${i}`} className="w-1.5 h-1.5 rounded-full bg-red-500" />
            ))}
            {yellows.slice(0, 3 - Math.min(3, reds.length)).map((_, i) => (
              <span key={`y${i}`} className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            ))}
            {risks.length > 3 && (
              <span className="text-[10px] text-zinc-400 ml-0.5">+{risks.length - 3}</span>
            )}
          </div>
        )}
      </div>

      <div className="font-mono text-[11px] text-zinc-400 mb-2 truncate">{req.id}</div>

      {/* target line */}
      {(m?.targetDate || m?.targetVersion) && (
        <div className="flex items-center gap-2 text-xs mb-2">
          {m?.targetVersion && (
            <span className="font-mono px-1 py-px rounded bg-sky-50 text-sky-700 border border-sky-100">
              {m.targetVersion}
            </span>
          )}
          {dateInfo && (
            <span className={`font-mono ${dateInfo.cls}`}>
              {dateInfo.label}
            </span>
          )}
        </div>
      )}

      {/* progress bar */}
      <div className="mb-1">
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={progressBarCls(completion, hasAnyRisk)}
            style={{ width: `${Math.round(completion * 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1 text-[10px] text-zinc-500 font-mono">
          <span>{Math.round(completion * 100)}%</span>
          <span>
            {req.progress.doneTasks}/{req.progress.totalTasks} tasks · {req.changeIds.length} ch
          </span>
        </div>
      </div>

      {/* owner + risk summary footer */}
      {(m?.owner || hasAnyRisk) && (
        <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
          {m?.owner ? (
            <span className="text-zinc-600">@{m.owner}</span>
          ) : (
            <span />
          )}
          {hasAnyRisk && (
            <span className={reds.length > 0 ? 'text-red-600' : 'text-amber-700'}>
              {reds.length > 0 && `${reds.length} 红`}
              {reds.length > 0 && yellows.length > 0 && ' · '}
              {yellows.length > 0 && `${yellows.length} 黄`}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

function summarizeRisks(risks: RequirementRisk[]): string {
  return risks.map((r) => `[${r.level}] ${r.message}`).join('\n')
}

function progressBarCls(completion: number, hasAnyRisk: boolean): string {
  const base = 'h-full transition-all rounded-full'
  if (completion >= 1) return `${base} bg-emerald-500`
  if (hasAnyRisk) return `${base} bg-red-400`
  if (completion >= 0.5) return `${base} bg-blue-500`
  return `${base} bg-zinc-400`
}

function computeDateInfo(targetDate: string): { label: string; cls: string } {
  const target = new Date(targetDate + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return { label: targetDate, cls: 'text-zinc-500' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  let cls = 'text-zinc-500'
  let suffix = ''
  if (days < 0) {
    cls = 'text-red-600'
    suffix = ` · 已逾期 ${-days} 天`
  } else if (days <= 7) {
    cls = 'text-red-600'
    suffix = ` · ${days} 天`
  } else if (days <= 14) {
    cls = 'text-amber-700'
    suffix = ` · ${days} 天`
  } else {
    suffix = ` · ${days} 天`
  }
  return { label: `📅 ${targetDate}${suffix}`, cls }
}

function stageMeta(stage: RequirementStage): { label: string; dot: string } {
  switch (stage) {
    case 'planning':
      return { label: 'Planning', dot: 'bg-zinc-400' }
    case 'in-dev':
      return { label: 'In Dev', dot: 'bg-blue-500' }
    case 'in-test':
      return { label: 'In Test', dot: 'bg-amber-500' }
    case 'staged':
      return { label: 'Staged', dot: 'bg-violet-500' }
    case 'released':
      return { label: 'Released', dot: 'bg-emerald-500' }
  }
}
