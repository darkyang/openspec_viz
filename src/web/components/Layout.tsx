import { NavLink, Outlet } from 'react-router-dom'

const navItem =
  'px-3 py-1.5 rounded-md text-sm transition-colors text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
const navItemActive = 'bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white'

export function Layout() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-6">
          <div className="font-semibold text-base">openspec-viz</div>
          <nav className="flex gap-1">
            {/* 主线：需求交付看板（PM/QA/Changelog 已收敛为它的 lens） */}
            <NavLink
              to="/"
              end
              className={({ isActive }) => `${navItem} ${isActive ? navItemActive : ''}`}
            >
              看板
            </NavLink>
            {/* 次要（非主线）：全量列表 + 活动流。
               end：只在列表页 /changes 高亮；进到某个 change（/changes/:id，钻取，无论从需求还是列表进入）
               不再误点亮 Changes —— change 详情是需求下的钻取单元，导航上下文由面包屑承担。 */}
            <NavLink
              to="/changes"
              end
              className={({ isActive }) => `${navItem} ${isActive ? navItemActive : ''}`}
            >
              Changes
            </NavLink>
            <NavLink
              to="/timeline"
              className={({ isActive }) => `${navItem} ${isActive ? navItemActive : ''}`}
            >
              Timeline
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            {/* /report 脱离 Layout（无内部导航,可发链接对外）→ 用原生 <a> 整页跳转,而非 NavLink */}
            <a
              href="/report"
              className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
              title="对外交付进展报告（可分享链接）"
            >
              交付报告 ↗
            </a>
            <span className="text-xs text-zinc-400">v0.1.0</span>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
