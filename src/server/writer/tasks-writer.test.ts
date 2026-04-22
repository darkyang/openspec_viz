import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { toggleTaskLine, LineMismatchError } from './tasks-writer.js'

let tmpDir: string
let file: string

function write(content: string) {
  fs.writeFileSync(file, content, 'utf-8')
}
function read(): string {
  return fs.readFileSync(file, 'utf-8')
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-writer-'))
  file = path.join(tmpDir, 'tasks.md')
})
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('toggleTaskLine', () => {
  it('[ ] → [x]', () => {
    write('- [ ] 写测试\n- [ ] 跑测试\n')
    const r = toggleTaskLine(file, 1, true)
    expect(r).toEqual({ ok: true, flag: 'x', previousFlag: ' ' })
    expect(read()).toBe('- [x] 写测试\n- [ ] 跑测试\n')
  })

  it('[x] → [ ]', () => {
    write('- [x] 已完成\n')
    toggleTaskLine(file, 1, false)
    expect(read()).toBe('- [ ] 已完成\n')
  })

  it('[X] → [ ]（大写 X 视同 done）', () => {
    write('- [X] 大写\n')
    const r = toggleTaskLine(file, 1, false)
    expect(r.previousFlag).toBe('X')
    expect(read()).toBe('- [ ] 大写\n')
  })

  it('[-] → [x]（skipped 状态也可回写）', () => {
    write('- [-] 跳过\n')
    const r = toggleTaskLine(file, 1, true)
    expect(r.previousFlag).toBe('-')
    expect(read()).toBe('- [x] 跳过\n')
  })

  it('支持缩进与 * / + 作为 bullet', () => {
    write('  * [ ] 缩进子任务\n+ [ ] 加号 bullet\n')
    toggleTaskLine(file, 1, true)
    toggleTaskLine(file, 2, true)
    expect(read()).toBe('  * [x] 缩进子任务\n+ [x] 加号 bullet\n')
  })

  it('目标行不是 checkbox → 抛 LineMismatchError', () => {
    write('# Tasks\n\n- [ ] 真任务\n')
    expect(() => toggleTaskLine(file, 1, true)).toThrow(LineMismatchError)
    expect(() => toggleTaskLine(file, 2, true)).toThrow(LineMismatchError)
    // 文件未被破坏
    expect(read()).toBe('# Tasks\n\n- [ ] 真任务\n')
  })

  it('超出行数 → 抛 LineMismatchError，currentLine 为 null', () => {
    write('- [ ] only\n')
    try {
      toggleTaskLine(file, 99, true)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(LineMismatchError)
      expect((e as LineMismatchError).currentLine).toBeNull()
    }
  })

  it('只改目标行，其他 checkbox 不受影响', () => {
    write('- [ ] a\n- [ ] b\n- [ ] c\n')
    toggleTaskLine(file, 2, true)
    expect(read()).toBe('- [ ] a\n- [x] b\n- [ ] c\n')
  })

  it('保留行尾描述文字不变', () => {
    write('- [ ] 一个任务，带逗号 [bracket] 与 backtick `code`\n')
    toggleTaskLine(file, 1, true)
    expect(read()).toBe('- [x] 一个任务，带逗号 [bracket] 与 backtick `code`\n')
  })
})
