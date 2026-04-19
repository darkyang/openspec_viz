import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { listChanges, parseChange, inferStatus, findChangeRoot } from './change.js'
import type { WorkflowNode } from '../types.js'

const FIXTURE = path.resolve(process.cwd(), 'examples/openspec')

describe('listChanges (against examples/openspec)', () => {
  const summaries = listChanges(FIXTURE)

  it('finds 3 changes including archived', () => {
    expect(summaries.map((s) => s.id).sort()).toEqual(['add-user-auth', 'old-feature', 'refactor-payment'])
  })

  it('add-user-auth: status=in_progress, all 13 nodes present (impl.test missing because tasks 3/5)', () => {
    const c = summaries.find((s) => s.id === 'add-user-auth')!
    expect(c.status).toBe('in_progress')
    expect(c.archived).toBe(false)
    expect(c.taskProgress).toEqual({ total: 5, done: 3 })
    expect(c.workflow).toHaveLength(13)
    const reqChanges = c.workflow.find((n) => n.id === 'req.changes')!
    expect(reqChanges.state).toBe('done')
    expect(reqChanges.count).toBe(3)
  })

  it('refactor-payment: status=incomplete (req.draft missing)', () => {
    const c = summaries.find((s) => s.id === 'refactor-payment')!
    expect(c.status).toBe('incomplete')
    expect(c.archived).toBe(false)
    const draft = c.workflow.find((n) => n.id === 'req.draft')!
    expect(draft.state).toBe('missing-required')
  })

  it('old-feature: status=archived (under changes/archive/)', () => {
    const c = summaries.find((s) => s.id === 'old-feature')!
    expect(c.status).toBe('archived')
    expect(c.archived).toBe(true)
  })
})

describe('parseChange title resolution', () => {
  it('uses # heading from proposal.md', () => {
    const c = parseChange(path.join(FIXTURE, 'changes/add-user-auth'))
    expect(c.title).toBe('添加用户身份认证')
  })
})

describe('inferStatus 4 states', () => {
  function nodes(overrides: Partial<Record<string, 'done' | 'empty' | 'missing-required'>>): WorkflowNode[] {
    const ids = [
      'req.draft', 'req.review', 'design.tech', 'impl.tasks', 'impl.code', 'impl.test',
      'req.discussion', 'req.changes', 'design.analysis', 'design.ui', 'design.review', 'design.testcases', 'impl.debug',
    ]
    const required = new Set(['req.draft', 'req.review', 'design.tech', 'impl.tasks', 'impl.code', 'impl.test'])
    return ids.map((id) => ({
      id,
      phase: 'requirement' as const,
      label: id,
      required: required.has(id),
      state: overrides[id] ?? (required.has(id) ? 'done' : 'empty'),
    }))
  }

  it('archived overrides everything', () => {
    expect(inferStatus(nodes({ 'req.draft': 'missing-required' }), true)).toBe('archived')
  })

  it('doc required missing -> incomplete', () => {
    expect(inferStatus(nodes({ 'req.draft': 'missing-required' }), false)).toBe('incomplete')
    expect(inferStatus(nodes({ 'design.tech': 'missing-required' }), false)).toBe('incomplete')
  })

  it('impl.code/impl.test missing alone does NOT trigger incomplete', () => {
    expect(inferStatus(nodes({ 'impl.code': 'missing-required', 'impl.test': 'missing-required' }), false)).toBe('in_progress')
  })

  it('all docs done + impl.test done -> done', () => {
    expect(inferStatus(nodes({}), false)).toBe('done')
  })

  it('all docs done + impl.test missing -> in_progress', () => {
    expect(inferStatus(nodes({ 'impl.test': 'missing-required' }), false)).toBe('in_progress')
  })
})

describe('findChangeRoot', () => {
  it('finds active change', () => {
    const p = findChangeRoot(FIXTURE, 'add-user-auth')
    expect(p).toBe(path.join(FIXTURE, 'changes/add-user-auth'))
  })

  it('finds archived change', () => {
    const p = findChangeRoot(FIXTURE, 'old-feature')
    expect(p).toBe(path.join(FIXTURE, 'changes/archive/old-feature'))
  })

  it('returns null for unknown', () => {
    expect(findChangeRoot(FIXTURE, 'does-not-exist')).toBeNull()
  })
})
