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
            {/* 次要（非主线）：全量列表 + 活动流 */}
            <NavLink
              to="/changes"
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
          <div className="ml-auto text-xs text-zinc-400">v0.1.0</div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
