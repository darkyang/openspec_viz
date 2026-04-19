import chokidar, { type FSWatcher } from 'chokidar'
import path from 'node:path'

export type FileChangeListener = (info: {
  changeId: string | null
  archived: boolean
  filePath: string
  kind: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
}) => void

export interface Watcher {
  close: () => Promise<void>
}

const DEBOUNCE_MS = 200

export function startWatcher(openspecRoot: string, listener: FileChangeListener): Watcher {
  const changesDir = path.join(openspecRoot, 'changes')

  const watcher: FSWatcher = chokidar.watch(openspecRoot, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    ignored: (p: string) => {
      const base = path.basename(p)
      return base.startsWith('.') && base !== '.'
    },
  })

  // debounce per absolute path
  const pending = new Map<string, NodeJS.Timeout>()

  function emit(absPath: string, kind: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir') {
    const existing = pending.get(absPath)
    if (existing) clearTimeout(existing)
    const t = setTimeout(() => {
      pending.delete(absPath)
      const info = classify(absPath, changesDir, kind)
      listener(info)
    }, DEBOUNCE_MS)
    pending.set(absPath, t)
  }

  watcher.on('add', (p) => emit(p, 'add'))
  watcher.on('change', (p) => emit(p, 'change'))
  watcher.on('unlink', (p) => emit(p, 'unlink'))
  watcher.on('addDir', (p) => emit(p, 'addDir'))
  watcher.on('unlinkDir', (p) => emit(p, 'unlinkDir'))
  watcher.on('error', (err) => console.error('[watcher] error', err))

  console.log(`[watcher] watching ${openspecRoot}`)

  return {
    close: () => watcher.close(),
  }
}

function classify(
  absPath: string,
  changesDir: string,
  kind: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
): Parameters<FileChangeListener>[0] {
  const relFromRoot = path.relative(changesDir, absPath).split(path.sep).join('/')
  if (relFromRoot.startsWith('..') || relFromRoot === '') {
    return { changeId: null, archived: false, filePath: absPath, kind }
  }
  const parts = relFromRoot.split('/')
  if (parts[0] === 'archive') {
    return {
      changeId: parts[1] ?? null,
      archived: true,
      filePath: relFromRoot,
      kind,
    }
  }
  return {
    changeId: parts[0] ?? null,
    archived: false,
    filePath: relFromRoot,
    kind,
  }
}
