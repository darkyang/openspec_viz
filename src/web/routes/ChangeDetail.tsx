import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { api } from '../lib/api'
import { WorkflowGraph, statusBadge } from '../components/WorkflowGraph'
import { FileTree } from '../components/FileTree'
import { MarkdownView } from '../components/MarkdownView'
import type { FileTreeNode } from '../../shared/types'

const PREFERRED_DEFAULT = ['proposal.md', 'requirement/01-draft.md', 'design.md', 'tasks.md']

function flattenFiles(node: FileTreeNode, acc: string[] = []): string[] {
  if (node.type === 'file') acc.push(node.path)
  if (node.children) for (const c of node.children) flattenFiles(c, acc)
  return acc
}

function pickDefaultFile(tree: FileTreeNode): string | null {
  const files = flattenFiles(tree)
  for (const p of PREFERRED_DEFAULT) {
    if (files.includes(p)) return p
  }
  return files.find((p) => p.endsWith('.md')) ?? files[0] ?? null
}

export function ChangeDetailRoute() {
  const { id = '' } = useParams<{ id: string }>()
  const { data: change, loading, error, reload } = useFetch(() => api.change(id), [id])

  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  // SSE: 当前 change 被修改时,刷新
  useLiveEvents((ev) => {
    if (ev.changeId === id) reload()
  })

  // 当 change 数据到达,自动选默认文件
  useEffect(() => {
    if (change && selectedFile === null) {
      setSelectedFile(pickDefaultFile(change.files))
    }
  }, [change, selectedFile])

  // change id 变化时重置 selectedFile
  useEffect(() => {
    setSelectedFile(null)
  }, [id])

  const fileQuery = useFetch(
    () => (selectedFile ? api.changeFile(id, selectedFile) : Promise.resolve(null)),
    [id, selectedFile]
  )

  // SSE: 当前文件改了也刷新
  useLiveEvents((ev) => {
    if (ev.changeId === id && selectedFile && ev.filePath?.endsWith(selectedFile)) {
      fileQuery.reload()
    }
  })

  const badge = change ? statusBadge(change.status) : null

  return (
    <div>
      <div className="text-sm text-zinc-500 mb-2">
        <Link to="/changes" className="hover:text-zinc-900">
          ← Changes
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-semibold">{change?.title ?? id}</h1>
        {badge && (
          <span className={`text-[11px] px-1.5 py-0.5 rounded border ${badge.cls}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="text-xs font-mono text-zinc-400 mb-4">{id}</div>

      {loading && <div className="text-zinc-400 text-sm">loading…</div>}
      {error && <div className="text-red-600 text-sm">error: {error.message}</div>}

      {change && (
        <>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 mb-5">
            <div className="text-xs font-medium text-zinc-500 mb-3">工作流</div>
            <WorkflowGraph nodes={change.workflow} variant="full" />
            <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center gap-4 text-xs text-zinc-500">
              <span className="font-mono">
                tasks {change.taskProgress.done}/{change.taskProgress.total}
              </span>
              <span className="font-mono">
                {change.workflow.filter((n) => n.state === 'done').length}/{change.workflow.length} nodes done
              </span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4 lg:col-span-3 rounded-lg border border-zinc-200 bg-white p-2 max-h-[600px] overflow-y-auto">
              <FileTree
                tree={change.files}
                selectedPath={selectedFile}
                onSelect={setSelectedFile}
              />
            </div>
            <div className="col-span-8 lg:col-span-9 rounded-lg border border-zinc-200 bg-white p-5 min-h-[400px]">
              {selectedFile === null && (
                <div className="text-zinc-400 text-sm">点左侧选一个文件</div>
              )}
              {selectedFile && (
                <>
                  <div className="text-xs font-mono text-zinc-400 mb-3 pb-3 border-b border-zinc-100">
                    {selectedFile}
                  </div>
                  {fileQuery.loading && <div className="text-zinc-400 text-sm">loading…</div>}
                  {fileQuery.error && (
                    <div className="text-red-600 text-sm">error: {fileQuery.error.message}</div>
                  )}
                  {fileQuery.data && (
                    <MarkdownView content={fileQuery.data.content} filePath={selectedFile} />
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
