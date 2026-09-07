import { RouterProvider } from 'react-router'
import { ToastProvider } from './components/ui/Toast'
import { router } from './routes'

function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}

export default App
