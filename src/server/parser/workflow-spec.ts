import type { Phase, WorkflowNode } from '../types.js'

export type DetectorKind =
  | 'file-exists'
  | 'file-non-empty'
  | 'dir-has-files'
  | 'tasks-has-any-done'
  | 'tasks-all-done'
  | 'tasks-exists'

export interface NodeSpec {
  id: string
  phase: Phase
  label: string
  required: boolean
  detector: DetectorKind
  // path 相对 change 根目录的 posix 路径
  path: string
}

export const WORKFLOW_NODES: NodeSpec[] = [
  // 需求阶段
  {
    id: 'req.draft',
    phase: 'requirement',
    label: '需求初稿',
    required: true,
    detector: 'file-non-empty',
    path: 'requirement/01-draft.md',
  },
  {
    id: 'req.discussion',
    phase: 'requirement',
    label: '需求讨论(录音转写)',
    required: false,
    detector: 'file-exists',
    path: 'requirement/02-discussion.md',
  },
  {
    id: 'req.review',
    phase: 'requirement',
    label: '需求评审(终稿)',
    required: true,
    detector: 'file-exists',
    path: 'proposal.md',
  },
  {
    id: 'req.changes',
    phase: 'requirement',
    label: '需求变更',
    required: false,
    detector: 'dir-has-files',
    path: 'requirement/04-changes',
  },

  // 设计阶段
  {
    id: 'design.analysis',
    phase: 'design',
    label: '需求分析(录音转写)',
    required: false,
    detector: 'file-exists',
    path: 'design-extras/01-analysis.md',
  },
  {
    id: 'design.tech',
    phase: 'design',
    label: '技术方案',
    required: true,
    detector: 'file-exists',
    path: 'design.md',
  },
  {
    id: 'design.ui',
    phase: 'design',
    label: 'UI / 协议',
    required: false,
    detector: 'dir-has-files',
    path: 'design-extras/02-ui',
  },
  {
    id: 'design.review',
    phase: 'design',
    label: '技术方案评审(录音转写)',
    required: false,
    detector: 'file-exists',
    path: 'design-extras/03-review.md',
  },
  {
    id: 'design.testcases',
    phase: 'design',
    label: '测试用例',
    required: false,
    detector: 'file-exists',
    path: 'design-extras/04-test-cases.md',
  },

  // 实施阶段
  {
    id: 'impl.tasks',
    phase: 'implementation',
    label: '任务拆分',
    required: true,
    detector: 'tasks-exists',
    path: 'tasks.md',
  },
  {
    id: 'impl.code',
    phase: 'implementation',
    label: '代码生成',
    required: true,
    detector: 'tasks-has-any-done',
    path: 'tasks.md',
  },
  {
    id: 'impl.debug',
    phase: 'implementation',
    label: '调试',
    required: false,
    detector: 'file-exists',
    path: 'implementation/01-debug-log.md',
  },
  {
    id: 'impl.test',
    phase: 'implementation',
    label: '测试验证',
    required: true,
    detector: 'tasks-all-done',
    path: 'tasks.md',
  },
]

/**
 * 由 tasks.md 勾选派生的节点（impl.code / impl.test 不是独立文档，而是 tasks.md 的进度信号）。
 * 判定 "缺必需文档"（inferStatus / computeRisks 的 missing_required）时排除它们。
 * 单点定义，change.ts 与 requirement.ts 共用（此前各存一份）。
 */
export const TASK_DERIVED_NODES = new Set<string>(['impl.code', 'impl.test'])

/**
 * "完整型" change 的脚手架节点：存在其一即表明该 change 采用了扩展文档结构
 * （需求初稿 / 技术方案 / 任务拆分）。三者皆无 = 轻量级 change（fix-* / tweak-*，仅 proposal.md）。
 */
export const SCAFFOLDING_NODES = new Set<string>(['req.draft', 'design.tech', 'impl.tasks'])

/**
 * 轻量级 change 判定：无任何脚手架文档（只有 proposal.md）。
 *
 * 这类 change 的 13 节点文档完整度恒为 incomplete、对它失真——其状态应改由 frontmatter
 * lifecycle 驱动（见 change.ts 的 inferStatus），missing_required 风险也应跳过。
 * 判据基于节点 state 而非文件名前缀，故对 fix- / tweak- / ble- 等各种命名都稳。
 */
export function isLightweightChange(workflow: Pick<WorkflowNode, 'id' | 'state'>[]): boolean {
  return !workflow.some((n) => SCAFFOLDING_NODES.has(n.id) && n.state === 'done')
}
