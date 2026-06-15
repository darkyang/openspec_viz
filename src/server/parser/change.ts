import fs from 'node:fs'
import path from 'node:path'
import type { ChangeFrontmatter, ChangeNode, ChangeStatus, ChangeSummary, WorkflowNode } from '../types.js'
import { detectWorkflow } from './workflow.js'
import { readFileTree } from './file-tree.js'
import { parseFrontmatter } from './frontmatter.js'

interface ProposalMeta {
  title: string | null
  requirementId: string | null
  frontmatter: ChangeFrontmatter
}

/** snake_case key → ChangeFrontmatter 字段值的安全提取器集合。 */
function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v.length > 0 ? v : undefined
  // js-yaml 默认会把 ISO 日期 scalar 解析成 Date —— 转回 YYYY-MM-DD 供 UI 直接渲染
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10)
  }
  // 数字/布尔等也容许原样转字符串（例如 commit hash 不带引号被当成 number 时）
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return undefined
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v.filter((x): x is string => typeof x === 'string' && x.length > 0)
  return out.length > 0 ? out : undefined
}

function asStringDict(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const entries = Object.entries(v as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/** 从 frontmatter raw meta 提取我们关心的字段（snake_case → camelCase）。 */
function extractFrontmatter(meta: Record<string, unknown>): ChangeFrontmatter {
  return {
    type: asString(meta.type),
    area: asString(meta.area),
    date: asString(meta.date),
    commit: asString(meta.commit),
    lifecycle: asString(meta.status), // 注意：frontmatter 的 status → lifecycle（避开 ChangeStatus 计算字段）
    effort: asString(meta.effort),
    risk: asString(meta.risk),
    testStatus: asString(meta.test_status),
    fixVerified: asString(meta.fix_verified),
    testResults: asStringDict(meta.test_results),
    spawnedBugs: asStringArray(meta.spawned_bugs),
    discoveredDuring: asString(meta.discovered_during),
    discoveredInCases: asStringArray(meta.discovered_in_cases),
    affectsChanges: asStringArray(meta.affects_changes),
    fixesBugs: asStringArray(meta.fixes_bugs),
  }
}

/** 读 proposal.md：解 frontmatter 得 requirement / 关系字段，再从 body 的 # heading 取 title。 */
function readProposalMeta(changeRoot: string): ProposalMeta {
  const empty: ProposalMeta = { title: null, requirementId: null, frontmatter: {} }
  const p = path.join(changeRoot, 'proposal.md')
  if (!fs.existsSync(p)) return empty
  try {
    const content = fs.readFileSync(p, 'utf-8')
    const { meta, body } = parseFrontmatter(content)
    const titleMatch = /^#\s+(.+)$/m.exec(body)
    const title = titleMatch ? titleMatch[1].trim() : null
    const req = typeof meta.requirement === 'string' && meta.requirement.length > 0
      ? meta.requirement
      : null
    return { title, requirementId: req, frontmatter: extractFrontmatter(meta) }
  } catch {
    return empty
  }
}

function readTitle(changeRoot: string, fallbackId: string): string {
  const fromProposal = readProposalMeta(changeRoot).title
  if (fromProposal) return fromProposal
  // 回退：requirement/01-draft.md 第一个 # 标题
  const p = path.join(changeRoot, 'requirement/01-draft.md')
  if (fs.existsSync(p)) {
    try {
      const content = fs.readFileSync(p, 'utf-8')
      const m = /^#\s+(.+)$/m.exec(content)
      if (m) return m[1].trim()
    } catch {
      // ignore
    }
  }
  return fallbackId
}

/**
 * 整体 status 推断:
 * - archived: 在 changes/archive/ 下
 * - incomplete: 文档类 must 节点缺失(impl.code / impl.test 由 tasks.md 推断,不算文档)
 * - done: 文档齐全 + tasks.md 全勾完
 * - in_progress: 文档齐全,实施进行中(tasks.md 未全勾完)
 */
const TASK_DERIVED_NODES = new Set(['impl.code', 'impl.test'])

export function inferStatus(workflow: WorkflowNode[], archived: boolean): ChangeStatus {
  if (archived) return 'archived'

  const anyDocRequiredMissing = workflow.some(
    (n) => n.required && n.state === 'missing-required' && !TASK_DERIVED_NODES.has(n.id)
  )
  if (anyDocRequiredMissing) return 'incomplete'

  const testNode = workflow.find((n) => n.id === 'impl.test')
  if (testNode?.state === 'done') return 'done'
  return 'in_progress'
}

/** 是否为非空 frontmatter（至少有一个字段被填）。 */
function isFrontmatterNonEmpty(fm: ChangeFrontmatter): boolean {
  return Object.values(fm).some((v) => v !== undefined)
}

export function parseChange(changeRoot: string, opts: { archived?: boolean } = {}): ChangeNode {
  const id = path.basename(changeRoot)
  const archived = opts.archived ?? false
  const { nodes, taskProgress } = detectWorkflow(changeRoot)
  const status = inferStatus(nodes, archived)
  const proposal = readProposalMeta(changeRoot)
  const title = proposal.title ?? readTitle(changeRoot, id)
  const files = readFileTree(changeRoot)
  return {
    id,
    title,
    status,
    archived,
    workflow: nodes,
    files,
    taskProgress,
    requirementId: proposal.requirementId ?? undefined,
    frontmatter: isFrontmatterNonEmpty(proposal.frontmatter) ? proposal.frontmatter : undefined,
  }
}

/**
 * 列出 openspec/changes/ 下的所有 change(包括 archive/ 子目录里的归档)
 * @param openspecRoot openspec 根目录绝对路径(包含 changes/, specs/ 等)
 */
export function listChanges(openspecRoot: string): ChangeSummary[] {
  const changesDir = path.join(openspecRoot, 'changes')
  if (!fs.existsSync(changesDir)) return []

  const summaries: ChangeSummary[] = []

  // active changes
  for (const entry of fs.readdirSync(changesDir)) {
    if (entry === 'archive' || entry.startsWith('.')) continue
    const abs = path.join(changesDir, entry)
    if (!fs.statSync(abs).isDirectory()) continue
    summaries.push(toSummary(parseChange(abs, { archived: false })))
  }

  // archived
  const archiveDir = path.join(changesDir, 'archive')
  if (fs.existsSync(archiveDir) && fs.statSync(archiveDir).isDirectory()) {
    for (const entry of fs.readdirSync(archiveDir)) {
      if (entry.startsWith('.')) continue
      const abs = path.join(archiveDir, entry)
      if (!fs.statSync(abs).isDirectory()) continue
      summaries.push(toSummary(parseChange(abs, { archived: true })))
    }
  }

  return summaries
}

function toSummary(c: ChangeNode): ChangeSummary {
  const summary: ChangeSummary = {
    id: c.id,
    title: c.title,
    status: c.status,
    archived: c.archived,
    workflow: c.workflow,
    taskProgress: c.taskProgress,
    requirementId: c.requirementId,
  }
  if (c.frontmatter) {
    // 列表页 + dashboard 都需要这些字段，避免按 change 单独 fetch detail
    const fm = c.frontmatter
    const summaryFm: ChangeSummary['frontmatter'] = {
      type: fm.type,
      area: fm.area,
      date: fm.date,
      effort: fm.effort,
      risk: fm.risk,
      lifecycle: fm.lifecycle,
      testStatus: fm.testStatus,
      fixVerified: fm.fixVerified,
      testResults: fm.testResults,
      spawnedBugs: fm.spawnedBugs,
      discoveredDuring: fm.discoveredDuring,
    }
    if (Object.values(summaryFm).some((v) => v !== undefined)) {
      summary.frontmatter = summaryFm
    }
  }
  return summary
}

export function findChangeRoot(openspecRoot: string, changeId: string): string | null {
  const active = path.join(openspecRoot, 'changes', changeId)
  if (fs.existsSync(active) && fs.statSync(active).isDirectory()) return active
  const archived = path.join(openspecRoot, 'changes', 'archive', changeId)
  if (fs.existsSync(archived) && fs.statSync(archived).isDirectory()) return archived
  return null
}
