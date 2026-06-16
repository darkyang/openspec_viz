import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { aggregateProgress, listRequirements, findRequirement, computeRisks, inferStage } from './requirement.js'
import { UNGROUPED_ID } from '../types.js'
import type { ChangeSummary, WorkflowNode } from '../types.js'

function mkChange(
  id: string,
  opts: {
    status: ChangeSummary['status']
    taskDone: number
    taskTotal: number
    nodeDone: number
    nodeTotal: number
    archived?: boolean
    requirementId?: string
  }
): ChangeSummary {
  const workflow: WorkflowNode[] = Array.from({ length: opts.nodeTotal }, (_, i) => ({
    id: `n${i}`,
    phase: 'requirement',
    label: `node${i}`,
    required: false,
    state: i < opts.nodeDone ? 'done' : 'empty',
  }))
  return {
    id,
    title: `title-${id}`,
    status: opts.status,
    archived: opts.archived ?? opts.status === 'archived',
    workflow,
    taskProgress: { total: opts.taskTotal, done: opts.taskDone },
    requirementId: opts.requirementId,
  }
}

describe('aggregateProgress', () => {
  it('空列表返回 incomplete/0', () => {
    const p = aggregateProgress([])
    expect(p.totalChanges).toBe(0)
    expect(p.overallStatus).toBe('incomplete')
  })

  it('三 change 状态 done/in_progress/incomplete → overallStatus = incomplete', () => {
    const p = aggregateProgress([
      mkChange('a', { status: 'done', taskDone: 3, taskTotal: 3, nodeDone: 5, nodeTotal: 5 }),
      mkChange('b', { status: 'in_progress', taskDone: 1, taskTotal: 3, nodeDone: 3, nodeTotal: 5 }),
      mkChange('c', { status: 'incomplete', taskDone: 0, taskTotal: 2, nodeDone: 1, nodeTotal: 5 }),
    ])
    expect(p.totalChanges).toBe(3)
    expect(p.byStatus).toEqual({ done: 1, in_progress: 1, incomplete: 1, archived: 0 })
    expect(p.totalTasks).toBe(8)
    expect(p.doneTasks).toBe(4)
    expect(p.totalNodes).toBe(15)
    expect(p.doneNodes).toBe(9)
    expect(p.overallStatus).toBe('incomplete')
  })

  it('全 done → overallStatus done', () => {
    const p = aggregateProgress([
      mkChange('a', { status: 'done', taskDone: 1, taskTotal: 1, nodeDone: 5, nodeTotal: 5 }),
      mkChange('b', { status: 'done', taskDone: 2, taskTotal: 2, nodeDone: 5, nodeTotal: 5 }),
    ])
    expect(p.overallStatus).toBe('done')
  })

  it('全 archived → overallStatus archived', () => {
    const p = aggregateProgress([
      mkChange('a', { status: 'archived', taskDone: 1, taskTotal: 1, nodeDone: 5, nodeTotal: 5 }),
    ])
    expect(p.overallStatus).toBe('archived')
  })

  it('混合 in_progress 与 done → overallStatus in_progress', () => {
    const p = aggregateProgress([
      mkChange('a', { status: 'done', taskDone: 1, taskTotal: 1, nodeDone: 5, nodeTotal: 5 }),
      mkChange('b', { status: 'in_progress', taskDone: 1, taskTotal: 2, nodeDone: 3, nodeTotal: 5 }),
    ])
    expect(p.overallStatus).toBe('in_progress')
  })
})

describe('computeRisks missing_required（轻量级 change 跳过）', () => {
  function changeWith(
    id: string,
    workflow: WorkflowNode[],
    fm?: ChangeSummary['frontmatter'],
  ): ChangeSummary {
    return {
      id,
      title: `title-${id}`,
      status: 'in_progress',
      archived: false,
      workflow,
      taskProgress: { total: 0, done: 0 },
      frontmatter: fm,
    }
  }
  function node(id: string, state: WorkflowNode['state']): WorkflowNode {
    return { id, phase: 'requirement', label: id, required: true, state }
  }

  it('完整型 change 缺必需文档 → 报 missing_required', () => {
    // 有脚手架（design.tech/impl.tasks done），但 req.draft 缺 → 完整型，应报黄风险
    const c = changeWith('c-complete', [
      node('req.draft', 'missing-required'),
      node('design.tech', 'done'),
      node('impl.tasks', 'done'),
    ])
    const risks = computeRisks([c], undefined, aggregateProgress([c]), new Map([[c.id, c]]))
    expect(risks.some((r) => r.kind === 'missing_required')).toBe(true)
  })

  it('轻量级 change（无脚手架）缺文档 → 不报 missing_required', () => {
    // 只有 proposal.md（req.review done），脚手架节点全缺 → 轻量级，不应报"缺必需文档"
    const c = changeWith('c-lite', [
      node('req.review', 'done'),
      node('req.draft', 'missing-required'),
      node('design.tech', 'missing-required'),
      node('impl.tasks', 'missing-required'),
    ])
    const risks = computeRisks([c], undefined, aggregateProgress([c]), new Map([[c.id, c]]))
    expect(risks.some((r) => r.kind === 'missing_required')).toBe(false)
  })

  it('完整型 + 显式 lifecycle → 不报 missing_required（纳入 requirement 的 anchor）', () => {
    // 有脚手架(design.tech/impl.tasks done)、缺 req.draft，但作者已用 lifecycle 追踪交付 → 豁免
    const c = changeWith(
      'c-anchor',
      [
        node('req.draft', 'missing-required'),
        node('design.tech', 'done'),
        node('impl.tasks', 'done'),
      ],
      { lifecycle: 'drafted' },
    )
    const risks = computeRisks([c], undefined, aggregateProgress([c]), new Map([[c.id, c]]))
    expect(risks.some((r) => r.kind === 'missing_required')).toBe(false)
  })
})

