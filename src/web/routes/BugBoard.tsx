import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { api } from '../lib/api'
import type { ChangeSummary } from '../../shared/types'
import { UNGROUPED_ID } from '../../shared/types'

/**
 * 「问题」lens —— 按 requirement 聚合 bug / 失败用例,回答「哪个需求问题多 / 哪些问题属于同一需求」。
 * 纯前端:所需信号都已在 ChangeSummary.frontmatter(discoveredDuring / testResults / test_status /
 * lifecycle),配合 change 已归到 requirement,直接聚合即可。
 */

/** open ⟺ lifecycle 不是已交付/已终结。drafted/in-review/blocked/缺省 → 仍 open。 */
function isOpenLifecycle(lc?: string): boolean {
  return lc !== 'shipped' && lc !== 'reverted'
}

interface Problem {
  change: ChangeSummary
  isDerivedBug: boolean
  isTestFailed: boolean
  failedTcs: string[]
  open: boolean
}

interface ReqBugs {
  id: string
  title: string
  problems: Problem[]
  openCount: number
}

/** 一个成员 change 是否构成「问题」:派生 bug(discoveredDuring)或 测试失败。 */
function buildProblem(c: ChangeSummary): Problem | null {
  const fm = c.frontmatter
  if (!fm) return null
  const failedTcs = Object.entries(fm.testResults ?? {})
    .filter(([, v]) => v === 'failed')
    .map(([tc]) => tc)
  const isDerivedBug = !!fm.discoveredDuring
  const isTestFailed = fm.testStatus === 'failed' || failedTcs.length > 0
  if (!isDerivedBug && !isTestFailed) return null
  return { change: c, isDerivedBug, isTestFailed, failedTcs, open: isOpenLifecycle(fm.lifecycle) }
}

export function BugBoardRoute({ embedded = false }: { embedded?: boolean }) {
  const ov = useFetch(() => api.overview(), [])
  const rq = useFetch(() => api.requirements(), [])
  useLiveEvents(() => {
    ov.reload()
    rq.reload()
  })

  const { groups, totalOpen, totalProblems, cleanCount } = useMemo(() => {
    const changes = ov.data?.changes ?? []
    const reqs = rq.data?.requirements ?? []
    const titleById = new Map(reqs.map((r) => [r.id, r.title]))

    const byReq = new Map<string, ChangeSummary[]>()
    for (const c of changes) {
      if (c.archived) continue
      const key = c.requirementId ?? UNGROUPED_ID
      const arr = byReq.get(key)
      if (arr) arr.push(c)
      else byReq.set(key, [c])
    }

    const groups: ReqBugs[] = []
    for (const [id, cs] of byReq) {
      const problems = cs
        .map(buildProblem)
        .filter((p): p is Problem => p !== null)
        // open 在前,其次按 id 稳定
        .sort((a, b) => Number(b.open) - Number(a.open) || a.change.id.localeCompare(b.change.id))
      if (problems.length === 0) continue
      const openCount = problems.filter((p) => p.open).length
      const title = id === UNGROUPED_ID ? '未归类' : titleById.get(id) ?? id
      groups.push({ id, title, problems, openCount })
    }
    groups.sort(
      (a, b) =>
        b.openCount - a.openCount ||
        b.problems.length - a.problems.length ||
        a.title.localeCompare(b.title),
    )
    const totalOpen = groups.reduce((n, g) => n + g.openCount, 0)
    const totalProblems = groups.reduce((n, g) => n + g.problems.length, 0)
    // 「无问题的需求」数:声明过的 requirement(非 ungrouped)里不在 groups 的
    const buggy = new Set(groups.map((g) => g.id))
    const cleanCount = reqs.filter((r) => r.id !== UNGROUPED_ID && !buggy.has(r.id)).length
    return { groups, totalOpen, totalProblems, cleanCount }
  }, [ov.data, rq.data])

  return (
    <div>
      {!embedded && (
        <>
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-2xl font-semibold">问题</h1>
            <span className="text-sm text-zinc-500">按需求聚合 bug / 失败用例</span>
          </div>
          <p className="text-xs text-zinc-500 mb-5">
            自动把派生 bug(<span className="font-mono">discoveredDuring</span>)与测试失败按所属需求归并,
            一眼看哪个需求问题多、哪些问题属于同一需求。
          </p>
        </>
      )}

      {(ov.loading || rq.loading) && <div className="text-zinc-400 text-sm">loading…</div>}
      {ov.error && <div className="text-red-600 text-sm">error: {ov.error.message}</div>}

      {ov.data && (
        <>
          <div className="mb-5 flex items-center gap-4 text-sm">
            <CountChip color="red" count={totalOpen} label="未闭问题" />
            <CountChip color="zinc" count={totalProblems} label="问题总数" />
            <CountChip color="emerald" count={groups.length} label="涉及需求" />
          </div>

          {groups.length === 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
              暂无派生 bug 或失败用例 🎉
            </div>
          )}

          <div className="space-y-3">
            {groups.map((g) => (
              <ReqBugSection key={g.id} group={g} />
            ))}
          </div>

          {cleanCount > 0 && (
            <div className="mt-4 text-xs text-zinc-400">其余 {cleanCount} 个需求暂无记录的 bug / 失败用例。</div>
          )}
        </>
      )}
    </div>
  )
}

