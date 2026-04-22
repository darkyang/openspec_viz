import type {
  AiSessionSummary,
  ChangeAiAttribution,
  ChangeNode,
  ChangeSummary,
  OverviewResponse,
  RequirementSummary,
  TimelineEvent,
} from '../../shared/types'

export type RequirementDetail = RequirementSummary & { changes: ChangeSummary[] }

export type AiSessionWithAttrs = AiSessionSummary & { attributions: ChangeAiAttribution[] }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    throw new ApiError(res.status, payload, `HTTP ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

async function send<T>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, payload, `HTTP ${res.status} ${res.statusText}`)
  }
  return payload as T
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
  toggleTask: (id: string, line: number, checked: boolean) =>
    send<{ ok: true; line: number; flag: 'x' | ' '; previousFlag: string }>(
      'PATCH',
      `/api/changes/${encodeURIComponent(id)}/tasks`,
      { line, checked }
    ),
  requirements: () =>
    get<{ requirements: RequirementSummary[] }>('/api/requirements'),
  requirement: (id: string) =>
    get<RequirementDetail>(`/api/requirements/${encodeURIComponent(id)}`),
  postComment: (id: string, text: string) =>
    send<{ ok: true; filePath: string; totalBytes: number; created: boolean }>(
      'POST',
      `/api/changes/${encodeURIComponent(id)}/comments`,
      { text }
    ),
}
