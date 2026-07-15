import './App.css'
import { useAuth } from './lib/auth'
import { AuthenticatedApp } from './pages/AuthenticatedApp'
import { LoginPage } from './pages/LoginPage'

function App() {
  const { user, ready } = useAuth()

  if (!ready) {
    return (
      <div className="boot">
        <img src="/brand/fakebook-minimal-cropped.png" alt="" />
        <span className="spinner" />
      </div>
    )
  }

  return user ? <AuthenticatedApp /> : <LoginPage />
}

export default App
