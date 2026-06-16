import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { createApi } from './api/index.js'
import { findOpenspecRoot } from './locator.js'
import { startWatcher } from './watcher.js'
import { startAiWatcher } from './ai-watcher.js'
import { listSessionSummaries } from './parser/ai-cache.js'
import { SseHub } from './sse.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveOpenspecRoot(): string {
  if (process.env.OPENSPEC_ROOT) {
    const r = path.resolve(process.env.OPENSPEC_ROOT)
    if (!fs.existsSync(r)) {
      throw new Error(`OPENSPEC_ROOT not found: ${r}`)
    }
    return r
  }
  // dev fallback: examples/openspec under cwd
  const dev = path.resolve(process.cwd(), 'examples/openspec')
  if (fs.existsSync(dev) && !process.env.OPENSPEC_VIZ_NO_DEV_FALLBACK) return dev
  // walk up from cwd
  const found = findOpenspecRoot(process.cwd())
  if (!found) {
    throw new Error(
      '未找到 openspec 目录。请在包含 openspec/ 的目录下启动,或通过参数指定:openspec-viz ./path/to/project'
    )
  }
  return found
}

const openspecRoot = resolveOpenspecRoot()
console.log(`[openspec-viz] openspec root: ${openspecRoot}`)

const app = new Hono()

const sse = new SseHub()
sse.start()

app.route('/api', createApi(() => openspecRoot))

app.get('/sse', (c) => sse.handle(c))

// Wire watcher → SSE broadcast
startWatcher(openspecRoot, (info) => {
  sse.broadcast({
    type: 'change-updated',
    changeId: info.changeId,
    archived: info.archived,
    filePath: info.filePath,
  })
})

// Wire Claude Code session watcher → SSE broadcast（目录不存在时为 no-op）
startAiWatcher(path.dirname(openspecRoot), (info) => {
  sse.broadcast({
    type: 'ai-session-updated',
    sessionId: info.sessionId,
    filePath: info.filePath,
    kind: info.kind,
  })
})

// Production: serve built SPA via custom handler
const distWeb = path.resolve(__dirname, '../../web')
if (fs.existsSync(distWeb)) {
  const indexHtml = path.join(distWeb, 'index.html')
  app.get('*', async (c) => {
    const urlPath = new URL(c.req.url).pathname
    if (urlPath !== '/' && !urlPath.startsWith('/api') && urlPath !== '/sse') {
      const candidate = path.join(distWeb, urlPath)
      if (
        candidate.startsWith(distWeb) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        const ext = path.extname(candidate).toLowerCase()
        const ctype = MIME[ext] ?? 'application/octet-stream'
        return new Response(fs.readFileSync(candidate), {
          headers: { 'content-type': ctype },
        })
      }
    }
    return new Response(fs.readFileSync(indexHtml), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  })
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const PORT = Number(process.env.PORT) || 4567
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[openspec-viz] server listening on http://localhost:${info.port}`)
  // 预热 AI session 缓存：首个 change 详情会触发 attachAiToChange → 一次性解析项目下全部
  // Claude Code session jsonl（冷启动可达 ~1.5s）。后台异步预热，让首个详情页打开即命中缓存
  // （ai-cache 按 size+mtime 缓存，watcher 在文件变化时失效，预热结果后续复用）。
  void (async () => {
    try {
      const t0 = Date.now()
      const sessions = await listSessionSummaries(path.dirname(openspecRoot))
      if (sessions.length > 0) {
        console.log(`[openspec-viz] 预热 AI session 缓存：${sessions.length} 个 (${Date.now() - t0}ms)`)
      }
    } catch {
      // 预热失败不影响服务（无 session 目录 / 解析异常都安全忽略，按需时再解析）
    }
  })()
})
