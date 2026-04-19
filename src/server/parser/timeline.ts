import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { EventKind, TimelineEvent } from '../types.js'

export type { EventKind, TimelineEvent }

const MAX_EVENTS = 50

export function buildTimeline(openspecRoot: string): TimelineEvent[] {
  const fromGit = tryGitTimeline(openspecRoot)
  if (fromGit && fromGit.length > 0) return fromGit
  return mtimeTimeline(openspecRoot)
}

function tryGitTimeline(openspecRoot: string): TimelineEvent[] | null {
  try {
    const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: openspecRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (!repoRoot) return null

    const relChanges = path.relative(repoRoot, path.join(openspecRoot, 'changes'))
    // 取最近 200 commits 触及 changes/,内部再筛事件
    const out = execFileSync(
      'git',
      [
        '-C',
        repoRoot,
        'log',
        '-n',
        '200',
        '--pretty=format:%H%x09%at%x09%an%x09%s',
        '--name-only',
        '--',
        relChanges,
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    )

    const events: TimelineEvent[] = []
    const blocks = out.split(/\n\n+/)
    for (const block of blocks) {
      const lines = block.split('\n').filter(Boolean)
      if (lines.length === 0) continue
      const header = lines[0]
      const [hash, atStr, author, ...msgParts] = header.split('\t')
      const ts = Number(atStr) * 1000
      const message = msgParts.join('\t')
      const files = lines.slice(1)
      const touchedChanges = new Map<string, { archived: boolean; sample: string }>()
      for (const f of files) {
        const m = matchChangePath(f, relChanges)
        if (!m) continue
        if (!touchedChanges.has(m.changeId)) {
          touchedChanges.set(m.changeId, { archived: m.archived, sample: f })
        }
      }
      for (const [changeId, meta] of touchedChanges) {
        events.push({
          changeId,
          archived: meta.archived,
          kind: inferKindFromCommit(message),
          timestamp: ts,
          source: 'git',
          commitHash: hash,
          author,
          message,
        })
      }
    }
    return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_EVENTS)
  } catch {
    return null
  }
}

function matchChangePath(filePath: string, relChanges: string): { changeId: string; archived: boolean } | null {
  const norm = filePath.split(path.sep).join('/')
  const prefix = relChanges.split(path.sep).join('/').replace(/\/$/, '') + '/'
  if (!norm.startsWith(prefix)) return null
  const rest = norm.slice(prefix.length)
  const parts = rest.split('/')
  if (parts[0] === 'archive' && parts.length >= 2) {
    return { changeId: parts[1], archived: true }
  }
  if (parts[0] && parts[0] !== 'archive') {
    return { changeId: parts[0], archived: false }
  }
  return null
}

function inferKindFromCommit(message: string): EventKind {
  const lower = message.toLowerCase()
  if (lower.includes('archive')) return 'archived'
  if (lower.includes('init') || lower.includes('add ') || lower.includes('create')) return 'created'
  if (lower.includes('done') || lower.includes('complete') || lower.includes('finish')) return 'completed'
  return 'modified'
}

function mtimeTimeline(openspecRoot: string): TimelineEvent[] {
  const changesDir = path.join(openspecRoot, 'changes')
  if (!fs.existsSync(changesDir)) return []

  const events: TimelineEvent[] = []

  walk(changesDir, (abs, rel) => {
    // rel is relative to changesDir, e.g. "add-user-auth/proposal.md" or "archive/old/proposal.md"
    const parts = rel.split('/')
    let changeId: string
    let archived = false
    if (parts[0] === 'archive') {
      if (parts.length < 2) return
      changeId = parts[1]
      archived = true
    } else {
      changeId = parts[0]
    }
    const st = fs.statSync(abs)
    if (!st.isFile()) return
    events.push({
      changeId,
      archived,
      kind: 'modified',
      timestamp: st.mtimeMs,
      source: 'mtime',
      filePath: rel,
    })
  })

  return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_EVENTS)
}

function walk(rootAbs: string, fn: (abs: string, rel: string) => void) {
  const stack: string[] = ['']
  while (stack.length > 0) {
    const rel = stack.pop()!
    const abs = path.join(rootAbs, rel)
    const st = fs.statSync(abs)
    if (st.isDirectory()) {
      const entries = fs.readdirSync(abs).filter((n) => !n.startsWith('.'))
      for (const e of entries) {
        stack.push(rel === '' ? e : path.join(rel, e))
      }
    } else if (st.isFile()) {
      fn(abs, rel.split(path.sep).join('/'))
    }
  }
}
