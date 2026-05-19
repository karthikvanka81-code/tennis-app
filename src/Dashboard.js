import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import TournamentList from './TournamentList'
import CreateTournament from './CreateTournament'
import TournamentInvitations from './TournamentInvitations'
import MatchRecording from './MatchRecording'
import MatchHistory from './MatchHistory'
import Leaderboard from './Leaderboard'
import TournamentRules from './TournamentRules'
import './Dashboard.css'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [stats, setStats] = useState({ totalMatches: 0, wins: 0, losses: 0, winPercentage: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [inviteCount, setInviteCount] = useState(0)

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
        if (authError || !currentUser) { setError('Not logged in'); setLoading(false); return }
        setUser(currentUser)

        const { data: profile, error: profileError } = await supabase
          .from('users').select('*').eq('id', currentUser.id).single()
        if (profileError) { setError(`Error fetching profile: ${profileError.message}`); setLoading(false); return }
        setUserData(profile)

        const { data: matches, error: matchesError } = await supabase
          .from('matches').select('*')
          .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)
        if (!matchesError && matches) {
          let wins = 0, losses = 0
          matches.forEach(m => { if (m.winner_id === currentUser.id) wins++; else losses++ })
          const total = wins + losses
          setStats({ totalMatches: total, wins, losses, winPercentage: total > 0 ? Math.round((wins / total) * 100) : 0 })
        }

        const { count } = await supabase
          .from('tournament_invitations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', currentUser.id)
          .eq('status', 'pending')
        setInviteCount(count || 0)

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
    if (error) setError(`Logout error: ${error.message}`)
    else setUser(null)
  }

  if (loading) return <div className="dashboard-container"><p>Loading...</p></div>
  if (error === 'Not logged in') return <div className="dashboard-container"><p>Not logged in</p></div>

  const navItems = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'create-tournament', label: 'Create Tournament' },
    { key: 'tournaments', label: 'Tournaments' },
    { key: 'invitations', label: 'Invitations', badge: inviteCount },
    { key: 'record-match', label: 'Record Match' },
    { key: 'match-history', label: 'History' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'rules', label: 'Rules' },
  ]

  return (
    <div className="dashboard-wrapper">
      <nav className="dashboard-nav">
        <div className="nav-content">
          <div className="nav-left">
            <h1 className="logo">🎾 Tennis App</h1>
            <div className="nav-links">
              {navItems.map(item => (
                <button
                  key={item.key}
                  className={`nav-link ${currentPage === item.key ? 'active' : ''}`}
                  onClick={() => setCurrentPage(item.key)}
                >
                  {item.label}
                  {item.badge > 0 && (
                    <span className="nav-badge">{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="nav-right">
            <span className="user-name">{userData?.name}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
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
              {inviteCount > 0 && (
                <button
                  className="invite-alert-btn"
                  onClick={() => setCurrentPage('invitations')}
                >
                  {inviteCount} pending invitation{inviteCount !== 1 ? 's' : ''}
                </button>
              )}
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.totalMatches}</div>
                <div className="stat-label">Total Matches</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#FB9D6B' }}>{stats.wins}</div>
                <div className="stat-label">Wins</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#ef4444' }}>{stats.losses}</div>
                <div className="stat-label">Losses</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.winPercentage}%</div>
                <div className="stat-label">Win Rate</div>
              </div>
            </div>
          </>
        )}

        {currentPage === 'create-tournament' && <CreateTournament user={user} />}
        {currentPage === 'tournaments' && <TournamentList user={user} />}
        {currentPage === 'invitations' && (
          <TournamentInvitations
            user={user}
            onCountChange={count => setInviteCount(count)}
          />
        )}
        {currentPage === 'record-match' && <MatchRecording user={user} />}
        {currentPage === 'match-history' && <MatchHistory user={user} />}
        {currentPage === 'leaderboard' && <Leaderboard user={user} />}
        {currentPage === 'rules' && <TournamentRules />}
      </div>
    </div>
  )
}
