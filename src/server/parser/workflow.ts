import fs from 'node:fs'
import path from 'node:path'
import type { WorkflowNode, NodeState, TaskProgress } from '../types.js'
import { WORKFLOW_NODES, type NodeSpec } from './workflow-spec.js'
import { parseTasksFromFile } from './tasks.js'

function isFileNonEmpty(p: string): boolean {
  if (!fs.existsSync(p)) return false
  const st = fs.statSync(p)
  if (!st.isFile()) return false
  return st.size > 0
}

function isFileExists(p: string): boolean {
  if (!fs.existsSync(p)) return false
  return fs.statSync(p).isFile()
}

function dirHasFiles(p: string): { ok: boolean; files: string[] } {
  if (!fs.existsSync(p)) return { ok: false, files: [] }
  const st = fs.statSync(p)
  if (!st.isDirectory()) return { ok: false, files: [] }
  const entries = fs.readdirSync(p).filter((n) => !n.startsWith('.'))
  return { ok: entries.length > 0, files: entries }
}

function detectState(
  spec: NodeSpec,
  changeRoot: string,
  taskProgressCache: { value: TaskProgress | null }
): { state: NodeState; filePath?: string; count?: number; files?: string[] } {
  const abs = path.join(changeRoot, spec.path)

  switch (spec.detector) {
    case 'file-exists': {
      const ok = isFileExists(abs)
      return { state: nodeStateFor(spec, ok), filePath: ok ? spec.path : undefined }
    }
    case 'file-non-empty': {
      const ok = isFileNonEmpty(abs)
      return { state: nodeStateFor(spec, ok), filePath: ok ? spec.path : undefined }
    }
    case 'dir-has-files': {
      const { ok, files } = dirHasFiles(abs)
      return {
        state: nodeStateFor(spec, ok),
        filePath: ok ? spec.path : undefined,
        count: files.length,
        files: files.map((f) => `${spec.path}/${f}`),
      }
    }
    case 'tasks-exists': {
      const ok = isFileExists(abs)
      if (ok && taskProgressCache.value === null) {
        taskProgressCache.value = parseTasksFromFile(abs)
      }
      return { state: nodeStateFor(spec, ok), filePath: ok ? spec.path : undefined }
    }
    case 'tasks-has-any-done': {
      if (!isFileExists(abs)) return { state: nodeStateFor(spec, false) }
      if (taskProgressCache.value === null) {
        taskProgressCache.value = parseTasksFromFile(abs)
      }
      const tp = taskProgressCache.value
      const ok = !!(tp && tp.done > 0)
      return { state: nodeStateFor(spec, ok), filePath: ok ? spec.path : undefined }
    }
    case 'tasks-all-done': {
      if (!isFileExists(abs)) return { state: nodeStateFor(spec, false) }
      if (taskProgressCache.value === null) {
        taskProgressCache.value = parseTasksFromFile(abs)
      }
      const tp = taskProgressCache.value
      const ok = !!(tp && tp.total > 0 && tp.done === tp.total)
      return { state: nodeStateFor(spec, ok), filePath: ok ? spec.path : undefined }
    }
  }
}

function nodeStateFor(spec: NodeSpec, signalMet: boolean): NodeState {
  if (signalMet) return 'done'
  return spec.required ? 'missing-required' : 'empty'
}

export interface WorkflowResult {
  nodes: WorkflowNode[]
  taskProgress: TaskProgress
}

export function detectWorkflow(changeRoot: string): WorkflowResult {
  const taskProgressCache: { value: TaskProgress | null } = { value: null }
  const nodes: WorkflowNode[] = WORKFLOW_NODES.map((spec) => {
    const r = detectState(spec, changeRoot, taskProgressCache)
    return {
      id: spec.id,
      phase: spec.phase,
      label: spec.label,
      required: spec.required,
      state: r.state,
      filePath: r.filePath,
      count: r.count,
      files: r.files,
    }
  })
  return {
    nodes,
    taskProgress: taskProgressCache.value ?? { total: 0, done: 0 },
  }
}
