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
}

export interface ChangeSummary {
  id: string
  title: string
  status: ChangeStatus
  archived: boolean
  workflow: WorkflowNode[]
  taskProgress: TaskProgress
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
