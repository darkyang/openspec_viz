import fs from 'node:fs'
import path from 'node:path'
import type {
  ChangeStatus,
  ChangeSummary,
  RequirementProgress,
  RequirementSummary,
} from '../types.js'
import { UNGROUPED_ID } from '../types.js'

/** 状态严重性：取最严（数字大）作为整体 status。archived 最"最完成"。 */
const STATUS_RANK: Record<ChangeStatus, number> = {
  archived: 0,
  done: 1,
  in_progress: 2,
  incomplete: 3,
}
const RANK_TO_STATUS: ChangeStatus[] = ['archived', 'done', 'in_progress', 'incomplete']

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

/** 读 requirements/<slug>.md，取第一行 `# 标题` 与首段描述。文件缺失返回 null。 */
export function readRequirementMeta(
  openspecRoot: string,
  slug: string
): { title: string; description: string; body: string } | null {
  const p = path.join(openspecRoot, 'requirements', `${slug}.md`)
  if (!fs.existsSync(p)) return null
  let content: string
  try {
    content = fs.readFileSync(p, 'utf-8')
  } catch {
    return null
  }
  const titleMatch = /^#\s+(.+)$/m.exec(content)
  const title = titleMatch ? titleMatch[1].trim() : slug
  // 描述 = 标题之后首个非空段落（遇到下个 heading 停）
  let description = ''
  if (titleMatch) {
    const after = content.slice(titleMatch.index + titleMatch[0].length)
    const para = /^\n+([^#][^\n]*(?:\n(?!#)[^\n]+)*)/m.exec(after)
    if (para) description = para[1].trim()
  }
  return { title, description, body: content }
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

  const out: RequirementSummary[] = []
  for (const [id, group] of buckets) {
    const progress = aggregateProgress(group)
    let title = id
    let description: string | undefined
    let body: string | undefined
    if (id === UNGROUPED_ID) {
      title = '未归类 (Ungrouped)'
      description = '没有在 proposal.md 头部声明 requirement 的 change'
    } else {
      const meta = readRequirementMeta(openspecRoot, id)
      if (meta) {
        title = meta.title
        description = meta.description || undefined
        if (opts.includeBody) body = meta.body
      } else if (group.length > 0) {
        // 无独立 md：兜底用第一个 change 的 title
        title = group[0].title
      }
    }
    out.push({
      id,
      title,
      description,
      body,
      changeIds: group.map((c) => c.id),
      progress,
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
