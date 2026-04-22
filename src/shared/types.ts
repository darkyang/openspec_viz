export type NodeState = 'done' | 'empty' | 'missing-required'
export type Phase = 'requirement' | 'design' | 'implementation'
export type ChangeStatus = 'incomplete' | 'in_progress' | 'done' | 'archived'

export interface WorkflowNode {
  id: string
  phase: Phase
  label: string
  required: boolean
  state: NodeState
  filePath?: string
  count?: number
  files?: string[]
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  size?: number
  mtime?: number
}

export interface TaskProgress {
  total: number
  done: number
}

export interface ChangeNode {
  id: string
  title: string
  status: ChangeStatus
  archived: boolean
  workflow: WorkflowNode[]
  files: FileTreeNode
  taskProgress: TaskProgress
  aiSessions?: ChangeAiSession[]
  aiStats?: AiStats
  requirementId?: string
}

export interface ChangeSummary {
  id: string
  title: string
  status: ChangeStatus
  archived: boolean
  workflow: WorkflowNode[]
  taskProgress: TaskProgress
  requirementId?: string
}

export type EventKind = 'created' | 'modified' | 'completed' | 'archived'

export interface TimelineEvent {
  changeId: string
  changeTitle?: string
  archived: boolean
  kind: EventKind
  timestamp: number
  source: 'git' | 'mtime'
  commitHash?: string
  author?: string
  message?: string
  filePath?: string
}

export interface OverviewSummary {
  total: number
  active: number
  archived: number
  byStatus: Record<ChangeStatus, number>
}

export interface OverviewResponse {
  openspecRoot: string
  changes: ChangeSummary[]
  summary: OverviewSummary
}

export interface AiSessionTokens {
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
}

export interface AiSessionSummary {
  sessionId: string
  filePath: string
  startedAt: string
  endedAt: string
  durationMs: number
  model: string | null
  userTurns: number
  assistantTurns: number
  toolCalls: Record<string, number>
  tokens: AiSessionTokens
  errorCount: number
  touchedFiles: string[]
  gitBranch?: string
  slug?: string
  cwd?: string
}

export interface ChangeAiAttribution {
  changeId: string
  archived: boolean
  sessionId: string
  hitCount: number
  primary: boolean
}

export interface AiStats {
  totalSessions: number
  totalTokens: number
  totalDurationMs: number
  totalUserTurns: number
  totalAssistantTurns: number
  totalErrorCount: number
}

export interface ChangeAiSession extends AiSessionSummary {
  hitCount: number
  primary: boolean
}

export const UNGROUPED_ID = '__ungrouped__'

export interface RequirementProgress {
  totalChanges: number
  byStatus: Record<ChangeStatus, number>
  totalTasks: number
  doneTasks: number
  totalNodes: number
  doneNodes: number
  overallStatus: ChangeStatus
}

export interface RequirementSummary {
  id: string
  title: string
  /** 首段（或首行） markdown，UI 列表页用来作描述 */
  description?: string
  /** requirements/<slug>.md 完整 markdown 正文；仅 detail 接口返回 */
  body?: string
  changeIds: string[]
  progress: RequirementProgress
}
