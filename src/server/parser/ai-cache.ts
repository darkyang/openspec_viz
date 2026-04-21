import fs from 'node:fs'
import type { AiSessionSummary } from '../types.js'
import { listSessionFiles, parseSessionFile } from './ai-session.js'

interface CacheEntry {
  size: number
  mtimeMs: number
  summary: AiSessionSummary
}

const cache = new Map<string, CacheEntry>()

/** 返回某 jsonl 的解析结果；(size, mtime) 未变时复用缓存。 */
export async function getOrParseSession(filePath: string): Promise<AiSessionSummary | null> {
  let stat: fs.Stats
  try {
    stat = fs.statSync(filePath)
  } catch {
    cache.delete(filePath)
    return null
  }
  const hit = cache.get(filePath)
  if (hit && hit.size === stat.size && hit.mtimeMs === stat.mtimeMs) {
    return hit.summary
  }
  const summary = await parseSessionFile(filePath)
  cache.set(filePath, { size: stat.size, mtimeMs: stat.mtimeMs, summary })
  return summary
}

/** 手动驱除缓存（watcher 在文件变化时调用）。 */
export function invalidateSession(filePath: string): void {
  cache.delete(filePath)
}

/** 清空全部缓存（测试用）。 */
export function clearSessionCache(): void {
  cache.clear()
}

/** 列出某 project 下所有 session summary（按 startedAt 升序）。 */
export async function listSessionSummaries(projectRoot: string): Promise<AiSessionSummary[]> {
  const files = listSessionFiles(projectRoot)
  const out: AiSessionSummary[] = []
  for (const f of files) {
    const s = await getOrParseSession(f)
    if (s) out.push(s)
  }
  out.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  return out
}

/** 按 sessionId 查找 summary；命中即返回，未命中返回 null。 */
export async function findSessionById(projectRoot: string, sessionId: string): Promise<AiSessionSummary | null> {
  const all = await listSessionSummaries(projectRoot)
  return all.find((s) => s.sessionId === sessionId) ?? null
}
