import { createBrowserRouter } from 'react-router'
import ProtectedLayout from './components/layout/ProtectedLayout'
import CategoriasPage from './pages/CategoriasPage'
import DashboardPage from './pages/DashboardPage'
import EntradasPage from './pages/EntradasPage'
import FontesPage from './pages/FontesPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import RecorrenciasPage from './pages/RecorrenciasPage'
import SaidasPage from './pages/SaidasPage'

export const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  {
    path: '/',
    Component: ProtectedLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: 'entradas', Component: EntradasPage },
      { path: 'saidas', Component: SaidasPage },
      { path: 'fontes', Component: FontesPage },
      { path: 'categorias', Component: CategoriasPage },
      { path: 'recorrencias', Component: RecorrenciasPage },
    ],
  },
  { path: '*', Component: NotFoundPage },
])
