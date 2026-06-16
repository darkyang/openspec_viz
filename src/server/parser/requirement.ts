import fs from 'node:fs'
import path from 'node:path'
import type {
  ChangeStatus,
  ChangeSummary,
  RequirementMeta,
  RequirementProgress,
  RequirementRisk,
  RequirementStage,
  RequirementSummary,
} from '../types.js'
import { UNGROUPED_ID } from '../types.js'
import { parseFrontmatter } from './frontmatter.js'
import { isLightweightChange, TASK_DERIVED_NODES } from './workflow-spec.js'
import { asString } from '../../shared/codec.js'

/** 状态严重性：取最严（数字大）作为整体 status。archived 最"最完成"。 */
const STATUS_RANK: Record<ChangeStatus, number> = {
  archived: 0,
  done: 1,
  in_progress: 2,
  incomplete: 3,
}
const RANK_TO_STATUS: ChangeStatus[] = ['archived', 'done', 'in_progress', 'incomplete']

const VALID_STAGES = new Set<RequirementStage>([
  'planning',
  'in-dev',
  'in-test',
  'staged',
  'released',
])

function emptyProgress(): RequirementProgress {
  return {
    totalChanges: 0,
    byStatus: { incomplete: 0, in_progress: 0, done: 0, archived: 0 },
    totalTasks: 0,
    doneTasks: 0,
    totalNodes: 0,
    doneNodes: 0,
    overallStatus: 'incomplete',
  }
}

/** 把一组 change summary 聚合成 RequirementProgress。 */
export function aggregateProgress(changes: ChangeSummary[]): RequirementProgress {
  const p = emptyProgress()
  if (changes.length === 0) return p
  p.totalChanges = changes.length
  let maxRank = 0
  for (const c of changes) {
    p.byStatus[c.status] += 1
    p.totalTasks += c.taskProgress.total
    p.doneTasks += c.taskProgress.done
    p.totalNodes += c.workflow.length
    p.doneNodes += c.workflow.filter((n) => n.state === 'done').length
    const r = STATUS_RANK[c.status]
    if (r > maxRank) maxRank = r
  }
  p.overallStatus = RANK_TO_STATUS[maxRank]
  return p
}

/** snake_case key → camelCase RequirementMeta；YAML 数据安全提取。 */
function extractRequirementMeta(meta: Record<string, unknown>): RequirementMeta {
  const out: RequirementMeta = {}
  // target_date 可能被 js-yaml 解析为 Date → asString 统一兜成 YYYY-MM-DD
  const targetDate = asString(meta.target_date)
  if (targetDate) out.targetDate = targetDate
  const targetVersion = asString(meta.target_version)
  if (targetVersion) out.targetVersion = targetVersion
  if (typeof meta.stage === 'string' && VALID_STAGES.has(meta.stage as RequirementStage)) {
    out.stage = meta.stage as RequirementStage
  }
  const owner = asString(meta.owner)
  if (owner) out.owner = owner
  return out
}

