import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import TournamentList from './TournamentList'
import MatchRecording from './MatchRecording'
import MatchHistory from './MatchHistory'
import Leaderboard from './Leaderboard'
import './Dashboard.css'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [stats, setStats] = useState({
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winPercentage: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState('dashboard')

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !currentUser) {
          setError('Not logged in')
          setLoading(false)
          return
        }

        setUser(currentUser)

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .single()

        if (profileError) {
          setError(`Error fetching profile: ${profileError.message}`)
          setLoading(false)
          return
        }

        setUserData(profile)

        const { data: matches, error: matchesError } = await supabase
          .from('matches')
          .select('*')
          .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)

        if (!matchesError && matches) {
          let wins = 0
          let losses = 0

          matches.forEach((match) => {
            if (match.winner_id === currentUser.id) {
              wins++
            } else {
              losses++
            }
          })

          const total = wins + losses
          const winPercentage = total > 0 ? Math.round((wins / total) * 100) : 0

          setStats({
            totalMatches: total,
            wins,
            losses,
            winPercentage,
          })
        }

        setLoading(false)
      } catch (err) {
        setError(`Error: ${err.message}`)
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setError(`Logout error: ${error.message}`)
    } else {
      setUser(null)
    }
  }

  if (loading) {
    return <div className="dashboard-container"><p>Loading...</p></div>
  }

  if (error && error === 'Not logged in') {
    return <div className="dashboard-container"><p>Not logged in</p></div>
  }

  return (
    <div className="dashboard-wrapper">
      <nav className="dashboard-nav">
        <div className="nav-content">
          <div className="nav-left">
            <h1 className="logo">🎾 Tennis App</h1>
            <div className="nav-links">
              <button
                className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
                onClick={() => setCurrentPage('dashboard')}
              >
                Dashboard
              </button>
              <button
                className={`nav-link ${currentPage === 'tournaments' ? 'active' : ''}`}
                onClick={() => setCurrentPage('tournaments')}
              >
                Tournaments
              </button>
              <button
                className={`nav-link ${currentPage === 'record-match' ? 'active' : ''}`}
                onClick={() => setCurrentPage('record-match')}
              >
                Record Match
              </button>
              <button
                className={`nav-link ${currentPage === 'match-history' ? 'active' : ''}`}
                onClick={() => setCurrentPage('match-history')}
              >
                History
              </button>
              <button
                className={`nav-link ${currentPage === 'leaderboard' ? 'active' : ''}`}
                onClick={() => setCurrentPage('leaderboard')}
              >
                Leaderboard
              </button>
            </div>
          </div>
          <div className="nav-right">
            <span className="user-name">{userData?.name}</span>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-content">
        {currentPage === 'dashboard' && (
          <>
            <div className="dashboard-header">
              <div>
                <h2>Welcome, {userData?.name}!</h2>
                <p className="email">{userData?.email}</p>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.totalMatches}</div>
                <div className="stat-label">Total Matches</div>
              </div>

              <div className="stat-card">
                <div className="stat-value" style={{ color: '#10b981' }}>
                  {stats.wins}
                </div>
                <div className="stat-label">Wins</div>
              </div>

              <div className="stat-card">
                <div className="stat-value" style={{ color: '#ef4444' }}>
                  {stats.losses}
                </div>
                <div className="stat-label">Losses</div>
              </div>

              <div className="stat-card">
                <div className="stat-value">{stats.winPercentage}%</div>
                <div className="stat-label">Win Rate</div>
              </div>
            </div>
          </>
        )}

        {currentPage === 'tournaments' && <TournamentList user={user} />}
        {currentPage === 'record-match' && <MatchRecording user={user} />}
        {currentPage === 'match-history' && <MatchHistory user={user} />}
        {currentPage === 'leaderboard' && <Leaderboard user={user} />}
      </div>
    </div>
  )
}