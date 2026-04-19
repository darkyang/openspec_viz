import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { api } from '../lib/api'
import { ChangeCard } from '../components/ChangeCard'

type Filter = 'all' | 'active' | 'archived'

export function ChangeCardsRoute() {
  const { data, loading, error, reload } = useFetch(() => api.overview(), [])
  useLiveEvents(() => reload())
  const [filter, setFilter] = useState<Filter>('active')

  const filtered = (data?.changes ?? []).filter((c) => {
    if (filter === 'active') return !c.archived
    if (filter === 'archived') return c.archived
    return true
  })

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-2xl font-semibold">Changes</h1>
        {data && (
          <div className="text-sm text-zinc-500 font-mono">
            {data.summary.active} active · {data.summary.archived} archived
          </div>
        )}
        <div className="ml-auto flex gap-1">
          {(['active', 'all', 'archived'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                filter === f
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <div className="mb-4 flex items-center gap-4 text-xs">
          <StatusPill color="red" count={data.summary.byStatus.incomplete} label="incomplete" />
          <StatusPill color="blue" count={data.summary.byStatus.in_progress} label="in progress" />
          <StatusPill color="emerald" count={data.summary.byStatus.done} label="done" />
          <StatusPill color="zinc" count={data.summary.byStatus.archived} label="archived" />
        </div>
      )}

      {loading && <div className="text-zinc-400 text-sm">loading…</div>}
      {error && <div className="text-red-600 text-sm">error: {error.message}</div>}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <ChangeCard key={c.id} change={c} />
          ))}
        </div>
      )}
      {data && filtered.length === 0 && (
        <div className="text-zinc-400 text-sm">没有符合条件的 change</div>
      )}
    </div>
  )
}

function StatusPill({ color, count, label }: { color: 'red' | 'blue' | 'emerald' | 'zinc'; count: number; label: string }) {
  const dotCls: Record<typeof color, string> = {
    red: 'bg-red-400',
    blue: 'bg-blue-400',
    emerald: 'bg-emerald-500',
    zinc: 'bg-zinc-300',
  }
  return (
    <div className="flex items-center gap-1.5 text-zinc-600">
      <span className={`w-2 h-2 rounded-full ${dotCls[color]}`} />
      <span className="font-mono">{count}</span>
      <span>{label}</span>
    </div>
  )
}
