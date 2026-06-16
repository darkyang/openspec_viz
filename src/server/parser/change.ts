import fs from 'node:fs'
import path from 'node:path'
import type { ChangeFrontmatter, ChangeNode, ChangeStatus, ChangeSummary, WorkflowNode } from '../types.js'
import { detectWorkflow } from './workflow.js'
import { readFileTree } from './file-tree.js'
import { parseFrontmatter } from './frontmatter.js'
import { isLightweightChange, TASK_DERIVED_NODES } from './workflow-spec.js'
import { asString, asStringArray, asStringDict } from '../../shared/codec.js'

interface ProposalMeta {
  title: string | null
  requirementId: string | null
  frontmatter: ChangeFrontmatter
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
 * 轻量级 change（仅 proposal.md，无脚手架文档）的 frontmatter lifecycle → ChangeStatus 映射。
 *
 * ChangeStatus 是 UI 消费的粗粒度交付桶，lifecycle 是作者显式标注的交付进度（drafted →
 * in-review → shipped）。两者正交，这里把 5 个 lifecycle 收敛到 4 个 ChangeStatus：
 * - shipped / reverted → done（已交付 / 已终结，reverted 的细节由 lifecycle chip 单独呈现）
 * - drafted / in-review / blocked → in_progress（提案已成文、在途）
 * - 缺省（无 lifecycle）→ in_progress（轻量级 change 至少有 proposal，视为在途，绝不 incomplete）
 *
 * commit / test_status 不参与本映射：它们是正交信号，分别由变更日志的 commit chip 与 QA lens
 * （test_status / fix_verified）呈现，避免把 "QA 通过" 误当 "已交付"。
 */
function statusFromLifecycle(lifecycle: string | undefined): ChangeStatus {
  switch (lifecycle) {
    case 'shipped':
    case 'reverted':
      return 'done'
    case 'in-review':
    case 'drafted':
    case 'blocked':
      return 'in_progress'
    default:
      return 'in_progress'
  }
}

/**
 * 整体 status 推断（ChangeStatus 轴）。优先级:
 * - archived: 在 changes/archive/ 下
 * - 有显式 frontmatter lifecycle（任何 tier）: 由 lifecycle 驱动（作者交付意图优先；
 *   让纳入 requirement 的完整型 anchor 不因缺 requirement/01-draft.md 恒判 incomplete）
 * - 轻量级 change 且无 lifecycle（仅 proposal.md）: 视为在途 in_progress（文档完整度对它失真）
 * - 完整型 change 且无 lifecycle（有 design.md / tasks.md 等扩展结构）: 沿用 13 节点文档完整度
 *   - incomplete: 文档类 must 节点缺失(impl.code / impl.test 由 tasks.md 推断,不算文档)
 *   - done: 文档齐全 + tasks.md 全勾完
 *   - in_progress: 文档齐全,实施进行中(tasks.md 未全勾完)
 */
export function inferStatus(
  workflow: WorkflowNode[],
  archived: boolean,
  frontmatter?: ChangeFrontmatter
): ChangeStatus {
  if (archived) return 'archived'

  // 作者显式标注了交付进度（frontmatter status → lifecycle）→ 以其为准，**不分 tier**。
  // 这样被纳入某 requirement 的完整型 anchor（有 design/tasks 但缺 requirement/01-draft.md）
  // 能据实出状态，而非因 13 节点文档不齐恒判 incomplete、把所属 requirement 拖红。
  if (frontmatter?.lifecycle) {
    return statusFromLifecycle(frontmatter.lifecycle)
  }

  // 无显式 lifecycle 的轻量级 change（仅 proposal.md）：视为在途，不判 incomplete。
  if (isLightweightChange(workflow)) {
    return statusFromLifecycle(undefined)
  }

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
  const proposal = readProposalMeta(changeRoot)
  const status = inferStatus(nodes, archived, proposal.frontmatter)
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
