import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { appendComment, EmptyCommentError } from './comments-writer.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comments-writer-'))
})
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('appendComment', () => {
  it('首次调用自动创建 comments.md 并写入头', () => {
    const r = appendComment(tmpDir, '第一条评论')
    expect(r.created).toBe(true)
    const md = fs.readFileSync(r.filePath, 'utf-8')
    expect(md.startsWith('# Comments\n\n')).toBe(true)
    expect(md).toMatch(/---\n\n\*\*\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\*\*\n\n第一条评论\n$/)
  })

  it('第二次追加保留历史、只追加新块', () => {
    appendComment(tmpDir, '第一条')
    const r2 = appendComment(tmpDir, '第二条')
    expect(r2.created).toBe(false)
    const md = fs.readFileSync(r2.filePath, 'utf-8')
    expect((md.match(/---/g) ?? []).length).toBe(2)
    expect(md).toContain('第一条')
    expect(md).toContain('第二条')
    // 第一条在前
    expect(md.indexOf('第一条')).toBeLessThan(md.indexOf('第二条'))
  })

  it('空字符串或只含空白 → 抛 EmptyCommentError', () => {
    expect(() => appendComment(tmpDir, '')).toThrow(EmptyCommentError)
    expect(() => appendComment(tmpDir, '   \n\t  ')).toThrow(EmptyCommentError)
    // 没创建文件
    expect(fs.existsSync(path.join(tmpDir, 'comments.md'))).toBe(false)
  })

  it('多行正文原样保留', () => {
    const text = '标题\n\n正文第一段\n正文第二段'
    const r = appendComment(tmpDir, text)
    const md = fs.readFileSync(r.filePath, 'utf-8')
    expect(md).toContain('标题\n\n正文第一段\n正文第二段\n')
  })

  it('CRLF 规范化为 LF', () => {
    const r = appendComment(tmpDir, 'A\r\nB\r\n')
    const md = fs.readFileSync(r.filePath, 'utf-8')
    expect(md).not.toContain('\r')
    expect(md).toContain('A\nB\n')
  })

  it('totalBytes 递增', () => {
    const r1 = appendComment(tmpDir, 'one')
    const r2 = appendComment(tmpDir, 'two')
    expect(r2.totalBytes).toBeGreaterThan(r1.totalBytes)
  })
})
