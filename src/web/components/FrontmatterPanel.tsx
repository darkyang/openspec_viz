import { Link } from 'react-router-dom'
import type { ChangeFrontmatter } from '../../shared/types'
import {
  lifecycleChipCls,
  riskChipCls,
  effortChipCls,
  fixVerifiedChipCls,
  typeChipCls,
} from '../lib/presentation'

/** 轻量级变更 frontmatter 信息面板：元数据 badges + 关系图 + TC 状态。 */
export function FrontmatterPanel({ frontmatter }: { frontmatter: ChangeFrontmatter }) {
  const fm = frontmatter
  const hasMeta = fm.type || fm.area || fm.lifecycle || fm.effort || fm.risk || fm.date || fm.commit
  const hasRelationship =
    fm.discoveredDuring ||
    (fm.spawnedBugs && fm.spawnedBugs.length > 0) ||
    (fm.affectsChanges && fm.affectsChanges.length > 0) ||
    (fm.fixesBugs && fm.fixesBugs.length > 0)
  const hasTcResults = fm.testResults && Object.keys(fm.testResults).length > 0

  if (!hasMeta && !hasRelationship && !hasTcResults) return null

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 mb-5 space-y-4">
      {hasMeta && <MetaStrip fm={fm} />}
      {hasRelationship && <RelationshipSection fm={fm} />}
      {hasTcResults && <TcResultsSection results={fm.testResults!} />}
    </div>
  )
}

/* ─── 元数据 strip ─── */

function MetaStrip({ fm }: { fm: ChangeFrontmatter }) {
  return (
    <div>
      <div className="text-xs font-medium text-zinc-500 mb-2">元数据</div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {fm.type && <Chip kind="type" label={fm.type} />}
        {fm.area && <Chip kind="area" label={fm.area} />}
        {fm.lifecycle && <Chip kind="lifecycle" label={fm.lifecycle} />}
        {fm.effort && <Chip kind="effort" label={`effort: ${fm.effort}`} />}
        {fm.risk && <Chip kind="risk" label={`risk: ${fm.risk}`} />}
        {fm.fixVerified && fm.fixVerified !== 'pending' && (
          <Chip kind="fixVerified" label={`fix_verified: ${fm.fixVerified}`} />
        )}
        {fm.date && <span className="text-zinc-500 font-mono">{fm.date}</span>}
        {fm.commit && fm.commit !== 'pending' && (
          <span className="text-zinc-500 font-mono" title="commit hash">
            {fm.commit.slice(0, 7)}
          </span>
        )}
      </div>
    </div>
  )
}

type ChipKind = 'type' | 'area' | 'lifecycle' | 'effort' | 'risk' | 'fixVerified'

