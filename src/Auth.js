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