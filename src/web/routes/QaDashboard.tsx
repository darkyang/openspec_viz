import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { api } from '../lib/api'
import type { ChangeSummary } from '../../shared/types'

/** QA 视图：三状态分组 + 失败 / 阻塞表带派生修复链。 */
export function QaDashboardRoute({ embedded = false }: { embedded?: boolean }) {
  const { data, loading, error, reload } = useFetch(() => api.overview(), [])
  useLiveEvents(() => reload())

  const buckets = useMemo(() => bucketize(data?.changes ?? []), [data])

  return (
    <div>
      {!embedded && (
        <>
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-2xl font-semibold">QA Dashboard</h1>
            <span className="text-sm text-zinc-500">测试用例 / 修复验证视图</span>
          </div>
          <p className="text-xs text-zinc-500 mb-5">
            对应主仓库 <code className="font-mono">doc/qa-tracking.md</code>。完整用例详见各 proposal「测试用例」章节。
          </p>
        </>
      )}

      {loading && <div className="text-zinc-400 text-sm">loading…</div>}
      {error && <div className="text-red-600 text-sm">error: {error.message}</div>}

      {data && (
        <>
          <SummaryCounts
            failed={buckets.failed.length}
            pending={buckets.pending.length}
            passed={buckets.passed.length}
          />

          {buckets.failed.length > 0 && (
            <Section title="失败 / 阻塞" tone="failed">
              <FailureTable rows={buckets.failed} byId={buckets.byId} />
            </Section>
          )}

          {buckets.pending.length > 0 && (
            <Section title="待测试" tone="pending">
              <PendingTable rows={buckets.pending} />
            </Section>
          )}

          {buckets.passed.length > 0 && (
            <Section title="已通过" tone="passed">
              <PassedTable rows={buckets.passed} />
            </Section>
          )}

          {buckets.failed.length === 0 && buckets.pending.length === 0 && buckets.passed.length === 0 && (
            <div className="text-zinc-400 text-sm">
              暂无可测试的变更（test_status: pending / passed / failed）。
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface Buckets {
  failed: ChangeSummary[]
  pending: ChangeSummary[]
  passed: ChangeSummary[]
  byId: Map<string, ChangeSummary>
}

function bucketize(changes: ChangeSummary[]): Buckets {
  const byId = new Map(changes.map((c) => [c.id, c]))
  const failed: ChangeSummary[] = []
  const pending: ChangeSummary[] = []
  const passed: ChangeSummary[] = []
  for (const c of changes) {
    if (c.archived) continue
    const fm = c.frontmatter
    if (!fm) continue
    const ts = fm.testStatus
    if (!ts || ts === 'n/a') continue
    if (ts === 'failed') failed.push(c)
    else if (ts === 'passed') passed.push(c)
    else if (ts === 'pending') pending.push(c)
  }
  return { failed, pending, passed, byId }
}

function SummaryCounts({ failed, pending, passed }: { failed: number; pending: number; passed: number }) {
  return (
    <div className="mb-5 flex items-center gap-4 text-sm">
      <CountChip color="red" count={failed} label="失败 / 阻塞" />
      <CountChip color="zinc" count={pending} label="待测试" />
      <CountChip color="emerald" count={passed} label="已通过" />
    </div>
  )
}

function CountChip({ color, count, label }: { color: 'red' | 'zinc' | 'emerald'; count: number; label: string }) {
  const dot = color === 'red' ? 'bg-red-500' : color === 'emerald' ? 'bg-emerald-500' : 'bg-zinc-400'
  return (
    <div className="flex items-center gap-1.5 text-zinc-700">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="font-mono">{count}</span>
      <span>{label}</span>
    </div>
  )
}

function Section({ title, tone, children }: { title: string; tone: 'failed' | 'pending' | 'passed'; children: React.ReactNode }) {
  const dot = tone === 'failed' ? 'bg-red-500' : tone === 'passed' ? 'bg-emerald-500' : 'bg-zinc-400'
  return (
    <section className="mb-8">
      <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {title}
      </h2>
      {children}
    </section>
  )
}

/* ─── 失败 / 阻塞 ─── */

function FailureTable({ rows, byId }: { rows: ChangeSummary[]; byId: Map<string, ChangeSummary> }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <Th>变更</Th>
            <Th>失败 TC</Th>
            <Th>派生修复</Th>
            <Th>当前状态</Th>
            <Th>Area</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((c) => {
            const fm = c.frontmatter!
            const failedTcs = Object.entries(fm.testResults ?? {})
              .filter(([, status]) => status === 'failed')
              .map(([tc]) => tc)
            const spawned = (fm.spawnedBugs ?? [])
              .map((id) => byId.get(id))
              .filter((x): x is ChangeSummary => x !== undefined)
            const orphanIds = (fm.spawnedBugs ?? []).filter((id) => !byId.has(id))
            const currentState = inferFailureState(spawned)
            return (
              <tr key={c.id}>
                <Td>
                  <Link to={`/changes/${c.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                    {c.id}
                  </Link>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {failedTcs.length === 0 && <span className="text-zinc-400 text-xs">—</span>}
                    {failedTcs.map((tc) => (
                      <span key={tc} className="font-mono text-xs px-1.5 py-0.5 rounded border bg-red-50 border-red-200 text-red-700">
                        ❌ {tc}
                      </span>
                    ))}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {spawned.map((s) => (
                      <Link
                        key={s.id}
                        to={`/changes/${s.id}`}
                        className="font-mono text-xs text-blue-600 hover:underline px-1.5 py-0.5 rounded bg-blue-50 border border-blue-100"
                      >
                        {s.id}
                      </Link>
                    ))}
                    {orphanIds.map((id) => (
                      <span key={id} className="font-mono text-xs text-zinc-400" title="派生 bug 不在 changes/ 下，可能未创建或已归档">
                        {id} (?)
                      </span>
                    ))}
                    {spawned.length === 0 && orphanIds.length === 0 && (
                      <span className="text-zinc-400 text-xs">awaiting triage</span>
                    )}
                  </div>
                </Td>
                <Td>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${stateChipCls(currentState)}`}>
                    {currentState}
                  </span>
                </Td>
                <Td>{fm.area && <span className="font-mono text-xs text-zinc-600">{fm.area}</span>}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function inferFailureState(spawned: ChangeSummary[]): string {
  if (spawned.length === 0) return 'awaiting triage'
  // 取第一个派生 bug 的生命周期最具代表性
  const first = spawned[0].frontmatter
  switch (first?.lifecycle) {
    case 'drafted':
      return 'bug drafted'
    case 'in-review':
      return 'bug in-review'
    case 'shipped':
      return 'bug shipped, awaiting retest'
    case 'reverted':
      return 'bug reverted'
    case 'blocked':
      return 'bug blocked'
    default:
      return 'bug ' + (first?.lifecycle ?? 'unknown')
  }
}

function stateChipCls(state: string): string {
  if (state.includes('drafted')) return 'bg-zinc-50 border-zinc-200 text-zinc-700'
  if (state.includes('in-review')) return 'bg-blue-50 border-blue-200 text-blue-700'
  if (state.includes('shipped')) return 'bg-amber-50 border-amber-200 text-amber-800'
  if (state.includes('reverted')) return 'bg-red-50 border-red-200 text-red-700'
  if (state.includes('blocked')) return 'bg-amber-50 border-amber-200 text-amber-800'
  if (state === 'awaiting triage') return 'bg-amber-50 border-amber-200 text-amber-800'
  return 'bg-zinc-50 border-zinc-200 text-zinc-600'
}

/* ─── 待测试 ─── */

function PendingTable({ rows }: { rows: ChangeSummary[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <Th>变更</Th>
            <Th>Area</Th>
            <Th>用例数</Th>
            <Th>fix_verified</Th>
            <Th>Lifecycle</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((c) => {
            const fm = c.frontmatter!
            const tcCount = Object.keys(fm.testResults ?? {}).length
            return (
              <tr key={c.id}>
                <Td>
                  <Link to={`/changes/${c.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                    {c.id}
                  </Link>
                  <div className="text-xs text-zinc-600 mt-0.5">{c.title}</div>
                </Td>
                <Td>{fm.area && <span className="font-mono text-xs text-zinc-600">{fm.area}</span>}</Td>
                <Td className="font-mono text-xs">{tcCount > 0 ? tcCount : '—'}</Td>
                <Td>
                  {fm.fixVerified && (
                    <span className="font-mono text-xs text-zinc-500">{fm.fixVerified}</span>
                  )}
                </Td>
                <Td>{fm.lifecycle && (
                  <span className="text-xs text-zinc-500 font-mono">{fm.lifecycle}</span>
                )}</Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── 已通过 ─── */

function PassedTable({ rows }: { rows: ChangeSummary[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <Th>变更</Th>
            <Th>Area</Th>
            <Th>用例数</Th>
            <Th>测试日期</Th>
            <Th>fix_verified</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((c) => {
            const fm = c.frontmatter!
            const tcCount = Object.keys(fm.testResults ?? {}).length
            return (
              <tr key={c.id}>
                <Td>
                  <Link to={`/changes/${c.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                    {c.id}
                  </Link>
                  <div className="text-xs text-zinc-600 mt-0.5">{c.title}</div>
                </Td>
                <Td>{fm.area && <span className="font-mono text-xs text-zinc-600">{fm.area}</span>}</Td>
                <Td className="font-mono text-xs">{tcCount > 0 ? tcCount : '—'}</Td>
                <Td className="font-mono text-xs text-zinc-500">{fm.date ?? '—'}</Td>
                <Td>
                  {fm.fixVerified && (
                    <span className="font-mono text-xs text-zinc-500">{fm.fixVerified}</span>
                  )}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── shared cells ─── */

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2 whitespace-nowrap">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>
}
