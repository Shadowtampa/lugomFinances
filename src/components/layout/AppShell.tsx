import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'

const NAV_ITEMS = [
  { to: '/', label: 'Painel', end: true },
  { to: '/entradas', label: 'Entradas' },
  { to: '/saidas', label: 'Saídas' },
  { to: '/fontes', label: 'Fontes' },
  { to: '/categorias', label: 'Categorias' },
  { to: '/recorrencias', label: 'Recorrências' },
]

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `rounded px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-livre/10 text-livre' : 'text-ink-soft hover:bg-base'
  }`
}

function AppShell() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 md:flex">
        <span className="mb-4 px-3 text-lg font-semibold text-ink">Lugom</span>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-1 flex-col">
        <main className="flex-1 p-4 pb-20 md:pb-4">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-line bg-surface p-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded px-2 py-1 text-xs font-medium ${isActive ? 'text-livre' : 'text-ink-soft'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      {action}
    </div>
  )
}

export default AppShell
