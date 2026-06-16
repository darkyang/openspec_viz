import { useMemo } from 'react'
import { useFetch } from '../hooks/useFetch'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { api } from '../lib/api'
import type { RequirementRisk, RequirementStage, RequirementSummary } from '../../shared/types'
import { UNGROUPED_ID } from '../../shared/types'

/**
 * `/report` —— 对外「交付进展」前瞻报告。
 *
 * 刻意脱离内部 Layout（无 看板 / Changes / Timeline 导航）:这是一个可直接发链接给
 * **上层 / 客户**自看的独立页。它与内部「路线图」lens 的区别 = 去工程术语
 * (change / workflow / stage 英文 / owner@ / 风险类型名 / 任务数)，只回答两件事:
 *   ①「接下来交付什么、预计何时」 ②「在不在轨(健康)」。
 *
 * 纯前端:数据全取自 `api.requirements()`(meta.targetDate/targetVersion、effectiveStage、
 * risks、progress)。无 server / 类型 / 测试改动。
 */

/* ── 客户向措辞:stage → 中文状态 ── */
function stageLabel(stage: RequirementStage): string {
  switch (stage) {
    case 'planning':
      return '规划中'
    case 'in-dev':
      return '开发中'
    case 'in-test':
      return '测试中'
    case 'staged':
      return '待发布'
    case 'released':
      return '已交付'
  }
}

