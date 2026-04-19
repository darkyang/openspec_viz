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
            <NavLink
              to="/"
              end
              className={({ isActive }) => `${navItem} ${isActive ? navItemActive : ''}`}
            >
              Timeline
            </NavLink>
            <NavLink
              to="/changes"
              className={({ isActive }) => `${navItem} ${isActive ? navItemActive : ''}`}
            >
              Changes
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
