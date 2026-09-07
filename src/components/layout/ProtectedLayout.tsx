import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../ui/Spinner'
import AppShell from './AppShell'

function ProtectedLayout() {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <Spinner size={32} />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export default ProtectedLayout
