import { useState } from 'react'
import { supabase } from './supabaseClient'
import { friendlyError } from './errorMessages'
import aceLogo from './ace-logo.svg'
import './Auth.css'

export default function Auth({ initialMode = 'signin' }) {
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [message, setMessage]   = useState({ text: '', type: '' })
  const [showReset, setShowReset] = useState(false)

  const msg = (text, type = 'info') => setMessage({ text, type })

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!name.trim()) { msg('Please enter your name.', 'error'); return }
    setLoading(true)
    setMessage({ text: '', type: '' })
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { msg(friendlyError(error), 'error'); setLoading(false); return }
      if (data.user) {
        // Trigger handles users row — this is a best-effort fallback
        await supabase.from('users').insert([{ id: data.user.id, email, name: name.trim(), role: 'player' }])
        msg('Account created! Please check your email to confirm before logging in.', 'success')
        setEmail(''); setPassword(''); setName('')
      }
    } catch (err) {
      msg(friendlyError(err), 'error')
    }
    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setMessage({ text: '', type: '' })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) { msg(friendlyError(error), 'error'); setLoading(false) }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!email) { msg('Please enter your email address first.', 'error'); return }
    setLoading(true)
    setMessage({ text: '', type: '' })
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}`,
    })
    if (error) { msg(friendlyError(error), 'error') }
    else { msg('Password reset email sent! Check your inbox.', 'success'); setShowReset(false) }
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ text: '', type: '' })
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { msg(friendlyError(error), 'error') }
    } catch (err) {
      msg(friendlyError(err), 'error')
    }
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <img src={aceLogo} alt="Ace" className="auth-logo" />
      <div className="auth-card">
        <h1>{isLogin ? 'Welcome back' : 'Create account'}</h1>

        {showReset && (
          <form onSubmit={handleResetPassword} className="auth-form" style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--c-secondary)', lineHeight: 1.5 }}>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <div className="form-group">
              <label htmlFor="reset-email">Email</label>
              <input id="reset-email" type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <button type="button" className="toggle-btn" onClick={() => setShowReset(false)}>
              Back to login
            </button>
          </form>
        )}

        {!showReset && <form onSubmit={isLogin ? handleLogin : handleSignUp} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input id="name" type="text" placeholder="Your name"
                value={name} onChange={e => setName(e.target.value)} required={!isLogin} />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="your@email.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password"
              placeholder={isLogin ? 'Enter password' : 'At least 6 characters'}
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Please wait…' : isLogin ? 'Log In' : 'Create Account'}
          </button>
          {isLogin && (
            <button type="button" className="forgot-btn" onClick={() => { setShowReset(true); setMessage({ text: '', type: '' }) }}>
              Forgot password?
            </button>
          )}
        </form>}

        {!showReset && <>

        <div className="auth-divider"><span>OR</span></div>

        <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="google-btn">
          <svg className="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <button onClick={() => { setIsLogin(!isLogin); setMessage({ text: '', type: '' }) }} className="toggle-btn">
          {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
        </button>
        </>}

        {message.text && (
          <div className={message.type === 'error' ? 'error-message' : message.type === 'success' ? 'success-message' : 'message'}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  )
}