describe('inferStage（released 放宽:不依赖 archive）', () => {
  function ch(
    id: string,
    opts: { status: ChangeSummary['status']; archived?: boolean; lifecycle?: string },
  ): ChangeSummary {
    return {
      id,
      title: id,
      status: opts.status,
      archived: opts.archived ?? false,
      workflow: [],
      taskProgress: { total: 0, done: 0 },
      frontmatter: opts.lifecycle ? { lifecycle: opts.lifecycle } : undefined,
    }
  }

  it('全部 lifecycle shipped → released（无需 archive）', () => {
    expect(
      inferStage([
        ch('a', { status: 'done', lifecycle: 'shipped' }),
        ch('b', { status: 'done', lifecycle: 'shipped' }),
      ]),
    ).toBe('released')
  })

  it('shipped + reverted 混合 → released', () => {
    expect(
      inferStage([
        ch('a', { status: 'done', lifecycle: 'shipped' }),
        ch('b', { status: 'done', lifecycle: 'reverted' }),
      ]),
    ).toBe('released')
  })

  it('部分 shipped + 部分 drafted(in_progress) → in-dev', () => {
    expect(
      inferStage([
        ch('a', { status: 'done', lifecycle: 'shipped' }),
        ch('b', { status: 'in_progress', lifecycle: 'drafted' }),
      ]),
    ).toBe('in-dev')
  })

  it('全部 archived → 仍 released', () => {
    expect(
      inferStage([
        ch('a', { status: 'archived', archived: true }),
        ch('b', { status: 'archived', archived: true }),
      ]),
    ).toBe('released')
  })

  it('全 done 但无 lifecycle（未标交付）→ staged，不算 released', () => {
    expect(inferStage([ch('a', { status: 'done' }), ch('b', { status: 'done' })])).toBe('staged')
  })

  it('空列表 → planning', () => {
    expect(inferStage([])).toBe('planning')
  })
})

describe('listRequirements / findRequirement', () => {
  let tmp: string

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'req-'))
    fs.mkdirSync(path.join(tmp, 'requirements'), { recursive: true })
  })
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('有 frontmatter 的 change 按 requirementId 分桶；无 frontmatter 进 UNGROUPED', () => {
    const changes = [
      mkChange('c1', { status: 'done', taskDone: 1, taskTotal: 1, nodeDone: 5, nodeTotal: 5, requirementId: 'user-identity' }),
      mkChange('c2', { status: 'incomplete', taskDone: 0, taskTotal: 2, nodeDone: 1, nodeTotal: 5, requirementId: 'user-identity' }),
      mkChange('c3', { status: 'in_progress', taskDone: 1, taskTotal: 2, nodeDone: 3, nodeTotal: 5 }),
    ]
    fs.writeFileSync(
      path.join(tmp, 'requirements', 'user-identity.md'),
      '# 用户身份系统\n\n用户登录相关聚合需求。\n\n## 背景\n略'
    )
    const reqs = listRequirements(tmp, changes)
    const user = reqs.find((r) => r.id === 'user-identity')!
    const un = reqs.find((r) => r.id === UNGROUPED_ID)!
    expect(user).toBeDefined()
    expect(user.title).toBe('用户身份系统')
    expect(user.description).toBe('用户登录相关聚合需求。')
    expect(user.changeIds).toEqual(['c1', 'c2'])
    expect(user.progress.overallStatus).toBe('incomplete')
    expect(un.changeIds).toEqual(['c3'])
  })

  it('孤儿需求：requirements/<slug>.md 存在但无 change 引用', () => {
    fs.writeFileSync(path.join(tmp, 'requirements', 'lonely.md'), '# 孤儿需求\n\n描述。')
    const reqs = listRequirements(tmp, [])
    const lonely = reqs.find((r) => r.id === 'lonely')!
    expect(lonely.title).toBe('孤儿需求')
    expect(lonely.changeIds).toEqual([])
    expect(lonely.progress.totalChanges).toBe(0)
    expect(lonely.progress.overallStatus).toBe('incomplete')
  })

  it('无独立 md：title 兜底到第一个 change 的 title', () => {
    const reqs = listRequirements(tmp, [
      mkChange('a', { status: 'done', taskDone: 1, taskTotal: 1, nodeDone: 5, nodeTotal: 5, requirementId: 'phantom' }),
    ])
    const ph = reqs.find((r) => r.id === 'phantom')!
    expect(ph.title).toBe('title-a')
    expect(ph.description).toBeUndefined()
  })

  it('UNGROUPED 排在末尾', () => {
    fs.writeFileSync(path.join(tmp, 'requirements', 'b-req.md'), '# B')
    fs.writeFileSync(path.join(tmp, 'requirements', 'a-req.md'), '# A')
    const reqs = listRequirements(tmp, [
      mkChange('c1', { status: 'incomplete', taskDone: 0, taskTotal: 1, nodeDone: 0, nodeTotal: 5 }),
    ])
    expect(reqs.map((r) => r.id)).toEqual(['a-req', 'b-req', UNGROUPED_ID])
  })

  it('findRequirement 带 body', () => {
    fs.writeFileSync(path.join(tmp, 'requirements', 'x.md'), '# 标题\n\n描述段落。\n\n更多正文。')
    const r = findRequirement(tmp, [], 'x')!
    expect(r.id).toBe('x')
    expect(r.body).toContain('更多正文')
  })

  it('findRequirement 不存在返回 null', () => {
    expect(findRequirement(tmp, [], 'nope')).toBeNull()
  })
})
