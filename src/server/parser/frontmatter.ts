/**
 * YAML frontmatter 解析器（js-yaml backed）。
 *
 *   ---
 *   key: value
 *   list: [a, b]
 *   nested:
 *     k: v
 *   ---
 *   <body...>
 *
 * 支持完整 YAML 语法（数组、嵌套、多行 scalar 等）。解析失败时返回空 meta + 原始 body，
 * 不抛异常，保持调用方韧性。
 */

import yaml from 'js-yaml'

export interface Frontmatter {
  meta: Record<string, unknown>
  body: string
}

const FENCE_RE = /^---\s*$/

export function parseFrontmatter(content: string): Frontmatter {
  const lines = content.split(/\r?\n/)
  if (lines.length < 2) return { meta: {}, body: content }
  const firstRaw = lines[0].replace(/^﻿/, '')
  if (!FENCE_RE.test(firstRaw)) return { meta: {}, body: content }

  let endIdx = -1
  for (let i = 1; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) {
      endIdx = i
      break
    }
  }
  if (endIdx === -1) {
    return { meta: {}, body: content }
  }

  const yamlBlock = lines.slice(1, endIdx).join('\n')
  const body = lines.slice(endIdx + 1).join('\n')

  let meta: Record<string, unknown> = {}
  try {
    const parsed = yaml.load(yamlBlock)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      meta = parsed as Record<string, unknown>
    }
  } catch {
    // YAML 解析失败 — 退回空 meta，保持 body 可用
  }
  return { meta, body }
}
