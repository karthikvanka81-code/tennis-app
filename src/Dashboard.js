import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { getELOBadge } from './UpdateELOLogic'
import TournamentList from './TournamentList'
import CreateTournament from './CreateTournament'
import TournamentInvitations from './TournamentInvitations'
import MatchRecording from './MatchRecording'
import MatchHistory from './MatchHistory'
import Leaderboard from './Leaderboard'
import TournamentRules from './TournamentRules'
import PlayerProfile from './PlayerProfile'
import HeadToHeadStats from './HeadToHeadStats'
import MatchJournal from './MatchJournal'
import './Dashboard.css'

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const RecordIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M5.5 5.5c2.5 2.5 2.5 5.5 0 8M18.5 5.5c-2.5 2.5-2.5 5.5 0 8"/>
  </svg>
)
const JournalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
  </svg>
)
const CompeteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8 6 6 6 6 10"/><path d="M6 10c0 3.31 2.69 6 6 6s6-2.69 6-6V6h-2"/>
    <path d="M6 6H2v4c0 2.21 1.79 4 4 4"/><path d="M18 6h4v4c0 2.21-1.79 4-4 4"/>
    <line x1="12" y1="16" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/>
  </svg>
)
const MeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)

export default function Dashboard() {
  const [user, setUser]           = useState(null)
  const [userData, setUserData]   = useState(null)
  const [stats, setStats]         = useState({ totalMatches: 0, wins: 0, losses: 0, winPercentage: 0 })
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [inviteCount, setInviteCount] = useState(0)
  const [mobileSheet, setMobileSheet] = useState(null)

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
        if (authError || !currentUser) { setError('Not logged in'); setLoading(false); return }
        setUser(currentUser)

        let { data: profile, error: profileError } = await supabase
          .from('users').select('*').eq('id', currentUser.id).single()

        // Google OAuth users have no users row — create one from their Google metadata
        if (profileError && profileError.code === 'PGRST116') {
          const meta = currentUser.user_metadata || {}
          const { data: newProfile, error: insertError } = await supabase
            .from('users')
            .insert([{
              id: currentUser.id,
              email: currentUser.email,
              name: meta.full_name || meta.name || currentUser.email.split('@')[0],
              role: 'player',
              elo_rating: 1200,
            }])
            .select()
            .single()
          if (insertError) { setError(`Error creating profile: ${insertError.message}`); setLoading(false); return }
          profile = newProfile
          profileError = null
        }

        if (profileError) { setError(`Error fetching profile: ${profileError.message}`); setLoading(false); return }
        setUserData(profile)

        const { data: matches } = await supabase
          .from('matches').select('winner_id, player1_id, player2_id')
          .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)
          .eq('match_status', 'completed')

        if (matches) {
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
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) return <div className="dashboard-container"><p>Loading…</p></div>
  if (error === 'Not logged in') return <div className="dashboard-container"><p>Not logged in</p></div>

  const elo   = userData?.elo_rating || 1200
  const badge = getELOBadge(elo)

  const navItems = [
    { key: 'dashboard',         label: 'Dashboard' },
    { key: 'create-tournament', label: 'Create Tournament' },
    { key: 'tournaments',       label: 'Tournaments' },
    { key: 'invitations',       label: 'Invitations', badge: inviteCount },
    { key: 'record-match',      label: 'Record Match' },
    { key: 'match-history',     label: 'History' },
    { key: 'leaderboard',       label: 'Leaderboard' },
    { key: 'head-to-head',      label: 'Head-to-Head' },
    { key: 'journal',           label: 'Match Journal' },
    { key: 'profile',           label: 'My Profile' },
    { key: 'rules',             label: 'Rules' },
  ]

  const competePages = ['create-tournament', 'tournaments', 'invitations', 'leaderboard', 'head-to-head']
  const mePages      = ['profile', 'match-history', 'rules']

  const sheetItems = {
    compete: [
      { key: 'create-tournament', label: 'Create Tournament', sub: 'Start a new tournament' },
      { key: 'tournaments',       label: 'My Tournaments',    sub: 'View your tournaments' },
      { key: 'invitations',       label: 'Invitations',       sub: 'Pending invites', badge: inviteCount },
      { key: 'leaderboard',       label: 'Leaderboard',       sub: 'Rankings & ELO' },
      { key: 'head-to-head',      label: 'Head-to-Head',      sub: 'Compare vs opponents' },
    ],
    me: [
      { key: 'profile',       label: 'My Profile',    sub: 'ELO, stats & history' },
      { key: 'match-history', label: 'Match History', sub: 'All recorded matches' },
      { key: 'rules',         label: 'Rules & Info',  sub: 'Tournament rules & ELO guide' },
    ],
  }

  const navigate = (key) => {
    setCurrentPage(key)
    setMobileSheet(null)
  }

  return (
    <div className="dashboard-wrapper">
      <nav className="dashboard-nav">
        <div className="nav-content">
          <div className="nav-left">
            <h1 className="logo">🎾 Ace</h1>
            <div className="nav-links">
              {navItems.map(item => (
                <button
                  key={item.key}
                  className={`nav-link ${currentPage === item.key ? 'active' : ''}`}
                  onClick={() => setCurrentPage(item.key)}
                >
                  {item.label}
                  {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="nav-right">
            <span className="user-name">{userData?.name}</span>
            <span
              className="nav-elo-badge"
              style={{ background: badge.bg, color: badge.color }}
              onClick={() => setCurrentPage('profile')}
              title="View my profile"
            >
              {badge.emoji} {elo}
            </span>
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
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {inviteCount > 0 && (
                  <button className="invite-alert-btn" onClick={() => setCurrentPage('invitations')}>
                    {inviteCount} pending invitation{inviteCount !== 1 ? 's' : ''}
                  </button>
                )}
                <button
                  className="invite-alert-btn"
                  style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}` }}
                  onClick={() => setCurrentPage('profile')}
                >
                  {badge.emoji} {elo} · {badge.label}
                </button>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.totalMatches}</div>
                <div className="stat-label">Total Matches</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#4AE3B5' }}>{stats.wins}</div>
                <div className="stat-label">Wins</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#F87171' }}>{stats.losses}</div>
                <div className="stat-label">Losses</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.winPercentage}%</div>
                <div className="stat-label">Win Rate</div>
              </div>
              <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setCurrentPage('profile')}>
                <div className="stat-value" style={{ color: badge.color, fontSize: 36 }}>{elo}</div>
                <div className="stat-label">ELO Rating · {badge.emoji} {badge.label}</div>
              </div>
            </div>
          </>
        )}

        {currentPage === 'create-tournament'  && <CreateTournament user={user} />}
        {currentPage === 'tournaments'        && <TournamentList user={user} />}
        {currentPage === 'invitations'        && (
          <TournamentInvitations user={user} onCountChange={count => setInviteCount(count)} />
        )}
        {currentPage === 'record-match'       && <MatchRecording user={user} />}
        {currentPage === 'match-history'      && <MatchHistory user={user} />}
        {currentPage === 'leaderboard'        && <Leaderboard user={user} />}
        {currentPage === 'head-to-head'       && <HeadToHeadStats user={user} />}
        {currentPage === 'journal'            && <MatchJournal user={user} />}
        {currentPage === 'profile'            && <PlayerProfile userId={user.id} currentUser={user} />}
        {currentPage === 'rules'              && <TournamentRules />}
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="bottom-nav">
        <button
          className={`bottom-nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => navigate('dashboard')}
        >
          <HomeIcon />
          <span>Home</span>
        </button>

        <button
          className={`bottom-nav-item ${currentPage === 'record-match' ? 'active' : ''}`}
          onClick={() => navigate('record-match')}
        >
          <RecordIcon />
          <span>Record</span>
        </button>

        <button
          className={`bottom-nav-item ${currentPage === 'journal' ? 'active' : ''}`}
          onClick={() => navigate('journal')}
        >
          <JournalIcon />
          <span>Journal</span>
        </button>

        <button
          className={`bottom-nav-item ${competePages.includes(currentPage) ? 'active' : ''}`}
          onClick={() => setMobileSheet(mobileSheet === 'compete' ? null : 'compete')}
        >
          <div className="bottom-nav-icon-wrap">
            <CompeteIcon />
            {inviteCount > 0 && <span className="bottom-nav-dot" />}
          </div>
          <span>Compete</span>
        </button>

        <button
          className={`bottom-nav-item ${mePages.includes(currentPage) ? 'active' : ''}`}
          onClick={() => setMobileSheet(mobileSheet === 'me' ? null : 'me')}
        >
          <MeIcon />
          <span>Me</span>
        </button>
      </nav>

      {/* ── Mobile Sheet ── */}
      {mobileSheet && (
        <>
          <div className="sheet-backdrop" onClick={() => setMobileSheet(null)} />
          <div className="bottom-sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">
              {mobileSheet === 'compete' ? 'Compete' : 'My Account'}
            </div>
            {sheetItems[mobileSheet].map(item => (
              <button
                key={item.key}
                className={`sheet-item ${currentPage === item.key ? 'active' : ''}`}
                onClick={() => navigate(item.key)}
              >
                <div className="sheet-item-text">
                  <span className="sheet-item-label">{item.label}</span>
                  <span className="sheet-item-sub">{item.sub}</span>
                </div>
                {item.badge > 0 && <span className="sheet-badge">{item.badge}</span>}
                {currentPage === item.key && <span className="sheet-check">✓</span>}
              </button>
            ))}
            {mobileSheet === 'me' && (
              <button className="sheet-logout-btn" onClick={handleLogout}>Log out</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
