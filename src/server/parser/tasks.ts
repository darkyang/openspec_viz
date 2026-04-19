import fs from 'node:fs'
import type { TaskProgress } from '../types.js'

const CHECKBOX_RE = /^\s*[-*+]\s+\[([ xX\-])\]/

export function parseTasksFromString(content: string): TaskProgress {
  let total = 0
  let done = 0
  for (const line of content.split(/\r?\n/)) {
    const m = CHECKBOX_RE.exec(line)
    if (!m) continue
    total += 1
    const flag = m[1]
    if (flag === 'x' || flag === 'X') done += 1
    // '-' 视为 skipped/cancelled,不算 done 也不计入 total? 这里保持算 total 但不算 done
    // 这与 GitHub task list 行为一致(- 不渲染为完成)
  }
  return { total, done }
}

export function parseTasksFromFile(filePath: string): TaskProgress | null {
  if (!fs.existsSync(filePath)) return null
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return parseTasksFromString(content)
  } catch {
    return null
  }
}
