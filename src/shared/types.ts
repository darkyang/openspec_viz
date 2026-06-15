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

/**
 * 轻量级变更（fix-* / tweak-*）的 frontmatter 字段。来自 proposal.md frontmatter 直读。
 * 完整型变更也可能有部分字段（如 lifecycle），但通常无 *Bugs / discovered* 等关系字段。
 *
 * 字段命名策略：camelCase（与 TS 风格一致）；解析时把 frontmatter 的 snake_case key
 * 映射为 camelCase（test_status → testStatus）。
 */
export interface ChangeFrontmatter {
  /** fix | tweak | feature；轻量级一般是 fix / tweak */
  type?: string
  /** 与 specs/<capability>/ 对齐的能力名 */
  area?: string
  /** 创建/合并日期，YYYY-MM-DD */
  date?: string
  /** 主 commit hash */
  commit?: string
  /** 生命周期状态：drafted | in-review | shipped | reverted | blocked。
   *  注意：与 ChangeStatus（计算字段）正交。前者反映 commit/PR 进度，后者反映文档完整度。 */
  lifecycle?: string
  /** PM 字段 */
  effort?: string
  risk?: string
  /** QA 聚合状态 */
  testStatus?: string
  fixVerified?: string
  /** QA 细粒度状态：{ 'TC-1': 'failed', 'TC-2': 'passed' } */
  testResults?: Record<string, string>
  /** 关系字段：本变更测试期间发现的派生 bug change 名列表 */
  spawnedBugs?: string[]
  /** 关系字段（仅派生 bug）：父变更 change 名 */
  discoveredDuring?: string
  /** 关系字段（仅派生 bug）：触发本 bug 的父变更 TC ID 列表 */
  discoveredInCases?: string[]
  /** 关系字段：regression 影响的其他 change / capability */
  affectsChanges?: string[]
  /** 关系字段：本变更修了之前哪些派生 bug */
  fixesBugs?: string[]
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
  /** 轻量级变更的 frontmatter 字段；非轻量级可能为空对象或部分填充 */
  frontmatter?: ChangeFrontmatter
}

export interface ChangeSummary {
  id: string
  title: string
  status: ChangeStatus
  archived: boolean
  workflow: WorkflowNode[]
  taskProgress: TaskProgress
  requirementId?: string
  /** 列表页 + dashboard 用：仅暴露需要的字段，避免拉全 detail。
   *  注：testResults 为 PM/QA dashboard 的失败 TC 展示所需，单条记录通常 ≤ 10 KV，影响极小。 */
  frontmatter?: Pick<
    ChangeFrontmatter,
    | 'type'
    | 'area'
    | 'date'
    | 'effort'
    | 'risk'
    | 'lifecycle'
    | 'testStatus'
    | 'fixVerified'
    | 'testResults'
    | 'spawnedBugs'
    | 'discoveredDuring'
  >
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

/**
 * 需求阶段（Kanban 列）。
 * - planning：尚未开始（所有 change incomplete / 未启动）
 * - in-dev：开发中（至少一个 change in_progress）
 * - in-test：开发完成、测试中（所有 change done，但有失败 / pending 测试）
 * - staged：测试通过、待发布（所有 change done + 所有 testStatus passed）
 * - released：已发布（所有 change archived，或 frontmatter.stage='released'）
 */
export type RequirementStage = 'planning' | 'in-dev' | 'in-test' | 'staged' | 'released'

export const REQUIREMENT_STAGES: RequirementStage[] = [
  'planning',
  'in-dev',
  'in-test',
  'staged',
  'released',
]

/** requirements/<slug>.md frontmatter 中可选的 PM 字段。 */
export interface RequirementMeta {
  /** 预期上线日期 YYYY-MM-DD */
  targetDate?: string
  /** 预期版本号 */
  targetVersion?: string
  /** 当前阶段（缺省时由聚合 progress 自动推导） */
  stage?: RequirementStage
  /** 责任人 */
  owner?: string
}

/** 风险信号严重等级 */
export type RiskLevel = 'red' | 'yellow'

/** 单条风险信号（dashboard 上方的红 / 黄标记）。 */
export interface RequirementRisk {
  /** 风险类型 ID（用于去重 + UI icon 选择） */
  kind: 'test_failed' | 'unclosed_bug' | 'burn_down' | 'missing_required'
  level: RiskLevel
  /** 简短文案 */
  message: string
  /** 关联到具体的 change id（点击可跳转） */
  sourceChangeId?: string
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
  /** PM 视角元数据：来自 requirements/<slug>.md frontmatter（可选） */
  meta?: RequirementMeta
  /** 由后端从聚合 progress 推断的当前阶段（与 meta.stage 同 / 不同）。
   *  用 effectiveStage 让前端不必复制推断逻辑。 */
  effectiveStage?: RequirementStage
  /** 风险信号列表，dashboard 用来点亮红 / 黄警告 */
  risks?: RequirementRisk[]
}
