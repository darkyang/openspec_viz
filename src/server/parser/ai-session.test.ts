import { describe, it, expect } from 'vitest'
import path from 'node:path'
import {
  parseSessionFromString,
  attributeToChanges,
  sessionsDirForProject,
} from './ai-session.js'

function line(obj: unknown) {
  return JSON.stringify(obj)
}

describe('parseSessionFromString', () => {
  it('聚合 user / assistant turns、tokens、tool 调用', () => {
    const jsonl = [
      line({ type: 'user', sessionId: 's1', timestamp: '2026-04-21T00:00:00.000Z', message: { role: 'user', content: [{ type: 'text', text: 'hi' }] } }),
      line({
        type: 'assistant',
        sessionId: 's1',
        timestamp: '2026-04-21T00:00:01.000Z',
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: '/abs/a.ts' } },
            { type: 'tool_use', name: 'Edit', input: { file_path: '/abs/b.ts' } },
          ],
          usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5, cache_creation_input_tokens: 3 },
        },
      }),
      line({
        type: 'user',
        sessionId: 's1',
        timestamp: '2026-04-21T00:00:02.000Z',
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', is_error: true }] },
      }),
    ].join('\n')

    const s = parseSessionFromString(jsonl, '/tmp/s1.jsonl')
    expect(s.sessionId).toBe('s1')
    expect(s.userTurns).toBe(1) // tool_result 不计 user turn
    expect(s.assistantTurns).toBe(1)
    expect(s.model).toBe('claude-sonnet-4-6')
    expect(s.toolCalls).toEqual({ Read: 1, Edit: 1 })
    expect(s.tokens).toEqual({ input: 10, output: 20, cacheRead: 5, cacheCreation: 3 })
    expect(s.errorCount).toBe(1)
    expect(s.touchedFiles.sort()).toEqual(['/abs/a.ts', '/abs/b.ts'])
    expect(s.startedAt).toBe('2026-04-21T00:00:00.000Z')
    expect(s.endedAt).toBe('2026-04-21T00:00:02.000Z')
    expect(s.durationMs).toBe(2000)
  })

  it('容错坏 JSON 行，不抛', () => {
    const jsonl = [
      '{not valid json',
      line({ type: 'user', sessionId: 's2', timestamp: '2026-04-21T00:00:00.000Z', message: { role: 'user', content: [{ type: 'text', text: 'hi' }] } }),
      '',
      'garbage',
    ].join('\n')
    const s = parseSessionFromString(jsonl, '/tmp/s2.jsonl')
    expect(s.sessionId).toBe('s2')
    expect(s.userTurns).toBe(1)
  })

  it('无 sessionId 时用文件名兜底', () => {
    const s = parseSessionFromString('', '/tmp/abc-123.jsonl')
    expect(s.sessionId).toBe('abc-123')
    expect(s.userTurns).toBe(0)
    expect(s.assistantTurns).toBe(0)
    expect(s.durationMs).toBe(0)
  })

  it('多轮多模型：取最后一次 model', () => {
    const jsonl = [
      line({ type: 'assistant', timestamp: '2026-04-21T00:00:00.000Z', message: { role: 'assistant', model: 'claude-haiku-4-5', content: [], usage: { input_tokens: 1, output_tokens: 2 } } }),
      line({ type: 'assistant', timestamp: '2026-04-21T00:00:01.000Z', message: { role: 'assistant', model: 'claude-sonnet-4-6', content: [], usage: { input_tokens: 3, output_tokens: 4 } } }),
    ].join('\n')
    const s = parseSessionFromString(jsonl, '/tmp/m.jsonl')
    expect(s.model).toBe('claude-sonnet-4-6')
    expect(s.tokens).toEqual({ input: 4, output: 6, cacheRead: 0, cacheCreation: 0 })
  })
})

describe('attributeToChanges', () => {
  const openspecRoot = '/proj/openspec'

  it('按命中次数归因，最高为 primary', () => {
    const summary = parseSessionFromString(
      [
        line({ type: 'assistant', sessionId: 's', timestamp: '2026-04-21T00:00:00.000Z', message: { role: 'assistant', content: [
          { type: 'tool_use', name: 'Edit', input: { file_path: '/proj/openspec/changes/foo/proposal.md' } },
          { type: 'tool_use', name: 'Edit', input: { file_path: '/proj/openspec/changes/foo/tasks.md' } },
          { type: 'tool_use', name: 'Edit', input: { file_path: '/proj/openspec/changes/bar/proposal.md' } },
          { type: 'tool_use', name: 'Edit', input: { file_path: '/proj/src/index.ts' } },
        ] } }),
      ].join('\n'),
      '/tmp/s.jsonl'
    )
    const attrs = attributeToChanges(summary, openspecRoot)
    expect(attrs).toHaveLength(2)
    const foo = attrs.find((a) => a.changeId === 'foo')!
    const bar = attrs.find((a) => a.changeId === 'bar')!
    expect(foo.hitCount).toBe(2)
    expect(foo.primary).toBe(true)
    expect(bar.hitCount).toBe(1)
    expect(bar.primary).toBe(false)
    expect(foo.archived).toBe(false)
  })

  it('识别 archive 下的 change', () => {
    const summary = parseSessionFromString(
      line({ type: 'assistant', sessionId: 's', timestamp: '2026-04-21T00:00:00.000Z', message: { role: 'assistant', content: [
        { type: 'tool_use', name: 'Read', input: { file_path: '/proj/openspec/changes/archive/legacy/proposal.md' } },
      ] } }),
      '/tmp/s.jsonl'
    )
    const attrs = attributeToChanges(summary, openspecRoot)
    expect(attrs).toEqual([
      { changeId: 'legacy', archived: true, sessionId: 's', hitCount: 1, primary: true },
    ])
  })

  it('无命中返回空数组', () => {
    const summary = parseSessionFromString(
      line({ type: 'assistant', timestamp: '2026-04-21T00:00:00.000Z', message: { role: 'assistant', content: [
        { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
      ] } }),
      '/tmp/s.jsonl'
    )
    expect(attributeToChanges(summary, openspecRoot)).toEqual([])
  })

  it('相对路径按 session.cwd 解析', () => {
    const summary = parseSessionFromString(
      line({ type: 'assistant', sessionId: 's', cwd: '/proj', timestamp: '2026-04-21T00:00:00.000Z', message: { role: 'assistant', content: [
        { type: 'tool_use', name: 'Read', input: { file_path: 'openspec/changes/foo/proposal.md' } },
      ] } }),
      '/tmp/s.jsonl'
    )
    const attrs = attributeToChanges(summary, openspecRoot)
    expect(attrs).toEqual([
      { changeId: 'foo', archived: false, sessionId: 's', hitCount: 1, primary: true },
    ])
  })
})

describe('sessionsDirForProject', () => {
  it('按 cwd → dash 规则推导 slug 目录（含下划线替换）', () => {
    const dir = sessionsDirForProject('/Users/simon/Workspace/tool/openspec_viz')
    expect(path.basename(dir)).toBe('-Users-simon-Workspace-tool-openspec-viz')
    expect(dir).toContain(path.join('.claude', 'projects'))
  })

  it('点号和下划线都替换为 -', () => {
    const dir = sessionsDirForProject('/Users/x/repo/.claude-worktrees/foo_bar')
    expect(path.basename(dir)).toBe('-Users-x-repo--claude-worktrees-foo-bar')
  })
})
