import { Link } from 'react-router-dom'
import { useFetch } from '../hooks/useFetch'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { api } from '../lib/api'
import type { TimelineEvent } from '../../shared/types'

export function TimelineRoute() {
  const { data, loading, error, reload } = useFetch(() => api.timeline(), [])
  useLiveEvents(() => reload())

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Timeline</h1>
        {data && (
          <span className="text-xs text-zinc-500 font-mono">
            {data.events.length} events · source={data.events[0]?.source ?? '—'}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> live
        </span>
      </div>

      {loading && <div className="text-zinc-400 text-sm">loading…</div>}
      {error && <div className="text-red-600 text-sm">error: {error.message}</div>}

      {data && (
        <div className="space-y-1">
          {groupByDate(data.events).map(({ date, events }) => (
            <div key={date} className="mb-5">
              <div className="text-xs font-mono text-zinc-400 mb-2">{date}</div>
              <div className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100">
                {events.map((e, i) => (
                  <EventRow key={`${e.changeId}-${e.timestamp}-${i}`} event={e} />
                ))}
              </div>
            </div>
          ))}
          {data.events.length === 0 && (
            <div className="text-zinc-400 text-sm">没有事件 — 在 examples/openspec/changes/ 下编辑文件试试</div>
          )}
        </div>
      )}
    </div>
  )
}

function EventRow({ event }: { event: TimelineEvent }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 text-sm">
      <KindIcon kind={event.kind} />
      <Link
        to={`/changes/${event.changeId}`}
        className="font-mono text-zinc-700 hover:text-zinc-900 underline-offset-2 hover:underline"
      >
        {event.changeId}
      </Link>
      {event.archived && <span className="text-[10px] text-zinc-400 uppercase">archived</span>}
      <span className="text-zinc-500 truncate flex-1">
        {event.message ?? event.filePath ?? ''}
      </span>
      <span className="text-[11px] text-zinc-400 font-mono whitespace-nowrap">
        {fmtTime(event.timestamp)}
      </span>
      <span
        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
          event.source === 'git' ? 'bg-zinc-100 text-zinc-600' : 'bg-amber-50 text-amber-700'
        }`}
      >
        {event.source}
      </span>
    </div>
  )
}

const KIND_GLYPH: Record<TimelineEvent['kind'], { glyph: string; cls: string }> = {
  created: { glyph: '+', cls: 'text-emerald-600 bg-emerald-50' },
  modified: { glyph: '~', cls: 'text-blue-600 bg-blue-50' },
  completed: { glyph: '✓', cls: 'text-emerald-700 bg-emerald-100' },
  archived: { glyph: '◧', cls: 'text-zinc-500 bg-zinc-100' },
}

function KindIcon({ kind }: { kind: TimelineEvent['kind'] }) {
  const k = KIND_GLYPH[kind]
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold ${k.cls}`}>
      {k.glyph}
    </span>
  )
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(events: TimelineEvent[]): { date: string; events: TimelineEvent[] }[] {
  const map = new Map<string, TimelineEvent[]>()
  for (const e of events) {
    const d = new Date(e.timestamp)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, events]) => ({ date, events }))
}