/** 读 requirements/<slug>.md，取 frontmatter + 第一行 `# 标题` + 首段描述。文件缺失返回 null。 */
export function readRequirementMeta(
  openspecRoot: string,
  slug: string
): { title: string; description: string; body: string; meta: RequirementMeta } | null {
  const p = path.join(openspecRoot, 'requirements', `${slug}.md`)
  if (!fs.existsSync(p)) return null
  let content: string
  try {
    content = fs.readFileSync(p, 'utf-8')
  } catch {
    return null
  }
  const { meta: rawMeta, body: rawBody } = parseFrontmatter(content)
  const titleMatch = /^#\s+(.+)$/m.exec(rawBody)
  const title = titleMatch ? titleMatch[1].trim() : slug
  let description = ''
  if (titleMatch) {
    const after = rawBody.slice(titleMatch.index + titleMatch[0].length)
    const para = /^\n+([^#][^\n]*(?:\n(?!#)[^\n]+)*)/m.exec(after)
    if (para) description = para[1].trim()
  }
  return { title, description, body: content, meta: extractRequirementMeta(rawMeta) }
}

/** 扫 openspec/requirements/*.md 返回所有声明过的 slug（文件名）。 */
export function listDeclaredRequirements(openspecRoot: string): string[] {
  const dir = path.join(openspecRoot, 'requirements')
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    .map((f) => f.slice(0, -3))
}

/**
 * 推断 effective stage（当 frontmatter.stage 未填时）。规则：
 * - 全部已交付（archived 或 lifecycle shipped/reverted）→ 'released'（不再强制挪 archive/）
 * - 至少一个 in_progress → 'in-dev'
 * - 全部 done + 任一 testStatus=failed/pending → 'in-test'
 * - 全部 done + 全部 testStatus=passed（或无 frontmatter）→ 'staged'
 * - 否则（全部 incomplete / 空）→ 'planning'
 */
export function inferStage(changes: ChangeSummary[]): RequirementStage {
  if (changes.length === 0) return 'planning'
  // 已交付 = 归档,或 lifecycle 明确 shipped/reverted。全部已交付即 released ——
  // 不再要求挪进 archive/（capmind 等不归档的工作流下,全 shipped 的需求也应显示 released）。
  const isDelivered = (c: ChangeSummary) =>
    c.archived || c.frontmatter?.lifecycle === 'shipped' || c.frontmatter?.lifecycle === 'reverted'
  if (changes.every(isDelivered)) return 'released'
  const active = changes.filter((c) => !c.archived)
  if (active.length === 0) return 'released'
  if (active.some((c) => c.status === 'in_progress')) return 'in-dev'
  if (active.some((c) => c.status === 'incomplete')) return 'planning'
  // active 全部 done
  const someTestFailedOrPending = active.some((c) => {
    const ts = c.frontmatter?.testStatus
    return ts === 'failed' || ts === 'pending'
  })
  if (someTestFailedOrPending) return 'in-test'
  return 'staged'
}

/**
 * 为单个 requirement 计算风险信号。规则参见 RequirementRisk['kind']：
 * - test_failed: 任一 change.frontmatter.testStatus === 'failed'
 * - unclosed_bug: 任一 change.frontmatter.spawnedBugs[*] 对应的 bug change.lifecycle !== 'shipped'
 * - burn_down: 距 target_date < 14 天且完成率 < 75% (yellow)；< 7 天且 < 50% (red)
 * - missing_required: 任一 change.workflow 含 required + missing-required + 非 task-derived 节点
 */
export function computeRisks(
  changes: ChangeSummary[],
  meta: RequirementMeta | undefined,
  progress: RequirementProgress,
  byId: Map<string, ChangeSummary>,
): RequirementRisk[] {
  const risks: RequirementRisk[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const c of changes) {
    if (c.archived) continue
    const fm = c.frontmatter

    // test_failed
    if (fm?.testStatus === 'failed') {
      risks.push({
        kind: 'test_failed',
        level: 'red',
        message: `测试失败：${c.id}`,
        sourceChangeId: c.id,
      })
    }

    // unclosed_bug：扫描 spawned_bugs 里有没有 lifecycle != shipped 的
    if (fm?.spawnedBugs) {
      for (const bugId of fm.spawnedBugs) {
        const bug = byId.get(bugId)
        if (!bug) continue // 找不到（可能已归档），不报
        const lc = bug.frontmatter?.lifecycle
        if (lc !== 'shipped' && lc !== 'reverted') {
          risks.push({
            kind: 'unclosed_bug',
            level: 'red',
            message: `未闭环 bug：${bugId} (${lc ?? 'unknown'})`,
            sourceChangeId: bugId,
          })
        }
      }
    }

    // missing_required —— 仅对「按文档完整度追踪」的 change 报。两类豁免:
    // ① 轻量级 change（仅 proposal.md）没有"必需文档"概念;
    // ② 作者已用 frontmatter lifecycle 显式追踪交付的 change（如纳入 requirement 的完整型 anchor）。
    // 否则每个 fix-/tweak- 与每个 anchor 都报一条黄风险，把路线图/QA 的风险信号淹没成噪音。
    const docTracked = !isLightweightChange(c.workflow) && !c.frontmatter?.lifecycle
    if (docTracked) {
      const missing = c.workflow.find(
        (n) => n.required && n.state === 'missing-required' && !TASK_DERIVED_NODES.has(n.id),
      )
      if (missing) {
        risks.push({
          kind: 'missing_required',
          level: 'yellow',
          message: `${c.id}：缺必需文档 ${missing.id}`,
          sourceChangeId: c.id,
        })
      }
    }
  }

  // burn_down：requirement 级，需要 target_date
  if (meta?.targetDate) {
    const target = new Date(meta.targetDate + 'T00:00:00')
    if (!Number.isNaN(target.getTime())) {
      const daysLeft = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const completion = progress.totalTasks > 0
        ? progress.doneTasks / progress.totalTasks
        : (progress.totalNodes > 0 ? progress.doneNodes / progress.totalNodes : 0)
      const completionPct = Math.round(completion * 100)
      if (daysLeft <= 7 && completion < 0.5) {
        risks.push({
          kind: 'burn_down',
          level: 'red',
          message: `${daysLeft} 天到期，完成度 ${completionPct}%`,
        })
      } else if (daysLeft <= 14 && completion < 0.75) {
        risks.push({
          kind: 'burn_down',
          level: 'yellow',
          message: `${daysLeft} 天到期，完成度 ${completionPct}%`,
        })
      } else if (daysLeft < 0) {
        risks.push({
          kind: 'burn_down',
          level: 'red',
          message: `已过期 ${-daysLeft} 天`,
        })
      }
    }
  }

  return risks
}

/**
 * 根据 changes + openspec/requirements/ 下的 md 文件汇总出 RequirementSummary 列表。
 *
 * - 每个 change 的 requirementId 归属它到某个 requirement
 * - 未声明归属的 change 进入虚拟桶 UNGROUPED_ID
 * - requirements/<slug>.md 存在但无 change 引用 → 列为孤儿需求（changeIds 为空）
 * - 返回顺序：UNGROUPED 放最末，其他按需求 id 字母序
 */
export function listRequirements(
  openspecRoot: string,
  changes: ChangeSummary[],
  opts: { includeBody?: boolean } = {}
): RequirementSummary[] {
  const buckets = new Map<string, ChangeSummary[]>()
  for (const c of changes) {
    const key = c.requirementId ?? UNGROUPED_ID
    const arr = buckets.get(key)
    if (arr) arr.push(c)
    else buckets.set(key, [c])
  }
  // 孤儿需求（声明了但没有 change）
  for (const slug of listDeclaredRequirements(openspecRoot)) {
    if (!buckets.has(slug)) buckets.set(slug, [])
  }

  // 全局 byId 索引（计算 unclosed_bug 时用）
  const byId = new Map(changes.map((c) => [c.id, c]))

  const out: RequirementSummary[] = []
  for (const [id, group] of buckets) {
    const progress = aggregateProgress(group)
    let title = id
    let description: string | undefined
    let body: string | undefined
    let meta: RequirementMeta | undefined
    if (id === UNGROUPED_ID) {
      title = '未归类 (Ungrouped)'
      description = '没有在 proposal.md 头部声明 requirement 的 change'
    } else {
      const md = readRequirementMeta(openspecRoot, id)
      if (md) {
        title = md.title
        description = md.description || undefined
        if (opts.includeBody) body = md.body
        if (Object.values(md.meta).some((v) => v !== undefined)) meta = md.meta
      } else if (group.length > 0) {
        // 无独立 md：兜底用第一个 change 的 title
        title = group[0].title
      }
    }

    const effectiveStage: RequirementStage = meta?.stage ?? inferStage(group)
    const risks = computeRisks(group, meta, progress, byId)

    out.push({
      id,
      title,
      description,
      body,
      changeIds: group.map((c) => c.id),
      progress,
      meta,
      effectiveStage,
      risks: risks.length > 0 ? risks : undefined,
    })
  }
  // 排序：UNGROUPED 末尾；其他按 id 字母序
  out.sort((a, b) => {
    if (a.id === UNGROUPED_ID) return 1
    if (b.id === UNGROUPED_ID) return -1
    return a.id.localeCompare(b.id)
  })
  return out
}

/** 查找某 requirement（找不到返回 null）。合法 id 包括 UNGROUPED_ID。 */
export function findRequirement(
  openspecRoot: string,
  changes: ChangeSummary[],
  id: string
): RequirementSummary | null {
  const all = listRequirements(openspecRoot, changes, { includeBody: true })
  return all.find((r) => r.id === id) ?? null
}
