import type { ChangeStatus } from '../../shared/types'

/**
 * 取色 / 徽章呈现的**单点定义**。此前 risk / lifecycle / effort / testStatus / type 的取色
 * 散落在 ChangeCard / FrontmatterPanel / PmChangelog 各处、且谓词不一致（FrontmatterPanel 用
 * `endsWith('high')`，ChangeCard / PmChangelog 用 `=== 'high'`）。这里统一为**精确相等**谓词
 * （对真实数据 low/medium/high 行为一致，但语义更准，消除漂移），各消费点改为 import 本模块。
 *
 * 三种形态：
 * - `*ChipCls`：带边框的 chip / pill —— `bg-X-50 border-X-200 text-X-700`
 * - `*TextCls`：纯文字色 —— `text-X-600`
 * - `*DotCls` ：实心圆点 —— `bg-X-500`
 */

const ZINC_CHIP = 'bg-zinc-50 border-zinc-200 text-zinc-600'

export function statusBadge(status: ChangeStatus): { label: string; cls: string } {
  const map: Record<ChangeStatus, { label: string; cls: string }> = {
    incomplete: { label: 'incomplete', cls: 'bg-red-50 text-red-700 border-red-200' },
    in_progress: { label: 'in progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    done: { label: 'done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    archived: { label: 'archived', cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
  }
  return map[status]
}

/* ─── risk（low / medium / high） ─── */

export function riskChipCls(value: string): string {
  if (value === 'high') return 'bg-red-50 border-red-200 text-red-700'
  if (value === 'medium') return 'bg-amber-50 border-amber-200 text-amber-800'
  if (value === 'low') return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  return ZINC_CHIP
}

export function riskTextCls(value: string): string {
  if (value === 'high') return 'text-red-600'
  if (value === 'medium') return 'text-amber-700'
  return 'text-zinc-500'
}

/* ─── lifecycle（drafted / in-review / shipped / reverted / blocked） ─── */

export function lifecycleChipCls(value: string): string {
  switch (value) {
    case 'shipped':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    case 'in-review':
      return 'bg-blue-50 border-blue-200 text-blue-700'
    case 'reverted':
      return 'bg-red-50 border-red-200 text-red-700'
    case 'blocked':
      return 'bg-amber-50 border-amber-200 text-amber-800'
    case 'drafted':
    default:
      return ZINC_CHIP
  }
}

/* ─── effort（trivial / small / medium） ─── */

export function effortChipCls(value: string): string {
  if (value === 'medium') return 'bg-amber-50 border-amber-200 text-amber-800'
  if (value === 'small') return 'bg-blue-50 border-blue-200 text-blue-700'
  return ZINC_CHIP
}

export function effortTextCls(value: string): string {
  if (value === 'medium') return 'text-amber-700'
  return 'text-zinc-500'
}

/* ─── testStatus（failed / passed / pending / n/a） ─── */

export function testStatusChipCls(value: string): string {
  if (value === 'failed') return 'bg-red-50 border-red-200 text-red-700'
  if (value === 'passed') return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  return 'bg-zinc-50 border-zinc-200 text-zinc-500'
}

export function testStatusDotCls(value: string): string {
  if (value === 'failed') return 'bg-red-500'
  if (value === 'passed') return 'bg-emerald-500'
  return 'bg-zinc-300'
}

/* ─── type（fix / tweak / feature） ─── */

export function typeChipCls(value: string): string {
  if (value === 'fix') return 'bg-rose-50 border-rose-200 text-rose-700'
  if (value === 'tweak') return 'bg-violet-50 border-violet-200 text-violet-700'
  if (value === 'feature') return 'bg-sky-50 border-sky-200 text-sky-700'
  return ZINC_CHIP
}

/* ─── fix_verified（yes / no） ─── */

export function fixVerifiedChipCls(value: string): string {
  if (value === 'yes') return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  if (value === 'no') return 'bg-red-50 border-red-200 text-red-700'
  return ZINC_CHIP
}
