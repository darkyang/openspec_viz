import { useFetch } from '../hooks/useFetch'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { api } from '../lib/api'
import { RequirementCard } from '../components/RequirementCard'

export function RequirementsRoute() {
  const { data, loading, error, reload } = useFetch(() => api.requirements(), [])
  // 任何 change 改动或 requirements/*.md 改动都走 change-updated（watcher 监听整个 openspec/）
  useLiveEvents(() => reload())

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Requirements</h1>
      <p className="text-xs text-zinc-500 mb-5">
        按需求维度聚合多个 change。在 change 的 <span className="font-mono">proposal.md</span>{' '}
        头部加 frontmatter <span className="font-mono">requirement: &lt;slug&gt;</span> 即可归入。
      </p>

      {loading && <div className="text-zinc-400 text-sm">loading…</div>}
      {error && <div className="text-red-600 text-sm">error: {error.message}</div>}

      {data && data.requirements.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
          还没有任何 change。
        </div>
      )}

      {data && data.requirements.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.requirements.map((r) => (
            <RequirementCard key={r.id} requirement={r} />
          ))}
        </div>
      )}
    </div>
  )
}
