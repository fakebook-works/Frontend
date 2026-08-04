import './App.css'
import { useAuth } from './lib/auth'
import { ModalInteractionGuard } from './lib/bodyInteractionLock'
import { AuthenticatedApp } from './pages/AuthenticatedApp'
import { LoginPage } from './pages/LoginPage'
import { useAppLocation } from './lib/router'
import { AboutPage } from './pages/AboutPage'
import { HelpPage } from './pages/HelpPage'
import { PoliciesPage } from './pages/PoliciesPage'
import { PrivacyPage } from './pages/PrivacyPage'

function App() {
  const { user, ready } = useAuth()
  const [location, navigate] = useAppLocation()

  if (!ready) {
    return (
      <div className="boot">
        <img src="/brand/fakebook-minimal-cropped.png" alt="" />
        <span className="spinner" />
      </div>
    )
  }

  if (location.pathname === '/about') return <AboutPage onBack={() => navigate('/')} />
  if (location.pathname === '/help') return <HelpPage onBack={() => navigate('/')} />
  if (location.pathname === '/policies') return <PoliciesPage onBack={() => navigate('/')} />
  if (location.pathname === '/privacy') return <PrivacyPage onBack={() => navigate('/')} />

  return <><ModalInteractionGuard />{user ? <AuthenticatedApp /> : <LoginPage />}</>
}

export default App
