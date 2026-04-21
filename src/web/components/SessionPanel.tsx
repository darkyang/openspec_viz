import type { AiStats, ChangeAiSession } from '../../shared/types'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return `${m}m${rs ? ` ${rs}s` : ''}`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h}h${rm ? ` ${rm}m` : ''}`
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SessionCard({ session }: { session: ChangeAiSession }) {
  const totalTokens =
    session.tokens.input + session.tokens.output + session.tokens.cacheRead + session.tokens.cacheCreation
  const toolEntries = Object.entries(session.toolCalls).sort((a, b) => b[1] - a[1])
  const topTools = toolEntries.slice(0, 5)
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[11px] text-zinc-500">{session.sessionId.slice(0, 8)}</span>
        {session.primary ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700">
            primary · {session.hitCount} hits
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-300 bg-zinc-50 text-zinc-600">
            partial · {session.hitCount} hits
          </span>
        )}
        {session.model && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-500 font-mono">
            {session.model}
          </span>
        )}
        {session.gitBranch && (
          <span className="text-[10px] text-zinc-400 font-mono">@{session.gitBranch}</span>
        )}
        <span className="ml-auto text-[11px] text-zinc-400">{formatTimestamp(session.endedAt)}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-[11px] mb-2">
        <Metric label="duration" value={formatDuration(session.durationMs)} />
        <Metric label="tokens" value={formatTokens(totalTokens)} />
        <Metric label="u/a turns" value={`${session.userTurns}/${session.assistantTurns}`} />
        <Metric
          label="errors"
          value={String(session.errorCount)}
          emphasis={session.errorCount > 0 ? 'red' : undefined}
        />
      </div>

      {topTools.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {topTools.map(([name, count]) => (
            <span
              key={name}
              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono"
            >
              {name} · {count}
            </span>
          ))}
          {toolEntries.length > topTools.length && (
            <span className="text-[10px] text-zinc-400">+{toolEntries.length - topTools.length} more</span>
          )}
        </div>
      )}

      <details className="text-[11px] text-zinc-500">
        <summary className="cursor-pointer hover:text-zinc-700">
          tokens in/out/cacheR/cacheW · touched {session.touchedFiles.length} files
        </summary>
        <div className="mt-2 font-mono text-[10px] text-zinc-500 space-y-0.5">
          <div>
            input {formatTokens(session.tokens.input)} · output {formatTokens(session.tokens.output)} · cacheRead{' '}
            {formatTokens(session.tokens.cacheRead)} · cacheCreate {formatTokens(session.tokens.cacheCreation)}
          </div>
          {session.touchedFiles.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {session.touchedFiles.slice(0, 20).map((p) => (
                <li key={p} className="truncate text-zinc-600">
                  {p}
                </li>
              ))}
              {session.touchedFiles.length > 20 && (
                <li className="text-zinc-400">… +{session.touchedFiles.length - 20} more</li>
              )}
            </ul>
          )}
        </div>
      </details>
    </div>
  )
}

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: 'red'
}) {
  return (
    <div>
      <div className="text-[10px] text-zinc-400 uppercase tracking-wide">{label}</div>
      <div
        className={`font-mono text-xs ${
          emphasis === 'red' ? 'text-red-600' : 'text-zinc-800'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

export function SessionPanel({
  sessions,
  stats,
}: {
  sessions: ChangeAiSession[]
  stats: AiStats
}) {
  if (sessions.length === 0) {
    return (
      <div className="text-sm text-zinc-400">
        No AI sessions attributed to this change.
        <div className="text-[11px] mt-1">
          Sessions are matched by detecting file edits under <span className="font-mono">openspec/changes/{'<id>'}/</span>.
        </div>
      </div>
    )
  }
  return (
    <div>
      <div className="flex flex-wrap gap-4 text-[11px] text-zinc-500 mb-3 pb-3 border-b border-zinc-100">
        <span>
          <span className="text-zinc-400">sessions</span>{' '}
          <span className="font-mono text-zinc-800">{stats.totalSessions}</span>
        </span>
        <span>
          <span className="text-zinc-400">total tokens</span>{' '}
          <span className="font-mono text-zinc-800">{formatTokens(stats.totalTokens)}</span>
        </span>
        <span>
          <span className="text-zinc-400">cumulative time</span>{' '}
          <span className="font-mono text-zinc-800">{formatDuration(stats.totalDurationMs)}</span>
        </span>
        <span>
          <span className="text-zinc-400">u/a turns</span>{' '}
          <span className="font-mono text-zinc-800">
            {stats.totalUserTurns}/{stats.totalAssistantTurns}
          </span>
        </span>
        {stats.totalErrorCount > 0 && (
          <span>
            <span className="text-zinc-400">errors</span>{' '}
            <span className="font-mono text-red-600">{stats.totalErrorCount}</span>
          </span>
        )}
      </div>
      <div className="space-y-2">
        {sessions.map((s) => (
          <SessionCard key={s.sessionId} session={s} />
        ))}
      </div>
    </div>
  )
}
