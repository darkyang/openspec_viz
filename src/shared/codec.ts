/**
 * frontmatter YAML scalar → 安全取值的编解码器。**单点定义**，change.ts / requirement.ts 共用
 * （此前两边各写一套：change.ts 的 asString/asStringArray/asStringDict 与 requirement.ts
 * extractRequirementMeta 里内联的同款 string/Date 处理）。
 *
 * js-yaml 会把无引号的 ISO 日期 scalar 解析成 Date、把不带引号的 commit hash / 版本号当成
 * number —— 这里统一兜成字符串，让上层 UI 直接渲染。
 */

/** YAML scalar → string（非空）。Date → YYYY-MM-DD；number/boolean → String()；空串/其它 → undefined。 */
export function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v.length > 0 ? v : undefined
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10)
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return undefined
}

/** YAML 序列 → string[]（过滤非字符串与空串）；空数组 / 非数组 → undefined。 */
export function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v.filter((x): x is string => typeof x === 'string' && x.length > 0)
  return out.length > 0 ? out : undefined
}

/** YAML map → Record<string,string>（仅保留字符串值）；空 / 非对象 → undefined。 */
export function asStringDict(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const entries = Object.entries(v as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}
