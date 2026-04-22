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

  it('嵌套/无效行静默忽略，不抛', () => {
    const r = parseFrontmatter('---\nrequirement: foo\n  nested: bar\n- item\n---\nbody')
    expect(r.meta).toEqual({ requirement: 'foo' })
    expect(r.body).toBe('body')
  })

  it('容忍 BOM', () => {
    const r = parseFrontmatter('\uFEFF---\nrequirement: bom\n---\ntext')
    expect(r.meta.requirement).toBe('bom')
    expect(r.body).toBe('text')
  })

  it('CRLF 行结束符兼容', () => {
    const r = parseFrontmatter('---\r\nrequirement: crlf\r\n---\r\ntext\r\n')
    expect(r.meta.requirement).toBe('crlf')
    // body 是 split(/\r?\n/) 后 join('\n')，所以会丢 \r
    expect(r.body).toBe('text\n')
  })

  it('值里带冒号', () => {
    const r = parseFrontmatter('---\nurl: https://example.com/foo\n---\n')
    expect(r.meta.url).toBe('https://example.com/foo')
  })
})
