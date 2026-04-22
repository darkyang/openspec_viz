import fs from 'node:fs'
import path from 'node:path'

export class EmptyCommentError extends Error {
  constructor() {
    super('comment text is empty')
    this.name = 'EmptyCommentError'
  }
}

export interface AppendResult {
  ok: true
  filePath: string
  totalBytes: number
  created: boolean
}

/** 瑞典 locale ≈ ISO-8601，带本地时区但去掉 T；`2026-04-22 15:30:42` */
function nowLocalIso(): string {
  return new Date().toLocaleString('sv')
}

/**
 * 向 changeRoot 下 comments.md 追加一条评论。
 * - 文件不存在则新建，写入固定头 `# Comments\n\n`
 * - text 必须非空（trim 后）
 */
export function appendComment(changeRoot: string, text: string): AppendResult {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+$/g, '').trimStart()
  if (normalized.length === 0) throw new EmptyCommentError()

  const filePath = path.join(changeRoot, 'comments.md')
  const exists = fs.existsSync(filePath)
  if (!exists) {
    fs.writeFileSync(filePath, '# Comments\n\n', 'utf-8')
  }

  const block = `\n---\n\n**${nowLocalIso()}**\n\n${normalized}\n`
  fs.appendFileSync(filePath, block, 'utf-8')
  const totalBytes = fs.statSync(filePath).size
  return { ok: true, filePath, totalBytes, created: !exists }
}
