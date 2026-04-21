import { Hono } from 'hono'
import path from 'node:path'
import { listChanges, parseChange, findChangeRoot } from '../parser/change.js'
import { buildTimeline } from '../parser/timeline.js'
import { attributeToChanges } from '../parser/ai-session.js'
import { listSessionSummaries, findSessionById } from '../parser/ai-cache.js'
import type { AiStats, ChangeAiSession, ChangeNode } from '../types.js'

function projectRootFor(openspecRoot: string): string {
  return path.dirname(openspecRoot)
}

function emptyStats(): AiStats {
  return {
    totalSessions: 0,
    totalTokens: 0,
    totalDurationMs: 0,
    totalUserTurns: 0,
    totalAssistantTurns: 0,
    totalErrorCount: 0,
  }
}

async function attachAiToChange(change: ChangeNode, openspecRoot: string): Promise<ChangeNode> {
  const summaries = await listSessionSummaries(projectRootFor(openspecRoot))
  const matched: ChangeAiSession[] = []
  for (const s of summaries) {
    const attrs = attributeToChanges(s, openspecRoot)
    const hit = attrs.find((a) => a.changeId === change.id && a.archived === change.archived)
    if (!hit) continue
    matched.push({ ...s, hitCount: hit.hitCount, primary: hit.primary })
  }
  // 按开始时间降序（最近在上）
  matched.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const stats: AiStats = emptyStats()
  for (const s of matched) {
    stats.totalSessions += 1
    stats.totalTokens +=
      s.tokens.input + s.tokens.output + s.tokens.cacheRead + s.tokens.cacheCreation
    stats.totalDurationMs += s.durationMs
    stats.totalUserTurns += s.userTurns
    stats.totalAssistantTurns += s.assistantTurns
    stats.totalErrorCount += s.errorCount
  }
  return { ...change, aiSessions: matched, aiStats: stats }
}

export function createApi(getOpenspecRoot: () => string) {
  const api = new Hono()

  api.get('/health', (c) =>
    c.json({ ok: true, openspecRoot: getOpenspecRoot() })
  )

  api.get('/overview', (c) => {
    const root = getOpenspecRoot()
    const changes = listChanges(root)
    return c.json({
      openspecRoot: root,
      changes,
      summary: {
        total: changes.length,
        active: changes.filter((c) => !c.archived).length,
        archived: changes.filter((c) => c.archived).length,
        byStatus: {
          incomplete: changes.filter((c) => c.status === 'incomplete').length,
          in_progress: changes.filter((c) => c.status === 'in_progress').length,
          done: changes.filter((c) => c.status === 'done').length,
          archived: changes.filter((c) => c.status === 'archived').length,
        },
      },
    })
  })

  api.get('/changes/:id', async (c) => {
    const id = c.req.param('id')
    const root = getOpenspecRoot()
    const changeRoot = findChangeRoot(root, id)
    if (!changeRoot) return c.json({ error: 'change not found', id }, 404)
    const archived = changeRoot.includes(`/changes/archive/`)
    const change = parseChange(changeRoot, { archived })
    const withAi = await attachAiToChange(change, root)
    return c.json(withAi)
  })

  api.get('/changes/:id/file', async (c) => {
    const id = c.req.param('id')
    const filePath = c.req.query('path')
    if (!filePath) return c.json({ error: 'missing ?path=' }, 400)
    if (filePath.includes('..')) return c.json({ error: 'invalid path' }, 400)
    const root = getOpenspecRoot()
    const changeRoot = findChangeRoot(root, id)
    if (!changeRoot) return c.json({ error: 'change not found', id }, 404)
    const fs = await import('node:fs')
    const path = await import('node:path')
    const abs = path.resolve(changeRoot, filePath)
    if (!abs.startsWith(path.resolve(changeRoot))) {
      return c.json({ error: 'path escapes change root' }, 400)
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return c.json({ error: 'file not found', path: filePath }, 404)
    }
    const content = fs.readFileSync(abs, 'utf-8')
    return c.json({ id, path: filePath, content, size: content.length })
  })

  api.get('/timeline', (c) => {
    const root = getOpenspecRoot()
    const events = buildTimeline(root)
    return c.json({ events })
  })

  api.get('/ai-sessions', async (c) => {
    const root = getOpenspecRoot()
    const summaries = await listSessionSummaries(projectRootFor(root))
    // 顺带返回每个 session 在 openspec 范围内的 change 归因，方便前端无须再算
    const withAttrs = summaries.map((s) => ({
      ...s,
      attributions: attributeToChanges(s, root),
    }))
    return c.json({ projectRoot: projectRootFor(root), sessions: withAttrs })
  })

  api.get('/ai-sessions/:id', async (c) => {
    const root = getOpenspecRoot()
    const id = c.req.param('id')
    const s = await findSessionById(projectRootFor(root), id)
    if (!s) return c.json({ error: 'session not found', id }, 404)
    return c.json({ ...s, attributions: attributeToChanges(s, root) })
  })

  return api
}
