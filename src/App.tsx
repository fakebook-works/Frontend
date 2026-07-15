import './App.css'
import { useAuth } from './lib/auth'
import { AccountSecurityPage } from './pages/AccountSecurityPage'
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

  return user ? <AccountSecurityPage /> : <LoginPage />
}

export default App
