import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'
import type { AiSessionSummary, AiSessionTokens, ChangeAiAttribution } from '../types.js'
import { classifyChangePath, projectSlugFromCwd } from './path-utils.js'

/** 解析单个 Claude Code JSONL 日志行得到的规整结构（只保留我们关心的字段）。 */
interface RawEntry {
  type?: string
  timestamp?: string
  sessionId?: string
  cwd?: string
  gitBranch?: string
  slug?: string
  message?: {
    model?: string
    role?: string
    content?: Array<{
      type?: string
      name?: string
      input?: Record<string, unknown>
      is_error?: boolean
    }>
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
  }
}

/** Claude Code 本地日志根目录。 */
export function claudeProjectsRoot(): string {
  return path.join(os.homedir(), '.claude', 'projects')
}

/**
 * 根据项目根目录（通常是 openspec 目录的父目录）推导 Claude Code 对应的 session
 * 目录路径。目录不一定存在，调用方自行判断。
 */
export function sessionsDirForProject(projectRoot: string): string {
  return path.join(claudeProjectsRoot(), projectSlugFromCwd(projectRoot))
}

/** 枚举某项目下所有 .jsonl session 文件绝对路径（按 mtime 升序，不报错地忽略缺失目录）。 */
export function listSessionFiles(projectRoot: string): string[] {
  const dir = sessionsDirForProject(projectRoot)
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir)
  const files: Array<{ path: string; mtime: number }> = []
  for (const name of entries) {
    if (!name.endsWith('.jsonl')) continue
    const abs = path.join(dir, name)
    try {
      const st = fs.statSync(abs)
      if (!st.isFile()) continue
      files.push({ path: abs, mtime: st.mtimeMs })
    } catch {
      // ignore
    }
  }
  files.sort((a, b) => a.mtime - b.mtime)
  return files.map((f) => f.path)
}

/** 容错地把一行 JSONL 解析成对象；坏行返回 null。 */
function parseLine(line: string): RawEntry | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as RawEntry
  } catch {
    return null
  }
}

/** 从一个 tool_use 的 input 里提取出可归因的文件 / 目录路径（绝对或相对均可）。 */
function extractToolPaths(name: string | undefined, input: Record<string, unknown> | undefined): string[] {
  if (!name || !input) return []
  const out: string[] = []
  const pushIfString = (v: unknown) => {
    if (typeof v === 'string' && v.length > 0) out.push(v)
  }
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      pushIfString(input.file_path)
      pushIfString(input.notebook_path)
      break
    case 'Glob':
    case 'Grep':
      pushIfString(input.path)
      break
    default:
      break
  }
  return out
}

const EMPTY_TOKENS = (): AiSessionTokens => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheCreation: 0,
})

