import { RouterProvider } from 'react-router'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './contexts/AuthContext'
import { PainelSaldoProvider } from './contexts/PainelSaldoContext'
import { router } from './routes'

function App() {
  return (
    <ToastProvider>
      <PainelSaldoProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </PainelSaldoProvider>
    </ToastProvider>
  )
}

export default App
