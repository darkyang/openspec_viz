import fs from 'node:fs'
import path from 'node:path'

/**
 * 像 git 一样从 startDir 向上递归查找 openspec/ 目录。
 * 找到的判定:存在 changes/ 或 specs/ 子目录。
 */
export function findOpenspecRoot(startDir: string): string | null {
  let dir = path.resolve(startDir)
  // 如果 startDir 本身就是 openspec/(包含 changes/ 或 specs/),直接用
  if (looksLikeOpenspec(dir)) return dir

  while (true) {
    const candidate = path.join(dir, 'openspec')
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() && looksLikeOpenspec(candidate)) {
      return candidate
    }
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function looksLikeOpenspec(dir: string): boolean {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false
  return fs.existsSync(path.join(dir, 'changes')) || fs.existsSync(path.join(dir, 'specs'))
}