/** 把一组原始条目汇总成 summary；同时用于流式与字符串两条入口。 */
export function aggregateEntries(entries: RawEntry[], filePath: string, fallbackSessionId?: string): AiSessionSummary {
  const tokens = EMPTY_TOKENS()
  const toolCalls: Record<string, number> = {}
  const touched = new Set<string>()
  let userTurns = 0
  let assistantTurns = 0
  let errorCount = 0
  let firstTs: string | undefined
  let lastTs: string | undefined
  let lastModel: string | null = null
  let sessionId = fallbackSessionId ?? ''
  let gitBranch: string | undefined
  let slug: string | undefined
  let cwd: string | undefined

  for (const entry of entries) {
    if (!entry) continue
    if (entry.sessionId && !sessionId) sessionId = entry.sessionId
    if (entry.gitBranch) gitBranch = entry.gitBranch
    if (entry.slug) slug = entry.slug
    if (entry.cwd) cwd = entry.cwd
    if (entry.timestamp) {
      if (!firstTs || entry.timestamp < firstTs) firstTs = entry.timestamp
      if (!lastTs || entry.timestamp > lastTs) lastTs = entry.timestamp
    }

    const msg = entry.message
    if (entry.type === 'user' && msg?.role === 'user') {
      // 只把"真正的人类输入"计入 user turn：tool_result 也是 type=user，但 content 是 tool_result
      const content = msg.content
      const isToolResult = Array.isArray(content) && content.some((c) => c?.type === 'tool_result')
      if (!isToolResult) userTurns += 1
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'tool_result' && c.is_error === true) errorCount += 1
        }
      }
    } else if (entry.type === 'assistant' && msg?.role === 'assistant') {
      assistantTurns += 1
      if (msg.model) lastModel = msg.model
      const usage = msg.usage
      if (usage) {
        tokens.input += usage.input_tokens ?? 0
        tokens.output += usage.output_tokens ?? 0
        tokens.cacheRead += usage.cache_read_input_tokens ?? 0
        tokens.cacheCreation += usage.cache_creation_input_tokens ?? 0
      }
      if (Array.isArray(msg.content)) {
        for (const c of msg.content) {
          if (c?.type === 'tool_use' && c.name) {
            toolCalls[c.name] = (toolCalls[c.name] ?? 0) + 1
            for (const p of extractToolPaths(c.name, c.input)) touched.add(p)
          }
        }
      }
    }
  }

  const start = firstTs ?? new Date(0).toISOString()
  const end = lastTs ?? start
  const durationMs = new Date(end).getTime() - new Date(start).getTime()

  return {
    sessionId: sessionId || path.basename(filePath, '.jsonl'),
    filePath,
    startedAt: start,
    endedAt: end,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0,
    model: lastModel,
    userTurns,
    assistantTurns,
    toolCalls,
    tokens,
    errorCount,
    touchedFiles: [...touched],
    gitBranch,
    slug,
    cwd,
  }
}

/** 同步解析字符串形式的 JSONL（测试与小文件可用）。 */
export function parseSessionFromString(content: string, filePath = 'in-memory.jsonl'): AiSessionSummary {
  const entries: RawEntry[] = []
  for (const line of content.split(/\r?\n/)) {
    const e = parseLine(line)
    if (e) entries.push(e)
  }
  const fallback = path.basename(filePath, '.jsonl')
  return aggregateEntries(entries, filePath, fallback)
}

/** 流式解析单个 JSONL 文件。坏行自动跳过。 */
export async function parseSessionFile(filePath: string): Promise<AiSessionSummary> {
  const entries: RawEntry[] = []
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    const e = parseLine(line)
    if (e) entries.push(e)
  }
  const fallback = path.basename(filePath, '.jsonl')
  return aggregateEntries(entries, filePath, fallback)
}

/**
 * 把一个 session 归因到受其影响的 change（按 touchedFiles 里落在
 * openspec/changes/<id>/ 下的次数统计）。命中最多的那个 change 标记为 primary；
 * 多个并列最高都标 primary。session 没有任何命中时返回空数组。
 */
export function attributeToChanges(summary: AiSessionSummary, openspecRoot: string): ChangeAiAttribution[] {
  const counts = new Map<string, { archived: boolean; hitCount: number }>()
  for (const raw of summary.touchedFiles) {
    // 把相对路径转成相对 openspecRoot（外部调用者可能给绝对或相对 cwd 的路径）
    const abs = path.isAbsolute(raw) ? raw : path.resolve(summary.cwd ?? openspecRoot, raw)
    const info = classifyChangePath(abs, openspecRoot)
    if (!info.changeId) continue
    const key = `${info.archived ? 'a:' : ''}${info.changeId}`
    const cur = counts.get(key)
    if (cur) cur.hitCount += 1
    else counts.set(key, { archived: info.archived, hitCount: 1 })
  }

  if (counts.size === 0) return []
  let max = 0
  for (const { hitCount } of counts.values()) if (hitCount > max) max = hitCount

  const out: ChangeAiAttribution[] = []
  for (const [key, { archived, hitCount }] of counts) {
    const changeId = key.startsWith('a:') ? key.slice(2) : key
    out.push({
      changeId,
      archived,
      sessionId: summary.sessionId,
      hitCount,
      primary: hitCount === max,
    })
  }
  out.sort((a, b) => b.hitCount - a.hitCount || a.changeId.localeCompare(b.changeId))
  return out
}
