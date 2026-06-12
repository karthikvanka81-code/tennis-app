import { useState } from 'react'
import { supabase } from './supabaseClient'
import './Auth.css'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
        setLoading(false)
        return
      }

      if (data.user) {
        const { error: insertError } = await supabase.from('users').insert([
          {
            id: data.user.id,
            email,
            name,
            role: 'player',
          },
        ])

        if (insertError) {
          setMessage(`Error saving user: ${insertError.message}`)
        } else {
          setMessage('Signup successful! Please check your email to confirm.')
          setEmail('')
          setPassword('')
          setName('')
        }
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`)
    }

    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setMessage(`Error: ${error.message}`)
      setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('Login successful!')
        setEmail('')
        setPassword('')
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`)
    }

    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>{isLogin ? 'Login' : 'Sign Up'}</h1>
        
        <form onSubmit={isLogin ? handleLogin : handleSignUp} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-divider"><span>OR</span></div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="google-btn"
        >
          <svg className="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        {message && <div className="message">{message}</div>}

        <button
          onClick={() => {
            setIsLogin(!isLogin)
            setMessage('')
          }}
          className="toggle-btn"
        >
          {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  )
}