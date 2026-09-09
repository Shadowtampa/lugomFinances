import { createContext, useContext, useState, type ReactNode } from 'react'
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

const APP_VERSION = '1.16'

const NavMobileContext = createContext<() => void>(() => {})

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

  const [drawerAberto, setDrawerAberto] = useState(false)

  return (
    <NavMobileContext.Provider value={() => setDrawerAberto(true)}>
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
            <span className="px-3 text-[11px] text-ink-soft">v{APP_VERSION}</span>
          </div>
        </nav>

        <div className="flex flex-1 flex-col">
          <main className="flex-1 p-4">{children}</main>
        </div>
      </div>

      {drawerAberto && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setDrawerAberto(false)}>
          <div className="fixed inset-0 bg-ink/40" />
          <nav
            className="fixed inset-y-0 left-0 flex w-64 flex-col gap-1 bg-surface p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between px-3">
              <span className="text-lg font-semibold text-ink">Lugom</span>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setDrawerAberto(false)}
                className="rounded p-1 text-ink-soft hover:bg-base"
              >
                ✕
              </button>
            </div>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navLinkClass}
                onClick={() => setDrawerAberto(false)}
              >
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
              <span className="px-3 text-[11px] text-ink-soft">v{APP_VERSION}</span>
            </div>
          </nav>
        </div>
      )}
    </NavMobileContext.Provider>
  )
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  const abrirConfigNavMobile = useContext(NavMobileContext)

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center rounded text-ink-soft hover:bg-base md:hidden"
          onClick={abrirConfigNavMobile}
        >
          ☰
        </button>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
      </div>
      {action}
    </div>
  )
}

export default AppShell
