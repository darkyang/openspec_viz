import fs from 'node:fs'

/**
 * 与 parser/tasks.ts 中 CHECKBOX_RE 同源的格式定义。
 * 写操作用**稍宽松**的捕获（保留原始 bullet 字符与内部空格），避免覆盖用户原排版。
 * 行首必须是 - / * / + 后跟 [?]。捕获三组：
 *   1: bullet 前缀（缩进 + 标志 + 空格），例如 "  - "
 *   2: flag 字符，单个 [ xX-]
 *   3: 标志之后剩余部分
 */
const TARGET_RE = /^([\s]*[-*+]\s+\[)([ xX-])(\].*)$/

export class LineMismatchError extends Error {
  readonly currentLine: string | null
  constructor(message: string, currentLine: string | null) {
    super(message)
    this.name = 'LineMismatchError'
    this.currentLine = currentLine
  }
}

export interface ToggleResult {
  ok: true
  /** 新标志字符，一律写入 'x' 或 ' '（保持小写 x 一致性） */
  flag: 'x' | ' '
  /** 改动前的原始标志字符 */
  previousFlag: string
}

/**
 * 按行号 toggle checkbox。line 以 **1 开始**（与 remark position 对齐）。
 * 目标行必须匹配 TARGET_RE，否则抛 LineMismatchError（用于服务端 409 响应）。
 */
export function toggleTaskLine(filePath: string, line: number, checked: boolean): ToggleResult {
  const content = fs.readFileSync(filePath, 'utf-8')
  // 用 '\n' 切保留换行风格；写回时重新 join('\n') 会把 CRLF 变 LF——openspec 目录里的 md 默认 LF，v1 不兼容 CRLF。
  const lines = content.split('\n')
  if (line < 1 || line > lines.length) {
    throw new LineMismatchError(`line ${line} out of range (file has ${lines.length} lines)`, null)
  }
  const idx = line - 1
  const orig = lines[idx]
  const m = TARGET_RE.exec(orig)
  if (!m) {
    throw new LineMismatchError(`line ${line} is not a task checkbox`, orig)
  }
  const prefix = m[1]
  const previousFlag = m[2]
  const suffix = m[3]
  const newFlag: 'x' | ' ' = checked ? 'x' : ' '
  lines[idx] = `${prefix}${newFlag}${suffix}`
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8')
  return { ok: true, flag: newFlag, previousFlag }
}
