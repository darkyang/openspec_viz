import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from './frontmatter.js'

describe('parseFrontmatter', () => {
  it('基本 key: value 对', () => {
    const r = parseFrontmatter('---\nrequirement: user-identity\ntitle: hi\n---\n# 正文')
    expect(r.meta).toEqual({ requirement: 'user-identity', title: 'hi' })
    expect(r.body).toBe('# 正文')
  })

  it('没有 frontmatter 时 meta 为空', () => {
    const r = parseFrontmatter('# 没有 frontmatter\n正文')
    expect(r.meta).toEqual({})
    expect(r.body).toBe('# 没有 frontmatter\n正文')
  })

  it('只有开头 fence 没收尾 → 视为无 frontmatter', () => {
    const r = parseFrontmatter('---\nkey: val\n# 没收尾\n')
    expect(r.meta).toEqual({})
    expect(r.body).toBe('---\nkey: val\n# 没收尾\n')
  })

  it('引号值被剥离', () => {
    const r = parseFrontmatter('---\na: "双引号"\nb: \'单引号\'\nc: 无引号\n---\n')
    expect(r.meta).toEqual({ a: '双引号', b: '单引号', c: '无引号' })
  })

  it('数组（flow + block）', () => {
    const r = parseFrontmatter(
      '---\nflowList: [a, b, c]\nblockList:\n  - x\n  - y\n---\nbody',
    )
    expect(r.meta).toEqual({ flowList: ['a', 'b', 'c'], blockList: ['x', 'y'] })
    expect(r.body).toBe('body')
  })

  it('嵌套对象', () => {
    const r = parseFrontmatter('---\ntest_results:\n  TC-1: failed\n  TC-2: passed\n---\nbody')
    expect(r.meta).toEqual({ test_results: { 'TC-1': 'failed', 'TC-2': 'passed' } })
  })

  it('数字与布尔', () => {
    const r = parseFrontmatter('---\ncount: 5\nactive: true\n---\n')
    expect(r.meta).toEqual({ count: 5, active: true })
  })

  it('非法 YAML → 退回空 meta（不抛）', () => {
    // 缩进错乱 + 列表混 dict 同级 → js-yaml 会抛，包内吞掉返回空 meta
    const r = parseFrontmatter('---\nkey: val\n  nested: bad\n- item\n---\nbody')
    expect(r.meta).toEqual({})
    expect(r.body).toBe('body')
  })

  it('容忍 BOM', () => {
    const r = parseFrontmatter('﻿---\nrequirement: bom\n---\ntext')
    expect(r.meta.requirement).toBe('bom')
    expect(r.body).toBe('text')
  })

  it('CRLF 行结束符兼容', () => {
    const r = parseFrontmatter('---\r\nrequirement: crlf\r\n---\r\ntext\r\n')
    expect(r.meta.requirement).toBe('crlf')
    expect(r.body).toBe('text\n')
  })

  it('值里带冒号（合法 YAML：URL 单值）', () => {
    const r = parseFrontmatter('---\nurl: https://example.com/foo\n---\n')
    expect(r.meta.url).toBe('https://example.com/foo')
  })
})
