import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import LandingPage from './LandingPage'
import Auth from './Auth'
import Dashboard from './Dashboard'
import './App.css'

function App() {
  const [user, setUser]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [authMode, setAuthMode] = useState(null) // null = show landing, 'signin'|'signup' = show auth

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u || null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null)
    })

    return () => subscription?.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#080b12' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #1E3352', borderTopColor: '#cdf520', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (user) return <div className="App"><Dashboard /></div>

  if (!authMode) return <LandingPage onEnter={setAuthMode} />

  return <div className="App"><Auth initialMode={authMode} /></div>
}

export default App
