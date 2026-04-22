import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { MarkdownView } from './MarkdownView'
import type { FileTreeNode } from '../../shared/types'

interface Props {
  changeId: string
  /** 用来判断 comments.md 是否已存在（不存在时不发 fetch，直接显示空态） */
  files: FileTreeNode
}

function hasCommentsFile(tree: FileTreeNode): boolean {
  if (tree.type === 'file') return tree.path === 'comments.md'
  if (tree.children) return tree.children.some(hasCommentsFile)
  return false
}

export function CommentsPanel({ changeId, files }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const exists = hasCommentsFile(files)

  const load = useCallback(async () => {
    if (!exists) {
      setContent(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const r = await api.changeFile(changeId, 'comments.md')
      setContent(r.content)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [changeId, exists])

  useEffect(() => {
    load()
  }, [load])

  // SSE: comments.md 改了（自己 post 或外部编辑）就重新拉
  useLiveEvents((ev) => {
    if (ev.changeId === changeId && ev.filePath?.endsWith('comments.md')) {
      load()
    }
  })

  async function submit() {
    const text = draft.trim()
    if (!text || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.postComment(changeId, text)
      setDraft('')
      // 不立即 load：等 SSE 回刷；但首次创建 comments.md 时外层 change 还没更新 files 树，
      // 所以保险起见也主动 load 一次（幂等）
      await load()
    } catch (e) {
      if (e instanceof ApiError) {
        setSubmitError(
          typeof (e.payload as { error?: unknown })?.error === 'string'
            ? (e.payload as { error: string }).error
            : e.message
        )
      } else {
        setSubmitError(e instanceof Error ? e.message : '发布失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter 快捷提交
    if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') {
      ev.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {!exists && !loading && (
          <div className="text-sm text-zinc-400">
            还没有评论。写下第一条吧 👇
          </div>
        )}
        {loading && <div className="text-zinc-400 text-sm">loading…</div>}
        {loadError && <div className="text-red-600 text-sm">error: {loadError}</div>}
        {content && <MarkdownView content={content} filePath="comments.md" />}
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={4}
          placeholder="写下评论/决策记录… (Cmd/Ctrl+Enter 提交)"
          className="w-full text-sm border border-zinc-200 rounded px-3 py-2 focus:outline-none focus:border-zinc-400 resize-y font-mono"
          disabled={submitting}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || draft.trim().length === 0}
            className="text-sm px-3 py-1.5 rounded bg-zinc-900 text-white disabled:bg-zinc-300 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
          >
            {submitting ? '发布中…' : 'Post'}
          </button>
          {submitError && <span className="text-xs text-red-600">{submitError}</span>}
          <span className="ml-auto text-[11px] text-zinc-400">
            评论会追加到 change 根的 <span className="font-mono">comments.md</span>
          </span>
        </div>
      </div>
    </div>
  )
}