function stageChipCls(stage: RequirementStage): string {
  switch (stage) {
    case 'planning':
      return 'bg-zinc-100 text-zinc-600 border-zinc-200'
    case 'in-dev':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'in-test':
      return 'bg-amber-50 text-amber-800 border-amber-200'
    case 'staged':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'released':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
}

/* ── 健康:由风险信号收敛成单一对外结论 ── */
type HealthKey = 'on_track' | 'watch' | 'at_risk'
interface Health {
  key: HealthKey
  label: string
  dot: string
  chip: string
  reason?: string
}

/** missing_required 是内部文档卫生,不对外展示;其余 kind 折叠成一句客户能懂的原因。 */
function reasonFor(risks: RequirementRisk[]): string | undefined {
  const kinds = new Set(risks.map((r) => r.kind))
  const parts: string[] = []
  if (kinds.has('burn_down')) parts.push('进度较计划偏慢')
  if (kinds.has('test_failed')) parts.push('测试中发现问题待修复')
  if (kinds.has('unclosed_bug')) parts.push('有遗留问题待修复')
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function healthOf(req: RequirementSummary): Health {
  const risks = (req.risks ?? []).filter((r) => r.kind !== 'missing_required')
  const hasRed = risks.some((r) => r.level === 'red')
  const hasYellow = risks.some((r) => r.level === 'yellow')
  if (hasRed)
    return {
      key: 'at_risk',
      label: '有风险',
      dot: 'bg-red-500',
      chip: 'bg-red-50 text-red-700 border-red-200',
      reason: reasonFor(risks),
    }
  if (hasYellow)
    return {
      key: 'watch',
      label: '需关注',
      dot: 'bg-amber-500',
      chip: 'bg-amber-50 text-amber-800 border-amber-200',
      reason: reasonFor(risks),
    }
  return {
    key: 'on_track',
    label: '在轨',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
}

/* ── 完成度（不暴露任务/节点原始计数，只给百分比） ── */
function completionOf(req: RequirementSummary): number {
  const p = req.progress
  if (p.totalTasks > 0) return p.doneTasks / p.totalTasks
  if (p.totalNodes > 0) return p.doneNodes / p.totalNodes
  return 0
}

/* ── 预计上线:相对今天的中文措辞 ── */
function dateLine(targetDate: string): { text: string; cls: string } {
  const target = new Date(targetDate + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return { text: `预计 ${targetDate}`, cls: 'text-zinc-600' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const md = `${target.getMonth() + 1} 月 ${target.getDate()} 日`
  if (days < 0) return { text: `预计 ${md} · 已逾期 ${-days} 天`, cls: 'text-red-600' }
  if (days === 0) return { text: `预计 ${md} · 就在今天`, cls: 'text-red-600' }
  if (days <= 7) return { text: `预计 ${md} · 还有 ${days} 天`, cls: 'text-red-600' }
  if (days <= 14) return { text: `预计 ${md} · 还有 ${days} 天`, cls: 'text-amber-700' }
  return { text: `预计 ${md} · 还有 ${days} 天`, cls: 'text-zinc-600' }
}

function todayLabel(): string {
  const d = new Date()
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

const IN_FLIGHT: ReadonlySet<RequirementStage> = new Set(['in-dev', 'in-test', 'staged'])

export function ReportRoute() {
  const { data, loading, error, reload } = useFetch(() => api.requirements(), [])
  useLiveEvents(() => reload())

  const { inFlight, planned, delivered, overall } = useMemo(() => {
    const reqs = (data?.requirements ?? []).filter((r) => r.id !== UNGROUPED_ID)
    const stageOf = (r: RequirementSummary): RequirementStage => r.effectiveStage ?? 'planning'

    const inFlight = reqs
      .filter((r) => IN_FLIGHT.has(stageOf(r)))
      // 在途按预计上线升序(无日期排末),最近要交付的置顶
      .sort((a, b) => {
        const da = a.meta?.targetDate ?? '9999-99-99'
        const db = b.meta?.targetDate ?? '9999-99-99'
        return da.localeCompare(db)
      })
    const planned = reqs.filter((r) => stageOf(r) === 'planning')
    const delivered = reqs
      .filter((r) => stageOf(r) === 'released')
      .sort((a, b) => a.title.localeCompare(b.title))

    // 整体健康 = 在途里最差的那个
    let overall: HealthKey = 'on_track'
    for (const r of inFlight) {
      const h = healthOf(r).key
      if (h === 'at_risk') {
        overall = 'at_risk'
        break
      }
      if (h === 'watch') overall = 'watch'
    }
    return { inFlight, planned, delivered, overall }
  }, [data])

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* 抬头 */}
        <header className="mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold tracking-tight">Capmind 交付进展</h1>
            {!loading && !error && data && <OverallPill overall={overall} hasInFlight={inFlight.length > 0} />}
          </div>
          <p className="text-sm text-zinc-500 mt-2">更新于 {todayLabel()}</p>
        </header>

        {loading && <div className="text-zinc-400 text-sm">加载中…</div>}
        {error && <div className="text-red-600 text-sm">加载失败:{error.message}</div>}

        {!loading && !error && data && (
          <>
            {/* 一句话总览 */}
            <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <Stat n={inFlight.length} label="进行中" tone="text-blue-700" />
              <Stat n={planned.length} label="规划中" tone="text-zinc-600" />
              <Stat n={delivered.length} label="近期已交付" tone="text-emerald-700" />
            </div>

            {/* 进行中 */}
            <Section title="进行中" subtitle="正在交付的需求 —— 预计何时、是否在轨">
              {inFlight.length === 0 ? (
                <Empty text="当前没有进行中的需求。" />
              ) : (
                <div className="space-y-3">
                  {inFlight.map((r) => (
                    <InFlightCard key={r.id} req={r} />
                  ))}
                </div>
              )}
            </Section>

            {/* 规划中 */}
            {planned.length > 0 && (
              <Section title="规划中" subtitle="已确定、尚未开工的需求">
                <div className="space-y-3">
                  {planned.map((r) => (
                    <PlannedCard key={r.id} req={r} />
                  ))}
                </div>
              </Section>
            )}

            {/* 已交付 */}
            {delivered.length > 0 && (
              <Section title="近期已交付" subtitle="已上线的能力">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {delivered.map((r) => (
                    <DeliveredRow key={r.id} req={r} />
                  ))}
                </div>
              </Section>
            )}

            <footer className="mt-10 pt-5 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-400">
              <span>本页由产品研发的工程数据自动生成,实时更新。</span>
              <Legend />
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

function OverallPill({ overall, hasInFlight }: { overall: HealthKey; hasInFlight: boolean }) {
  if (!hasInFlight) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-zinc-50 text-zinc-500 border-zinc-200">
        暂无进行中需求
      </span>
    )
  }
  const map: Record<HealthKey, { label: string; cls: string; dot: string }> = {
    on_track: { label: '整体在轨', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    watch: { label: '整体需关注', cls: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
    at_risk: { label: '整体有风险', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  }
  const m = map[overall]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-xl font-semibold ${tone}`}>{n}</span>
      <span className="text-zinc-500">{label}</span>
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function InFlightCard({ req }: { req: RequirementSummary }) {
  const stage = req.effectiveStage ?? 'in-dev'
  const health = healthOf(req)
  const completion = Math.round(completionOf(req) * 100)
  const date = req.meta?.targetDate ? dateLine(req.meta.targetDate) : null

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-zinc-900">{req.title}</h3>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${stageChipCls(stage)}`}>
              {stageLabel(stage)}
            </span>
          </div>
          {req.description && (
            <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed line-clamp-2">{req.description}</p>
          )}
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${health.chip}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
          {health.label}
        </span>
      </div>

      {/* 预计上线 + 目标版本 */}
      {(date || req.meta?.targetVersion) && (
        <div className="flex items-center gap-3 mt-3 text-sm">
          {date && <span className={date.cls}>📅 {date.text}</span>}
          {req.meta?.targetVersion && (
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
              {req.meta.targetVersion}
            </span>
          )}
        </div>
      )}

      {/* 完成度 */}
      <div className="mt-3">
        <div className="flex justify-between items-center mb-1 text-xs text-zinc-500">
          <span>完成度</span>
          <span className="font-medium text-zinc-700">{completion}%</span>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              health.key === 'at_risk'
                ? 'bg-red-400'
                : completion >= 100
                ? 'bg-emerald-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      {/* 当前关注(仅非在轨时) */}
      {health.reason && (
        <div className="mt-3 text-xs text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
          当前关注:{health.reason}
        </div>
      )}
    </div>
  )
}

function PlannedCard({ req }: { req: RequirementSummary }) {
  const date = req.meta?.targetDate ? dateLine(req.meta.targetDate) : null
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-zinc-900">{req.title}</h3>
        <span className="text-[11px] px-1.5 py-0.5 rounded-full border bg-zinc-100 text-zinc-600 border-zinc-200">
          规划中
        </span>
        {date && <span className={`text-xs ml-auto ${date.cls}`}>{date.text}</span>}
      </div>
      {req.description && (
        <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed line-clamp-2">{req.description}</p>
      )}
    </div>
  )
}

function DeliveredRow({ req }: { req: RequirementSummary }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-100 bg-white px-3 py-2">
      <span className="text-emerald-500 shrink-0">✓</span>
      <span className="text-sm text-zinc-700 truncate">{req.title}</span>
      {req.meta?.targetVersion && (
        <span className="ml-auto font-mono text-[10px] text-zinc-400 shrink-0">{req.meta.targetVersion}</span>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-8 text-center text-sm text-zinc-400">
      {text}
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3">
      <LegendDot cls="bg-emerald-500" label="在轨" />
      <LegendDot cls="bg-amber-500" label="需关注" />
      <LegendDot cls="bg-red-500" label="有风险" />
    </div>
  )
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${cls}`} />
      {label}
    </span>
  )
}
