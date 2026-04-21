import chokidar, { type FSWatcher } from 'chokidar'
import fs from 'node:fs'
import path from 'node:path'
import { sessionsDirForProject } from './parser/ai-session.js'
import { invalidateSession } from './parser/ai-cache.js'

export type AiSessionChangeListener = (info: {
  sessionId: string
  filePath: string
  kind: 'add' | 'change' | 'unlink'
}) => void

export interface AiWatcher {
  close: () => Promise<void>
}

const DEBOUNCE_MS = 300

/**
 * 监听某项目对应的 Claude Code session 目录（~/.claude/projects/<slug>/）。
 * 目录不存在时返回一个 no-op watcher，不报错。
 */
export function startAiWatcher(projectRoot: string, listener: AiSessionChangeListener): AiWatcher {
  const dir = sessionsDirForProject(projectRoot)
  if (!fs.existsSync(dir)) {
    console.log(`[ai-watcher] claude projects dir not found, skipping: ${dir}`)
    return { close: async () => {} }
  }

  const watcher: FSWatcher = chokidar.watch(dir, {
    ignoreInitial: true,
    // JSONL 是追加写，用较短 stability 阈值尽快感知
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    ignored: (p: string) => {
      const base = path.basename(p)
      if (base === '.' || base === dir) return false
      // 只关心 .jsonl
      if (base.endsWith('.jsonl')) return false
      // 子目录也要放行（chokidar 会先访问目录本身）
      try {
        return fs.statSync(p).isFile() && !base.endsWith('.jsonl')
      } catch {
        return false
      }
    },
  })

  const pending = new Map<string, NodeJS.Timeout>()
  function emit(absPath: string, kind: 'add' | 'change' | 'unlink') {
    if (!absPath.endsWith('.jsonl')) return
    const existing = pending.get(absPath)
    if (existing) clearTimeout(existing)
    const t = setTimeout(() => {
      pending.delete(absPath)
      invalidateSession(absPath)
      listener({
        sessionId: path.basename(absPath, '.jsonl'),
        filePath: absPath,
        kind,
      })
    }, DEBOUNCE_MS)
    pending.set(absPath, t)
  }

  watcher.on('add', (p) => emit(p, 'add'))
  watcher.on('change', (p) => emit(p, 'change'))
  watcher.on('unlink', (p) => emit(p, 'unlink'))
  watcher.on('error', (err) => console.error('[ai-watcher] error', err))

  console.log(`[ai-watcher] watching ${dir}`)

  return {
    close: () => watcher.close(),
  }
}
