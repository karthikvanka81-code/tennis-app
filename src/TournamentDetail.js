import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Tournament.css'

export default function TournamentDetail({ tournament, onBack, currentUser }) {
  const [participants, setParticipants] = useState([])
  const [matches, setMatches]           = useState([])
  const [allUsers, setAllUsers]         = useState([])
  const [userMap, setUserMap]           = useState({})
  const [loading, setLoading]           = useState(true)
  const [activating, setActivating]     = useState(false)
  const [message, setMessage]           = useState('')
  const [addingUserId, setAddingUserId] = useState('')
  const [adding, setAdding]             = useState(false)

  useEffect(() => {
    fetchAll()
  }, [tournament.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: parts }, { data: users }, { data: matchData }] = await Promise.all([
      supabase.from('tournament_participants').select('*').eq('tournament_id', tournament.id),
      supabase.from('users').select('id, name, elo_rating'),
      supabase.from('matches').select('*').eq('tournament_id', tournament.id).order('round').order('match_order'),
    ])

    const map = {}
    if (users) users.forEach(u => { map[u.id] = u })
    setUserMap(map)
    setAllUsers(users || [])
    setParticipants(parts || [])
    setMatches(matchData || [])
    setLoading(false)
  }

  const handleForceAdd = async () => {
    if (!addingUserId) return
    setAdding(true)
    setMessage('')

    const participantIds = participants.map(p => p.user_id)
    if (participantIds.includes(addingUserId)) {
      // Already in — just confirm them
      await supabase.from('tournament_participants')
        .update({ confirmed: true })
        .eq('tournament_id', tournament.id)
        .eq('user_id', addingUserId)
    } else {
      await supabase.from('tournament_participants').insert([{
        tournament_id: tournament.id,
        user_id: addingUserId,
        confirmed: true,
        wins: 0,
        losses: 0,
        points: 0,
      }])
    }

    setMessage(`${userMap[addingUserId]?.name || 'Player'} added as confirmed.`)
    setAddingUserId('')
    fetchAll()
    setAdding(false)
  }

  const handleForceActivate = async () => {
    setActivating(true)
    setMessage('')

    // Admin privilege: force-confirm everyone still pending
    const { error: confirmErr } = await supabase
      .from('tournament_participants')
      .update({ confirmed: true })
      .eq('tournament_id', tournament.id)
      .eq('confirmed', false)

    if (confirmErr) {
      setMessage(`Could not confirm pending players: ${confirmErr.message}. Make sure the RLS policy allows admin updates.`)
      setActivating(false)
      return
    }

    const { checkAndActivateTournament } = await import('./MatchGeneration')
    const { success, error: activateErr } = await checkAndActivateTournament(tournament.id)

    if (success) {
      setMessage('Tournament activated! All pending players were force-confirmed and matches have been generated.')
      fetchAll()
    } else {
      setMessage(`Could not activate: ${activateErr}`)
    }
    setActivating(false)
  }

  const typeLabel = { 'one-to-one': 'One-to-One', 'round-robin': 'Round Robin', 'knockout': 'Knockout' }
  const statusColor = { setup: 'var(--c-secondary)', active: '#00C896', completed: 'var(--c-primary)' }

  const pending         = participants.filter(p => !p.confirmed)
  const confirmed       = participants.filter(p => p.confirmed)
  const isAdmin         = tournament.admin_id === currentUser?.id
  const participantIds  = participants.map(p => p.user_id)
  const eligibleToAdd   = allUsers.filter(u => !participantIds.includes(u.id))

  const byRound = matches.reduce((acc, m) => {
    if (!acc[m.round]) acc[m.round] = []
    acc[m.round].push(m)
    return acc
  }, {})

  return (
    <div className="tournament-detail">
      <button className="back-btn" onClick={onBack}>← Back to Tournaments</button>

      <div className="detail-header">
        <div>
          <h2>{tournament.name}</h2>
          <div className="detail-meta">
            <span className="tournament-type-chip">{typeLabel[tournament.tournament_type] || tournament.tournament_type}</span>
            <span className="detail-status" style={{ color: statusColor[tournament.status] || 'inherit' }}>
              ● {tournament.status === 'setup' ? 'Waiting for players' : tournament.status === 'active' ? 'Active' : 'Completed'}
            </span>
          </div>
        </div>
        {isAdmin && tournament.status === 'setup' && (
          <button className="activate-btn" onClick={handleForceActivate} disabled={activating}>
            {activating ? 'Activating…' : '⚡ Force Activate'}
          </button>
        )}
      </div>

      {message && <div className="success-message">{message}</div>}

      {loading && <div className="loading-wrap"><div className="spinner" /></div>}

      {!loading && (
        <div className="detail-grid">
          {/* Participants */}
          <div className="detail-card">
            <h3 className="detail-card-title">Players ({participants.length}/{tournament.max_players})</h3>
            <div className="participants-list">
              {confirmed.map(p => (
                <div key={p.user_id} className="participant-row confirmed">
                  <span className="participant-name">{userMap[p.user_id]?.name || '—'}</span>
                  <span className="participant-elo">{userMap[p.user_id]?.elo_rating || 1200}</span>
                  <span className="confirmed-chip">✓ Joined</span>
                </div>
              ))}
              {pending.map(p => (
                <div key={p.user_id} className="participant-row pending">
                  <span className="participant-name">{userMap[p.user_id]?.name || '—'}</span>
                  <span className="participant-elo">{userMap[p.user_id]?.elo_rating || 1200}</span>
                  <span className="pending-chip">⏳ Pending</span>
                </div>
              ))}
            </div>
            {tournament.status === 'setup' && pending.length > 0 && (
              <p className="detail-hint">Waiting for {pending.length} player{pending.length !== 1 ? 's' : ''} to accept their invitation.</p>
            )}

            {isAdmin && tournament.status === 'setup' && eligibleToAdd.length > 0 && (
              <div className="force-add-row">
                <select
                  value={addingUserId}
                  onChange={e => setAddingUserId(e.target.value)}
                  className="force-add-select"
                >
                  <option value="">Add player…</option>
                  {eligibleToAdd.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button
                  className="force-add-btn"
                  onClick={handleForceAdd}
                  disabled={!addingUserId || adding}
                >
                  {adding ? '…' : 'Add'}
                </button>
              </div>
            )}
            {isAdmin && tournament.status === 'setup' && pending.length > 0 && (
              <button
                className="confirm-all-btn"
                onClick={async () => {
                  await supabase.from('tournament_participants')
                    .update({ confirmed: true })
                    .eq('tournament_id', tournament.id)
                  setMessage('All pending players marked as confirmed.')
                  fetchAll()
                }}
              >
                ✓ Confirm all pending players
              </button>
            )}
          </div>

          {/* Matches */}
          {matches.length > 0 && (
            <div className="detail-card">
              <h3 className="detail-card-title">Matches</h3>
              {Object.entries(byRound).map(([round, roundMatches]) => (
                <div key={round} className="round-section">
                  {Object.keys(byRound).length > 1 && (
                    <div className="round-label">Round {round}</div>
                  )}
                  {roundMatches.map(m => {
                    const p1 = userMap[m.player1_id]
                    const p2 = userMap[m.player2_id]
                    const isComplete = m.match_status === 'completed'
                    return (
                      <div key={m.id} className={`match-row ${isComplete ? 'match-done' : ''}`}>
                        <span className={m.winner_id === m.player1_id ? 'match-winner-name' : 'match-player-name'}>
                          {p1?.name || 'TBD'}
                        </span>
                        <span className="match-vs">
                          {isComplete
                            ? `${m.player1_score ?? '—'} – ${m.player2_score ?? '—'}`
                            : 'vs'}
                        </span>
                        <span className={m.winner_id === m.player2_id ? 'match-winner-name' : 'match-player-name'}>
                          {p2?.name || 'TBD'}
                        </span>
                        <span className={`match-status-chip ${isComplete ? 'done' : 'pending'}`}>
                          {isComplete ? 'Done' : 'Pending'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Standings for round-robin */}
          {tournament.tournament_type === 'round-robin' && participants.length > 0 && (
            <div className="detail-card">
              <h3 className="detail-card-title">Standings</h3>
              <div className="standings-list">
                {[...participants]
                  .sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.points || 0) - (a.points || 0))
                  .map((p, i) => (
                    <div key={p.user_id} className="standing-row">
                      <span className="standing-rank">#{i + 1}</span>
                      <span className="standing-name">{userMap[p.user_id]?.name || '—'}</span>
                      <span className="standing-stat">{p.wins || 0}W</span>
                      <span className="standing-stat">{p.losses || 0}L</span>
                      <span className="standing-pts">{p.points || 0} pts</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
