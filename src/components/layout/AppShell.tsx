import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useAsync } from '../../hooks/useAsync'
import { listarPendentes } from '../../services/recorrencias'

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

function BadgePendencias({ count, atrasado }: { count: number; atrasado: boolean }) {
  if (count === 0) return null
  return (
    <span
      className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white ${
        atrasado ? 'bg-alerta' : 'bg-ink-soft'
      }`}
    >
      {count}
    </span>
  )
}

function AppShell({ children }: { children: ReactNode }) {
  const { user, sair } = useAuth()
  const location = useLocation()
  const pendentes = useAsync(listarPendentes, [location.pathname])
  const contagemPendencias = pendentes.data?.length ?? 0
  const temAtrasado = (pendentes.data ?? []).some((p) => (p.diaRecorrencia ?? 0) < new Date().getDate())

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 md:flex">
        <span className="mb-4 px-3 text-lg font-semibold text-ink">Lugom</span>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
            {item.label}
            {item.to === '/recorrencias' && (
              <BadgePendencias count={contagemPendencias} atrasado={temAtrasado} />
            )}
          </NavLink>
        ))}

        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
          <span className="truncate px-3 text-xs text-ink-soft">{user?.email}</span>
          <button
            type="button"
            onClick={() => sair()}
            className="rounded px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-base"
          >
            Sair
          </button>
        </div>
      </nav>

      <div className="flex flex-1 flex-col">
        <main className="flex-1 p-4 pb-20 md:pb-4">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 flex items-center justify-around border-t border-line bg-surface p-2 md:hidden">
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
              {item.to === '/recorrencias' && (
                <BadgePendencias count={contagemPendencias} atrasado={temAtrasado} />
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => sair()}
            className="rounded px-2 py-1 text-xs font-medium text-ink-soft"
          >
            Sair
          </button>
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
