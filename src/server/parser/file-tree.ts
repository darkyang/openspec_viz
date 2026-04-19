import fs from 'node:fs'
import path from 'node:path'
import type { FileTreeNode } from '../types.js'

const IGNORE = new Set(['.DS_Store', '.git'])

export function readFileTree(root: string, relPath = ''): FileTreeNode {
  const abs = path.join(root, relPath)
  const st = fs.statSync(abs)
  const name = relPath === '' ? path.basename(root) : path.basename(relPath)
  const posixPath = relPath.split(path.sep).join('/')

  if (st.isDirectory()) {
    const entries = fs
      .readdirSync(abs)
      .filter((n) => !IGNORE.has(n))
      .sort((a, b) => {
        const aIsDir = fs.statSync(path.join(abs, a)).isDirectory()
        const bIsDir = fs.statSync(path.join(abs, b)).isDirectory()
        if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
        return a.localeCompare(b)
      })
    const children = entries.map((entry) =>
      readFileTree(root, relPath === '' ? entry : path.join(relPath, entry))
    )
    return {
      name,
      path: posixPath,
      type: 'directory',
      children,
      mtime: st.mtimeMs,
    }
  }

  return {
    name,
    path: posixPath,
    type: 'file',
    size: st.size,
    mtime: st.mtimeMs,
  }
}
