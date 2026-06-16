import { Link, useParams } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { api } from '../lib/api'
import { ChangeCard } from '../components/ChangeCard'
import { MarkdownView } from '../components/MarkdownView'
import { statusBadge } from '../components/WorkflowGraph'
import { UNGROUPED_ID } from '../../shared/types'
import type { ChangeSummary } from '../../shared/types'

export function RequirementDetailRoute() {
  const { id = '' } = useParams<{ id: string }>()
  const { data, loading, error, reload } = useFetch(() => api.requirement(id), [id])
  useLiveEvents(() => reload())

  return (
    <div>
      <div className="text-sm text-zinc-500 mb-2">
        <Link to="/requirements" className="hover:text-zinc-900">
          ← Requirements
        </Link>
      </div>

      {loading && <div className="text-zinc-400 text-sm">loading…</div>}
      {error && <div className="text-red-600 text-sm">error: {error.message}</div>}

      {data && (
        <>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold">{data.title}</h1>
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded border ${
                statusBadge(data.progress.overallStatus).cls
              }`}
            >
              {statusBadge(data.progress.overallStatus).label}
            </span>
          </div>
          <div className="text-xs font-mono text-zinc-400 mb-4">
            {data.id === UNGROUPED_ID ? 'ungrouped' : data.id}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 mb-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <Metric label="changes" value={String(data.progress.totalChanges)} />
              <Metric
                label="by status"
                value={`${data.progress.byStatus.done} done · ${data.progress.byStatus.in_progress} ip · ${data.progress.byStatus.incomplete} inc${data.progress.byStatus.archived > 0 ? ` · ${data.progress.byStatus.archived} arc` : ''}`}
              />
              <Metric
                label="tasks"
                value={
                  data.progress.totalTasks > 0
                    ? `${data.progress.doneTasks}/${data.progress.totalTasks}`
                    : '—'
                }
              />
              <Metric
                label="workflow nodes"
                value={
                  data.progress.totalNodes > 0
                    ? `${data.progress.doneNodes}/${data.progress.totalNodes}`
                    : '—'
                }
              />
            </div>
          </div>

          {data.body && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5 mb-5">
              <MarkdownView content={data.body} filePath="requirement.md" />
            </div>
          )}

          <div className="mb-3 text-sm font-medium text-zinc-700">
            成员 changes{' '}
            <span className="text-xs text-zinc-400">({data.changes.length})</span>
          </div>
          {data.changes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
              尚无关联 change。给 proposal.md 加 frontmatter{' '}
              <span className="font-mono">requirement: {data.id}</span> 即可归入。
            </div>
          ) : (
            <MemberChanges changes={data.changes} />
          )}
        </>
      )}
    </div>
  )
}

const NO_AREA = '__noarea__'

/** 按 frontmatter.area 分桶，按桶大小降序（无 area 桶置末），让大桶（尤其 ungrouped 的 81 条）
 *  可按能力（cloud-sync / memory / recording …）扫读，而非一长串平铺。 */
function groupChangesByArea(
  changes: ChangeSummary[]
): { area: string; changes: ChangeSummary[] }[] {
  const buckets = new Map<string, ChangeSummary[]>()
  for (const c of changes) {
    const area = c.frontmatter?.area ?? NO_AREA
    const arr = buckets.get(area)
    if (arr) arr.push(c)
    else buckets.set(area, [c])
  }
  return [...buckets.entries()]
    .map(([area, cs]) => ({ area, changes: cs }))
    .sort((a, b) => {
      if (a.area === NO_AREA) return 1
      if (b.area === NO_AREA) return -1
      if (b.changes.length !== a.changes.length) return b.changes.length - a.changes.length
      return a.area.localeCompare(b.area)
    })
}

/** 成员 changes 渲染：area 有多种 → 按 area 分节；单一 / 无 area → 退化平铺（不加分组噪音）。 */
function MemberChanges({ changes }: { changes: ChangeSummary[] }) {
  const groups = groupChangesByArea(changes)
  if (groups.length <= 1) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {changes.map((c) => (
          <ChangeCard key={c.id} change={c} />
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.area}>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
              {g.area === NO_AREA ? '未标注 area' : g.area}
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">{g.changes.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.changes.map((c) => (
              <ChangeCard key={c.id} change={c} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-zinc-400 uppercase tracking-wide">{label}</div>
      <div className="font-mono text-sm text-zinc-800">{value}</div>
    </div>
  )
}