function Chip({ kind, label }: { kind: ChipKind; label: string }) {
  const cls = chipClass(kind, label)
  return <span className={`px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>
}

function chipClass(kind: ChipKind, value: string): string {
  switch (kind) {
    case 'lifecycle':
      return lifecycleChipCls(value)
    case 'risk':
      return riskChipCls(value)
    case 'effort':
      return effortChipCls(value)
    case 'fixVerified':
      return fixVerifiedChipCls(value)
    case 'type':
      return typeChipCls(value)
    case 'area':
    default:
      return 'bg-zinc-50 border-zinc-200 text-zinc-600'
  }
}

/* ─── 关系 section ─── */

function RelationshipSection({ fm }: { fm: ChangeFrontmatter }) {
  return (
    <div>
      <div className="text-xs font-medium text-zinc-500 mb-2">关系</div>
      <div className="space-y-2 text-sm">
        {fm.discoveredDuring && (
          <RelationLine
            arrow="↑"
            label="起源"
            description={
              fm.discoveredInCases && fm.discoveredInCases.length > 0
                ? `测试 ${fm.discoveredInCases.join(', ')} 时发现`
                : '从父变更测试期间派生'
            }
          >
            <ChangeLink id={fm.discoveredDuring} />
          </RelationLine>
        )}
        {fm.spawnedBugs && fm.spawnedBugs.length > 0 && (
          <RelationLine arrow="↓" label="派生 bug" description={`${fm.spawnedBugs.length} 个`}>
            <span className="flex flex-wrap gap-1.5">
              {fm.spawnedBugs.map((b) => (
                <ChangeLink key={b} id={b} />
              ))}
            </span>
          </RelationLine>
        )}
        {fm.affectsChanges && fm.affectsChanges.length > 0 && (
          <RelationLine arrow="↪" label="影响" description="regression scope">
            <span className="flex flex-wrap gap-1.5">
              {fm.affectsChanges.map((c) => (
                <ChangeLink key={c} id={c} />
              ))}
            </span>
          </RelationLine>
        )}
        {fm.fixesBugs && fm.fixesBugs.length > 0 && (
          <RelationLine arrow="✓" label="修复了" description="先前 bug">
            <span className="flex flex-wrap gap-1.5">
              {fm.fixesBugs.map((b) => (
                <ChangeLink key={b} id={b} />
              ))}
            </span>
          </RelationLine>
        )}
      </div>
    </div>
  )
}

function RelationLine({
  arrow,
  label,
  description,
  children,
}: {
  arrow: string
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-zinc-400 w-4 text-center">{arrow}</span>
      <span className="text-zinc-600 font-medium w-16 shrink-0">{label}</span>
      <div className="flex-1 flex items-baseline gap-2">
        {children}
        {description && <span className="text-xs text-zinc-400">{description}</span>}
      </div>
    </div>
  )
}

function ChangeLink({ id }: { id: string }) {
  return (
    <Link
      to={`/changes/${id}`}
      className="font-mono text-blue-600 hover:underline px-1.5 py-0.5 rounded bg-blue-50 border border-blue-100"
    >
      {id}
    </Link>
  )
}

/* ─── TC 状态 section ─── */

function TcResultsSection({ results }: { results: Record<string, string> }) {
  // 按 TC-N 数字排序
  const sorted = Object.entries(results).sort(([a], [b]) => {
    const na = parseInt(a.replace(/\D/g, ''), 10) || 0
    const nb = parseInt(b.replace(/\D/g, ''), 10) || 0
    return na - nb
  })
  const counts = sorted.reduce<Record<string, number>>((acc, [, v]) => {
    acc[v] = (acc[v] ?? 0) + 1
    return acc
  }, {})
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="text-xs font-medium text-zinc-500">TC 状态</div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          {Object.entries(counts).map(([status, n]) => (
            <span key={status}>
              <span className={tcDotCls(status)}>●</span> {status}: {n}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map(([tc, status]) => (
          <span
            key={tc}
            className={`font-mono text-xs px-1.5 py-0.5 rounded border ${tcChipCls(status)}`}
            title={status}
          >
            <span className="mr-1">{tcIcon(status)}</span>
            {tc}
          </span>
        ))}
      </div>
    </div>
  )
}

function tcChipCls(status: string): string {
  switch (status) {
    case 'failed':
      return 'bg-red-50 border-red-200 text-red-700'
    case 'passed':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    case 'pending':
      return 'bg-zinc-50 border-zinc-200 text-zinc-500'
    case 'n/a':
      return 'bg-zinc-50 border-zinc-200 text-zinc-400'
    default:
      return 'bg-zinc-50 border-zinc-200 text-zinc-500'
  }
}

function tcIcon(status: string): string {
  switch (status) {
    case 'failed':
      return '❌'
    case 'passed':
      return '✅'
    case 'pending':
      return '⏳'
    case 'n/a':
      return '–'
    default:
      return '?'
  }
}

function tcDotCls(status: string): string {
  switch (status) {
    case 'failed':
      return 'text-red-500'
    case 'passed':
      return 'text-emerald-500'
    case 'pending':
      return 'text-zinc-400'
    default:
      return 'text-zinc-400'
  }
}
