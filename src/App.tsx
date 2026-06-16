import './App.css'
import { useAuth } from './lib/auth'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

function App() {
  const { user } = useAuth()
  return user ? <HomePage /> : <LoginPage />
}

export default App
