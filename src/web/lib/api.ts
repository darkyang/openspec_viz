import type {
  AiSessionSummary,
  ChangeAiAttribution,
  ChangeNode,
  OverviewResponse,
  TimelineEvent,
} from '../../shared/types'

export type AiSessionWithAttrs = AiSessionSummary & { attributions: ChangeAiAttribution[] }

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  overview: () => get<OverviewResponse>('/api/overview'),
  change: (id: string) => get<ChangeNode>(`/api/changes/${encodeURIComponent(id)}`),
  changeFile: (id: string, filePath: string) =>
    get<{ id: string; path: string; content: string; size: number }>(
      `/api/changes/${encodeURIComponent(id)}/file?path=${encodeURIComponent(filePath)}`
    ),
  timeline: () => get<{ events: TimelineEvent[] }>('/api/timeline'),
  aiSessions: () =>
    get<{ projectRoot: string; sessions: AiSessionWithAttrs[] }>('/api/ai-sessions'),
  aiSession: (id: string) =>
    get<AiSessionWithAttrs>(`/api/ai-sessions/${encodeURIComponent(id)}`),
}
