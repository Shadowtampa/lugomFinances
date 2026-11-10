import { NavLink, useLocation } from 'react-router'

const ABAS = [
  { to: '/', label: 'Hoje', analitica: false },
  { to: '/dashboard/visao-geral', label: 'Visão geral', analitica: true },
  { to: '/dashboard/categorias', label: 'Categorias', analitica: true },
]

/** Abas do Dashboard: abas no desktop, chips roláveis no mobile. O filtro de período vai junto na URL. */
function AbasDashboard() {
  const { pathname, search } = useLocation()
  const naAnalitica = pathname.startsWith('/dashboard/')

  return (
    <nav aria-label="Seções do painel" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:border-b md:border-line md:px-0">
      {ABAS.map((aba) => (
        <NavLink
          key={aba.to}
          to={aba.analitica && naAnalitica ? { pathname: aba.to, search } : aba.to}
          end
          className={({ isActive }) =>
            `shrink-0 rounded-full px-3 py-1 text-sm md:-mb-px md:rounded-none md:border-b-2 md:bg-transparent md:px-4 md:py-2 md:font-medium ${
              isActive
                ? 'bg-ink text-surface md:border-livre md:text-livre'
                : 'bg-base text-ink-soft md:border-transparent md:hover:text-ink'
            }`
          }
        >
          {aba.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default AbasDashboard
