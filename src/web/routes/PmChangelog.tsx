import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { api } from '../lib/api'
import type { ChangeSummary } from '../../shared/types'

/** PM 变更流水视图：按月聚合的 CHANGELOG-like 表格。父变更 + └─ 缩进的派生 bug。
 *  这是工程视角的「都做了什么」。要看「需求按时上线吗」走 PmRoadmap。 */
export function PmChangelogRoute({ embedded = false }: { embedded?: boolean }) {
  const { data, loading, error, reload } = useFetch(() => api.overview(), [])
  useLiveEvents(() => reload())

  const grouped = useMemo(() => groupByMonth(data?.changes ?? []), [data])

  return (
    <div>
      {!embedded && (
        <>
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-2xl font-semibold">PM Changelog</h1>
            <span className="text-sm text-zinc-500">按月聚合的工程变更日志（变更视角）</span>
          </div>
          <p className="text-xs text-zinc-500 mb-5">
            对应主仓库 <code className="font-mono">doc/CHANGELOG.md</code>。完整 proposal 详见每行链接。
          </p>
        </>
      )}

      {loading && <div className="text-zinc-400 text-sm">loading…</div>}
      {error && <div className="text-red-600 text-sm">error: {error.message}</div>}

      {grouped.map(({ key, label, rows }) => (
        <section key={key} className="mb-8">
          <h2 className="text-lg font-medium mb-3 flex items-baseline gap-2">
            <span>{label}</span>
            <span className="text-xs text-zinc-400">{rows.length} 条</span>
          </h2>
          <PmTable rows={rows} />
        </section>
      ))}

      {grouped.length === 0 && data && (
        <div className="text-zinc-400 text-sm">
          暂无含 frontmatter 的变更。新建 fix-* / tweak-* 变更后会出现在这里。
        </div>
      )}
    </div>
  )
}

interface PmRow {
  change: ChangeSummary
  depth: 0 | 1 // 0 = parent, 1 = derivative bug
}

interface MonthGroup {
  key: string // YYYY-MM 或 'no-date'
  label: string
  rows: PmRow[]
}

function groupByMonth(changes: ChangeSummary[]): MonthGroup[] {
  // 仅含 frontmatter 的 active changes
  const eligible = changes.filter((c) => !c.archived && c.frontmatter)

  // 索引：按 id 找 change（用于父子关系拼接）
  const byId = new Map(eligible.map((c) => [c.id, c]))

  // 父子映射：parentId → derivative children
  const childrenOf = new Map<string, ChangeSummary[]>()
  const isChild = new Set<string>()
  for (const c of eligible) {
    const parent = c.frontmatter?.discoveredDuring
    if (parent && byId.has(parent)) {
      isChild.add(c.id)
      const arr = childrenOf.get(parent) ?? []
      arr.push(c)
      childrenOf.set(parent, arr)
    }
  }

  // 顶层条目（非派生 bug）+ 孤儿派生（discoveredDuring 指向不存在的 change）
  const topLevel = eligible.filter((c) => !isChild.has(c.id))

  // 按 YYYY-MM 分组（顶层条目）
  const monthMap = new Map<string, ChangeSummary[]>()
  for (const c of topLevel) {
    const date = c.frontmatter?.date
    const key = date ? date.slice(0, 7) : 'no-date'
    const arr = monthMap.get(key) ?? []
    arr.push(c)
    monthMap.set(key, arr)
  }

  // 月份按 desc 排序，'no-date' 放最后
  const sortedKeys = [...monthMap.keys()].sort((a, b) => {
    if (a === 'no-date') return 1
    if (b === 'no-date') return -1
    return b.localeCompare(a)
  })

  return sortedKeys.map((key) => {
    const parents = (monthMap.get(key) ?? []).slice().sort((a, b) => {
      // 同月内按 date desc
      const da = a.frontmatter?.date ?? ''
      const db = b.frontmatter?.date ?? ''
      return db.localeCompare(da)
    })
    const rows: PmRow[] = []
    for (const p of parents) {
      rows.push({ change: p, depth: 0 })
      const children = childrenOf.get(p.id) ?? []
      for (const child of children) {
        rows.push({ change: child, depth: 1 })
      }
    }
    return {
      key,
      label: key === 'no-date' ? '无日期' : key,
      rows,
    }
  })
}

function PmTable({ rows }: { rows: PmRow[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <Th>日期</Th>
            <Th>变更</Th>
            <Th>Summary</Th>
            <Th>Area</Th>
            <Th>Effort</Th>
            <Th>Risk</Th>
            <Th>Lifecycle</Th>
            <Th>Test</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map(({ change, depth }) => (
            <PmRow key={change.id} change={change} depth={depth} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PmRow({ change, depth }: PmRow) {
  const fm = change.frontmatter
  const date = fm?.date ?? ''
  const dayPart = date.length >= 10 ? date.slice(5, 10) : date
  return (
    <tr className={depth === 1 ? 'bg-zinc-50/50' : ''}>
      <Td className="font-mono text-xs text-zinc-500">{dayPart}</Td>
      <Td className="font-mono text-xs">
        {depth === 1 && <span className="text-zinc-400 mr-1">└─</span>}
        <Link to={`/changes/${change.id}`} className="text-blue-600 hover:underline">
          {change.id}
        </Link>
      </Td>
      <Td className="text-zinc-700">
        {depth === 1 && <span className="text-rose-600 mr-1">派生 bug：</span>}
        {change.title}
      </Td>
      <Td>{fm?.area && <span className="font-mono text-xs text-zinc-600">{fm.area}</span>}</Td>
      <Td>{fm?.effort && <Pill label={fm.effort} cls={effortCls(fm.effort)} />}</Td>
      <Td>{fm?.risk && <Pill label={fm.risk} cls={riskCls(fm.risk)} />}</Td>
      <Td>{fm?.lifecycle && <Pill label={fm.lifecycle} cls={lifecycleCls(fm.lifecycle)} />}</Td>
      <Td>{fm?.testStatus && fm.testStatus !== 'pending' && (
        <Pill label={fm.testStatus} cls={testStatusCls(fm.testStatus)} />
      )}</Td>
    </tr>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2 whitespace-nowrap">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>
}

function Pill({ label, cls }: { label: string; cls: string }) {
  return <span className={`text-xs px-1.5 py-0.5 rounded border whitespace-nowrap ${cls}`}>{label}</span>
}

function effortCls(value: string): string {
  if (value === 'medium') return 'bg-amber-50 border-amber-200 text-amber-800'
  if (value === 'small') return 'bg-blue-50 border-blue-200 text-blue-700'
  return 'bg-zinc-50 border-zinc-200 text-zinc-600'
}

function riskCls(value: string): string {
  if (value === 'high') return 'bg-red-50 border-red-200 text-red-700'
  if (value === 'medium') return 'bg-amber-50 border-amber-200 text-amber-800'
  return 'bg-emerald-50 border-emerald-200 text-emerald-700'
}

function lifecycleCls(value: string): string {
  switch (value) {
    case 'shipped':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700'
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

function testStatusCls(value: string): string {
  switch (value) {
    case 'failed':
      return 'bg-red-50 border-red-200 text-red-700'
    case 'passed':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    default:
      return 'bg-zinc-50 border-zinc-200 text-zinc-500'
  }
}
