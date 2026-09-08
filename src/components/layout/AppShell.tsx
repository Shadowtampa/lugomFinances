import { createContext, useContext, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useAsync } from '../../hooks/useAsync'
import { listarPendentes } from '../../services/recorrencias'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

const NAV_ITEMS = [
  { to: '/', label: 'Painel', end: true },
  { to: '/entradas', label: 'Entradas' },
  { to: '/saidas', label: 'Saídas' },
  { to: '/fontes', label: 'Fontes' },
  { to: '/categorias', label: 'Categorias', labelMobile: 'Categ.' },
  { to: '/recorrencias', label: 'Recorrências', labelMobile: 'Recorr.' },
]

const APP_VERSION = '1.16'

const NAV_MOBILE_STORAGE_KEY = 'lugom:nav-mobile'
const NAV_MOBILE_PADRAO = ['/', '/entradas', '/saidas', '/fontes']

function carregarNavMobile(): string[] {
  try {
    const raw = localStorage.getItem(NAV_MOBILE_STORAGE_KEY)
    if (!raw) return NAV_MOBILE_PADRAO
    const valores = JSON.parse(raw)
    if (Array.isArray(valores) && valores.every((v) => typeof v === 'string')) return valores
  } catch {
    // localStorage indisponível ou valor inválido — usa o padrão
  }
  return NAV_MOBILE_PADRAO
}

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

  const [navMobile, setNavMobile] = useState<string[]>(carregarNavMobile)
  const [configNavAberta, setConfigNavAberta] = useState(false)

  function alternarItemNavMobile(to: string) {
    setNavMobile((atual) => {
      const proximo = atual.includes(to) ? atual.filter((item) => item !== to) : [...atual, to]
      try {
        localStorage.setItem(NAV_MOBILE_STORAGE_KEY, JSON.stringify(proximo))
      } catch {
        // localStorage indisponível — seleção fica só na sessão atual
      }
      return proximo
    })
  }

  const itensBottomNav = NAV_ITEMS.filter((item) => navMobile.includes(item.to))

  return (
    <NavMobileContext.Provider value={() => setConfigNavAberta(true)}>
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
          <main className="flex-1 p-4 pb-24 md:pb-4">{children}</main>

          <nav className="fixed inset-x-0 bottom-0 flex items-center justify-between gap-0.5 border-t border-line bg-surface px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden">
            {itensBottomNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-11 items-center whitespace-nowrap rounded px-1 py-1 text-[11px] font-medium ${isActive ? 'text-livre' : 'text-ink-soft'}`
                }
              >
                {item.labelMobile ?? item.label}
                {item.to === '/recorrencias' && (
                  <BadgePendencias count={contagemPendencias} atrasado={temAtrasado} />
                )}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => sair()}
              className="flex min-h-11 items-center whitespace-nowrap rounded px-1 py-1 text-[11px] font-medium text-ink-soft"
            >
              Sair
            </button>
          </nav>
        </div>
      </div>

      <Modal open={configNavAberta} onClose={() => setConfigNavAberta(false)} title="Menu mobile">
        <p className="mb-3 text-sm text-ink-soft">Escolha quais atalhos aparecem no menu de baixo.</p>
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <label
              key={item.to}
              className="flex items-center gap-2 rounded px-2 py-2 text-sm text-ink hover:bg-base"
            >
              <input
                type="checkbox"
                checked={navMobile.includes(item.to)}
                onChange={() => alternarItemNavMobile(item.to)}
              />
              {item.label}
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setConfigNavAberta(false)}>
            Fechar
          </Button>
        </div>
      </Modal>
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
