import type { Phase } from '../types.js'

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
