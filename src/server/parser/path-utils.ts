import path from 'node:path'

export interface ChangePathInfo {
  changeId: string | null
  archived: boolean
  relFromChanges: string
}

/**
 * 把 openspec 下某个绝对路径归类到 change（含 archive/<id>/ 形式）。
 *
 * 返回值中 changeId 为 null 表示不属于任何 change（例如 openspec/specs/… 或
 * openspec/changes 根本身）。relFromChanges 已做 posix 归一化。
 */
export function classifyChangePath(absPath: string, openspecRoot: string): ChangePathInfo {
  const changesDir = path.join(openspecRoot, 'changes')
  const rel = path.relative(changesDir, absPath).split(path.sep).join('/')
  if (rel === '' || rel.startsWith('..')) {
    return { changeId: null, archived: false, relFromChanges: rel }
  }
  const parts = rel.split('/')
  if (parts[0] === 'archive') {
    return { changeId: parts[1] ?? null, archived: true, relFromChanges: rel }
  }
  return { changeId: parts[0] ?? null, archived: false, relFromChanges: rel }
}

/**
 * Claude Code 把本地 session 日志存在 ~/.claude/projects/<slug>/<uuid>.jsonl，
 * 其中 slug 是把 cwd 的绝对路径里所有非 [a-zA-Z0-9-] 的字符（'/', '_', '.' 等）
 * 全部替换成 '-'，保留前导 '-'。
 *
 * 例：/Users/simon/Workspace/tool/openspec_viz
 *  -> -Users-simon-Workspace-tool-openspec-viz
 *
 * 例：/Users/x/repo/.claude-worktrees/foo
 *  -> -Users-x-repo--claude-worktrees-foo
 */
export function projectSlugFromCwd(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9-]/g, '-')
}
