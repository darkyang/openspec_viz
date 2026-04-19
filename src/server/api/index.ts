import { Hono } from 'hono'
import { listChanges, parseChange, findChangeRoot } from '../parser/change.js'
import { buildTimeline } from '../parser/timeline.js'

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

  api.get('/changes/:id', (c) => {
    const id = c.req.param('id')
    const root = getOpenspecRoot()
    const changeRoot = findChangeRoot(root, id)
    if (!changeRoot) return c.json({ error: 'change not found', id }, 404)
    const archived = changeRoot.includes(`/changes/archive/`)
    const change = parseChange(changeRoot, { archived })
    return c.json(change)
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

  return api
}
