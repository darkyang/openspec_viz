import fs from 'node:fs'
import path from 'node:path'
import type { ChangeNode, ChangeStatus, ChangeSummary, WorkflowNode } from '../types.js'
import { detectWorkflow } from './workflow.js'
import { readFileTree } from './file-tree.js'
import { parseFrontmatter } from './frontmatter.js'

interface ProposalMeta {
  title: string | null
  requirementId: string | null
}

/** 读 proposal.md：解 frontmatter 得 requirement，再从 body 的 # heading 取 title。 */
function readProposalMeta(changeRoot: string): ProposalMeta {
  const p = path.join(changeRoot, 'proposal.md')
  if (!fs.existsSync(p)) return { title: null, requirementId: null }
  try {
    const content = fs.readFileSync(p, 'utf-8')
    const { meta, body } = parseFrontmatter(content)
    const titleMatch = /^#\s+(.+)$/m.exec(body)
    const title = titleMatch ? titleMatch[1].trim() : null
    const req = typeof meta.requirement === 'string' && meta.requirement.length > 0 ? meta.requirement : null
    return { title, requirementId: req }
  } catch {
    return { title: null, requirementId: null }
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
  return {
    id: c.id,
    title: c.title,
    status: c.status,
    archived: c.archived,
    workflow: c.workflow,
    taskProgress: c.taskProgress,
    requirementId: c.requirementId,
  }
}

export function findChangeRoot(openspecRoot: string, changeId: string): string | null {
  const active = path.join(openspecRoot, 'changes', changeId)
  if (fs.existsSync(active) && fs.statSync(active).isDirectory()) return active
  const archived = path.join(openspecRoot, 'changes', 'archive', changeId)
  if (fs.existsSync(archived) && fs.statSync(archived).isDirectory()) return archived
  return null
}
