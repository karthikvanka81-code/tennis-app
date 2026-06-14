import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Tournament.css'

export default function AdminDashboard({ currentUser, onViewPlayer }) {
  const [users, setUsers]             = useState([])
  const [tournaments, setTournaments] = useState([])
  const [matches, setMatches]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [message, setMessage]         = useState('')

  useEffect(() => { fetchAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    const [{ data: u }, { data: t }, { data: m }] = await Promise.all([
      supabase.from('users').select('*').order('elo_rating', { ascending: false }),
      supabase.from('tournaments').select('*').order('created_at', { ascending: false }),
      supabase.from('matches').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    if (u) setUsers(u)
    if (t) setTournaments(t)
    if (m) setMatches(m)
    setLoading(false)
  }

  const resetElo = async (userId, name) => {
    if (!window.confirm(`Reset ${name}'s ELO to 1200?`)) return
    const { error } = await supabase.from('users').update({ elo_rating: 1200 }).eq('id', userId)
    if (error) { setMessage(`Error: ${error.message}`); return }
    setMessage(`${name}'s ELO reset to 1200.`)
    fetchAll()
  }

  const toggleRole = async (userId, currentRole, name) => {
    const newRole = currentRole === 'admin' ? 'player' : 'admin'
    if (!window.confirm(`Make ${name} a ${newRole}?`)) return
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
    if (error) { setMessage(`Error: ${error.message}`); return }
    setMessage(`${name} is now a ${newRole}.`)
    fetchAll()
  }

  const deleteTournament = async (id, name) => {
    if (!window.confirm(`Delete tournament "${name}"? This will also delete all its matches.`)) return
    await supabase.from('matches').delete().eq('tournament_id', id)
    await supabase.from('tournament_participants').delete().eq('tournament_id', id)
    const { error } = await supabase.from('tournaments').delete().eq('id', id)
    if (error) { setMessage(`Error: ${error.message}`); return }
    setMessage(`Tournament "${name}" deleted.`)
    fetchAll()
  }

  const revertMatch = async (matchId) => {
    if (!window.confirm('Revert this match to pending? ELO is NOT automatically reversed.')) return
    const { error } = await supabase.from('matches').update({
      match_status: 'pending', winner_id: null, player1_score: null, player2_score: null,
    }).eq('id', matchId)
    if (error) { setMessage(`Error: ${error.message}`); return }
    setMessage('Match reverted to pending.')
    fetchAll()
  }

  const userMap = {}
  users.forEach(u => { userMap[u.id] = u })

  const totalMatches     = matches.length
  const completedMatches = matches.filter(m => m.match_status === 'completed').length
  const activeTourneys   = tournaments.filter(t => t.status === 'active').length

  if (loading) return <div className="tournament-container"><p>Loading admin data…</p></div>

  return (
    <div className="tournament-container">
      <div className="tournament-header">
        <h2>⚙ Admin Dashboard</h2>
      </div>

      {message && <div className="success-message">{message}</div>}

      {/* Stats */}
      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <div className="admin-stat-value">{users.length}</div>
          <div className="admin-stat-label">Players</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{tournaments.length}</div>
          <div className="admin-stat-label">Tournaments</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{activeTourneys}</div>
          <div className="admin-stat-label">Active</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{completedMatches}</div>
          <div className="admin-stat-label">Matches Played</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-value">{totalMatches - completedMatches}</div>
          <div className="admin-stat-label">Pending Matches</div>
        </div>
      </div>

      {/* Users */}
      <div className="admin-section">
        <h3>Players ({users.length})</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>ELO</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <button className="admin-link-btn" onClick={() => onViewPlayer?.(u.id)}>
                    {u.name || '—'}
                  </button>
                </td>
                <td style={{ color: 'var(--c-secondary)', fontSize: 12 }}>{u.email}</td>
                <td style={{ fontWeight: 700, color: 'var(--c-primary)' }}>{u.elo_rating || 1200}</td>
                <td>
                  <span style={{ fontSize: 11, color: u.role === 'admin' ? '#FFD700' : 'var(--c-secondary)' }}>
                    {u.role || 'player'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="admin-link-btn" onClick={() => resetElo(u.id, u.name)}>Reset ELO</button>
                  {u.id !== currentUser?.id && (
                    <button className="admin-link-btn" onClick={() => toggleRole(u.id, u.role, u.name)}>
                      {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tournaments */}
      <div className="admin-section">
        <h3>Tournaments ({tournaments.length})</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 500 }}>{t.name}</td>
                <td style={{ color: 'var(--c-secondary)', fontSize: 12 }}>{t.tournament_type}</td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.status === 'active' ? '#00C896' : t.status === 'completed' ? 'var(--c-primary)' : 'var(--c-secondary)' }}>
                    {t.status}
                  </span>
                </td>
                <td style={{ color: 'var(--c-secondary)', fontSize: 12 }}>
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
                <td>
                  <button className="admin-link-btn danger" onClick={() => deleteTournament(t.id, t.name)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent matches */}
      <div className="admin-section">
        <h3>Recent Matches (last 50)</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Player 1</th>
              <th>Player 2</th>
              <th>Score</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(m => (
              <tr key={m.id}>
                <td style={{ color: m.winner_id === m.player1_id ? 'var(--c-heading)' : 'var(--c-text)', fontWeight: m.winner_id === m.player1_id ? 700 : 400 }}>
                  {userMap[m.player1_id]?.name || '?'}
                </td>
                <td style={{ color: m.winner_id === m.player2_id ? 'var(--c-heading)' : 'var(--c-text)', fontWeight: m.winner_id === m.player2_id ? 700 : 400 }}>
                  {userMap[m.player2_id]?.name || '?'}
                </td>
                <td style={{ fontWeight: 700, color: 'var(--c-secondary)', fontSize: 12 }}>
                  {m.match_status === 'completed' ? `${m.player1_score ?? 0}–${m.player2_score ?? 0}` : '—'}
                </td>
                <td>
                  <span style={{ fontSize: 11, color: m.match_status === 'completed' ? '#00C896' : 'var(--c-secondary)' }}>
                    {m.match_status}
                  </span>
                </td>
                <td>
                  {m.match_status === 'completed' && (
                    <button className="admin-link-btn danger" onClick={() => revertMatch(m.id)}>Revert</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
