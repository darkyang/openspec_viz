/**
 * 极简 YAML frontmatter 解析器，支持：
 *   ---\n
 *   key: value\n
 *   key2: value2\n
 *   ---\n
 *   <body...>
 *
 * 只支持**扁平的 key: value 字符串对**；嵌套/数组/多行 scalar 都不支持（遇到直接忽略该行）。
 * 目的：避免为"读一行 requirement 标识"引入 js-yaml 依赖。
 */

export interface Frontmatter {
  meta: Record<string, string>
  body: string
}

const FENCE_RE = /^---\s*$/
const KV_RE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/

function stripQuotes(v: string): string {
  const t = v.trim()
  if (t.length >= 2) {
    const first = t[0]
    const last = t[t.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return t.slice(1, -1)
    }
  }
  return t
}

export function parseFrontmatter(content: string): Frontmatter {
  const lines = content.split(/\r?\n/)
  // 必须第一行就是 --- （允许文件开头 UTF-8 BOM）
  if (lines.length < 2) return { meta: {}, body: content }
  const firstRaw = lines[0].replace(/^\uFEFF/, '')
  if (!FENCE_RE.test(firstRaw)) return { meta: {}, body: content }

  const meta: Record<string, string> = {}
  let endIdx = -1
  for (let i = 1; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) {
      endIdx = i
      break
    }
    const m = KV_RE.exec(lines[i])
    if (!m) continue // 静默忽略不合法行
    const [, key, rawVal] = m
    meta[key] = stripQuotes(rawVal)
  }
  if (endIdx === -1) {
    // 没找到收尾 fence —— 视为没有 frontmatter，保留原内容
    return { meta: {}, body: content }
  }
  const body = lines.slice(endIdx + 1).join('\n')
  return { meta, body }
}
