import { useSearchParams } from 'react-router-dom'
import { RequirementsRoute } from './Requirements'
import { PmRoadmapRoute } from './PmRoadmap'
import { PmChangelogRoute } from './PmChangelog'
import { QaDashboardRoute } from './QaDashboard'

/**
 * 需求交付看板（产品主线中心，见根目录 CLAUDE.md）。
 * 以 requirement 为中心，切换 lens 看同一批需求/变更的不同切面——
 * 而不是把 PM / QA / Changelog 做成并排的独立页（那会制造割裂）。
 */
type Lens = 'roadmap' | 'overview' | 'changelog' | 'qa'

const LENSES: { id: Lens; label: string; hint: string }[] = [
  { id: 'roadmap', label: '路线图', hint: '需求按 stage 的交付看板（按时上线追踪）' },
  { id: 'overview', label: '概览', hint: '所有需求卡片（含未归类）' },
  { id: 'changelog', label: '变更日志', hint: '按月聚合的变更流水（变更视角）' },
  { id: 'qa', label: 'QA', hint: '测试状态 / 失败 / 派生修复追踪' },
]

const DEFAULT_LENS: Lens = 'roadmap'

function isLens(v: string | null): v is Lens {
  return v === 'roadmap' || v === 'overview' || v === 'changelog' || v === 'qa'
}

export function BoardRoute() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('lens')
  const lens: Lens = isLens(raw) ? raw : DEFAULT_LENS
  const active = LENSES.find((l) => l.id === lens)!

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-semibold">需求交付看板</h1>
        <span className="text-sm text-zinc-500">{active.hint}</span>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        以需求为中心：一个需求（含多个 change）从规划到上线。切换 lens 看同一批需求的不同切面，
        点需求进详情、再钻到 change。
      </p>

      <div className="flex gap-1 mb-5 border-b border-zinc-200">
        {LENSES.map((l) => (
          <button
            key={l.id}
            onClick={() =>
              setParams(l.id === DEFAULT_LENS ? {} : { lens: l.id }, { replace: true })
            }
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 transition-colors ${
              l.id === lens
                ? 'border-zinc-900 text-zinc-900 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {lens === 'roadmap' && <PmRoadmapRoute embedded />}
      {lens === 'overview' && <RequirementsRoute embedded />}
      {lens === 'changelog' && <PmChangelogRoute embedded />}
      {lens === 'qa' && <QaDashboardRoute embedded />}
    </div>
  )
}
