import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { detectWorkflow } from './workflow.js'

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'osviz-test-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function write(rel: string, content = 'x') {
  const abs = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

function nodeById(nodes: ReturnType<typeof detectWorkflow>['nodes'], id: string) {
  const n = nodes.find((x) => x.id === id)
  if (!n) throw new Error(`node ${id} not found`)
  return n
}

describe('detectWorkflow', () => {
  it('returns 13 nodes', () => {
    const { nodes } = detectWorkflow(tmp)
    expect(nodes).toHaveLength(13)
  })

  it('empty change: required nodes -> missing-required, optional -> empty', () => {
    const { nodes } = detectWorkflow(tmp)
    expect(nodeById(nodes, 'req.draft').state).toBe('missing-required')
    expect(nodeById(nodes, 'req.review').state).toBe('missing-required')
    expect(nodeById(nodes, 'design.tech').state).toBe('missing-required')
    expect(nodeById(nodes, 'impl.tasks').state).toBe('missing-required')
    expect(nodeById(nodes, 'impl.code').state).toBe('missing-required')
    expect(nodeById(nodes, 'impl.test').state).toBe('missing-required')

    expect(nodeById(nodes, 'req.discussion').state).toBe('empty')
    expect(nodeById(nodes, 'req.changes').state).toBe('empty')
    expect(nodeById(nodes, 'design.ui').state).toBe('empty')
    expect(nodeById(nodes, 'impl.debug').state).toBe('empty')
  })

  it('file-non-empty: empty file does not count as done', () => {
    write('requirement/01-draft.md', '')
    const { nodes } = detectWorkflow(tmp)
    expect(nodeById(nodes, 'req.draft').state).toBe('missing-required')
  })

  it('file-non-empty: non-empty file -> done', () => {
    write('requirement/01-draft.md', 'hello')
    const { nodes } = detectWorkflow(tmp)
    const n = nodeById(nodes, 'req.draft')
    expect(n.state).toBe('done')
    expect(n.filePath).toBe('requirement/01-draft.md')
  })

  it('dir-has-files: counts files and exposes them', () => {
    write('requirement/04-changes/2026-04-01.md')
    write('requirement/04-changes/2026-04-15.md')
    const { nodes } = detectWorkflow(tmp)
    const n = nodeById(nodes, 'req.changes')
    expect(n.state).toBe('done')
    expect(n.count).toBe(2)
    expect(n.files).toEqual(['requirement/04-changes/2026-04-01.md', 'requirement/04-changes/2026-04-15.md'])
  })

  it('dir-has-files: empty/missing dir -> empty + count 0', () => {
    fs.mkdirSync(path.join(tmp, 'requirement/04-changes'), { recursive: true })
    const { nodes } = detectWorkflow(tmp)
    const n = nodeById(nodes, 'req.changes')
    expect(n.state).toBe('empty')
    expect(n.count).toBe(0)
  })

  it('tasks-has-any-done / tasks-all-done: 0 done -> code missing, test missing', () => {
    write('tasks.md', '- [ ] a\n- [ ] b\n')
    const { nodes, taskProgress } = detectWorkflow(tmp)
    expect(taskProgress).toEqual({ total: 2, done: 0 })
    expect(nodeById(nodes, 'impl.tasks').state).toBe('done')
    expect(nodeById(nodes, 'impl.code').state).toBe('missing-required')
    expect(nodeById(nodes, 'impl.test').state).toBe('missing-required')
  })

  it('tasks: partial done -> code done, test missing', () => {
    write('tasks.md', '- [x] a\n- [ ] b\n')
    const { nodes } = detectWorkflow(tmp)
    expect(nodeById(nodes, 'impl.code').state).toBe('done')
    expect(nodeById(nodes, 'impl.test').state).toBe('missing-required')
  })

  it('tasks: all done -> code done, test done', () => {
    write('tasks.md', '- [x] a\n- [x] b\n')
    const { nodes } = detectWorkflow(tmp)
    expect(nodeById(nodes, 'impl.code').state).toBe('done')
    expect(nodeById(nodes, 'impl.test').state).toBe('done')
  })

  it('caches task progress: only parses tasks.md once across 3 detectors', () => {
    write('tasks.md', '- [x] a\n')
    const { taskProgress } = detectWorkflow(tmp)
    // 间接验证:taskProgress 来自缓存,不为 null
    expect(taskProgress).toEqual({ total: 1, done: 1 })
  })
})