function ReqBugSection({ group }: { group: ReqBugs }) {
  const reqHref = `/requirements/${encodeURIComponent(group.id)}`
  return (
    <section className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
        <Link to={reqHref} className="font-medium text-sm text-zinc-900 hover:underline">
          {group.title}
        </Link>
        {group.openCount > 0 ? (
          <span className="text-[11px] px-1.5 py-0.5 rounded border bg-red-50 border-red-200 text-red-700">
            {group.openCount} 未闭
          </span>
        ) : (
          <span className="text-[11px] px-1.5 py-0.5 rounded border bg-emerald-50 border-emerald-200 text-emerald-700">
            已全部闭环
          </span>
        )}
        <span className="text-[11px] text-zinc-400 ml-auto font-mono">{group.problems.length} 条</span>
      </div>
      <ul className="divide-y divide-zinc-100">
        {group.problems.map((p) => (
          <ProblemRow key={p.change.id} problem={p} />
        ))}
      </ul>
    </section>
  )
}

function ProblemRow({ problem }: { problem: Problem }) {
  const { change: c, isDerivedBug, isTestFailed, failedTcs, open } = problem
  const parent = c.frontmatter?.discoveredDuring
  return (
    <li className={`px-4 py-2.5 flex items-start gap-2 text-sm ${open ? '' : 'opacity-60'}`}>
      <span
        className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${open ? 'bg-red-500' : 'bg-emerald-500'}`}
        title={open ? 'open' : 'fixed'}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            to={`/changes/${encodeURIComponent(c.id)}`}
            className="font-mono text-xs text-blue-600 hover:underline truncate"
          >
            {c.id}
          </Link>
          {isDerivedBug && (
            <span className="text-[10px] px-1 py-px rounded border bg-amber-50 border-amber-200 text-amber-800">
              派生 bug
            </span>
          )}
          {isTestFailed && (
            <span className="text-[10px] px-1 py-px rounded border bg-red-50 border-red-200 text-red-700">
              测试失败
            </span>
          )}
          <span
            className={`text-[10px] px-1 py-px rounded border ${
              open
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            {open ? 'open' : 'fixed'}
          </span>
        </div>
        <div className="text-zinc-700 truncate">{c.title}</div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px] text-zinc-400">
          {parent && (
            <span>
              派生自{' '}
              <Link to={`/changes/${encodeURIComponent(parent)}`} className="text-blue-600 hover:underline font-mono">
                {parent}
              </Link>
            </span>
          )}
          {failedTcs.length > 0 && (
            <span className="font-mono text-red-600">失败 {failedTcs.join(', ')}</span>
          )}
        </div>
      </div>
    </li>
  )
}

function CountChip({
  color,
  count,
  label,
}: {
  color: 'red' | 'zinc' | 'emerald'
  count: number
  label: string
}) {
  const dot = color === 'red' ? 'bg-red-500' : color === 'emerald' ? 'bg-emerald-500' : 'bg-zinc-400'
  return (
    <div className="flex items-center gap-1.5 text-zinc-700">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="font-mono">{count}</span>
      <span>{label}</span>
    </div>
  )
}
