import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import './Tournament.css'

export default function TournamentDetail({ tournament: initialTournament, onBack, currentUser, onViewPlayer }) {
  const [tournament, setTournament]     = useState(initialTournament)
  const [participants, setParticipants] = useState([])
  const [matches, setMatches]           = useState([])
  const [allUsers, setAllUsers]         = useState([])
  const [userMap, setUserMap]           = useState({})
  const [loading, setLoading]           = useState(true)
  const [activating, setActivating]     = useState(false)
  const [message, setMessage]           = useState('')
  const [addingUserId, setAddingUserId] = useState('')
  const [adding, setAdding]             = useState(false)
  const [activeTab, setActiveTab]       = useState('overview')
  // Chat
  const [chatMessages, setChatMessages] = useState([])
  const [chatText, setChatText]         = useState('')
  const chatEndRef                      = useRef(null)
  // Scheduling
  const [schedulingMatchId, setSchedulingMatchId] = useState(null)
  const [scheduleDate, setScheduleDate]           = useState('')

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

  // Chat
  useEffect(() => {
    const fetchChat = async () => {
      const { data } = await supabase.from('tournament_messages')
        .select('*').eq('tournament_id', tournament.id)
        .order('created_at', { ascending: true }).limit(100)
      setChatMessages(data || [])
    }
    fetchChat()

    const channel = supabase.channel(`chat_${tournament.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tournament_messages',
        filter: `tournament_id=eq.${tournament.id}` },
        payload => setChatMessages(prev => [...prev, payload.new])
      ).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tournament.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSendChat = async (e) => {
    e.preventDefault()
    if (!chatText.trim() || !currentUser) return
    await supabase.from('tournament_messages').insert([{
      tournament_id: tournament.id,
      user_id: currentUser.id,
      text: chatText.trim(),
    }])
    setChatText('')
  }

  // Match scheduling
  const handleProposeSchedule = async (matchId) => {
    if (!scheduleDate) return
    await supabase.from('matches').update({
      scheduled_at: new Date(scheduleDate).toISOString(),
      schedule_proposed_by: currentUser.id,
      schedule_status: 'proposed',
    }).eq('id', matchId)
    setSchedulingMatchId(null)
    setScheduleDate('')
    fetchAll()
    setMessage('Match time proposed — waiting for other player to confirm.')
  }

  const handleConfirmSchedule = async (matchId) => {
    await supabase.from('matches').update({ schedule_status: 'confirmed' }).eq('id', matchId)
    fetchAll()
    setMessage('Match time confirmed!')
  }

  // Close tournament (admin)
  const handleCloseTournament = async () => {
    // Determine winner
    let winnerId = null
    const confirmed = participants.filter(p => p.confirmed)
    if (tournament.tournament_type === 'round-robin' || tournament.tournament_type === 'one-to-one') {
      const top = [...confirmed].sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.points || 0) - (a.points || 0))[0]
      winnerId = top?.user_id || null
    } else if (tournament.tournament_type === 'knockout') {
      const lastMatch = [...matches].filter(m => m.match_status === 'completed')
        .sort((a, b) => b.round - a.round || b.match_order - a.match_order)[0]
      winnerId = lastMatch?.winner_id || null
    }

    const { data: updated } = await supabase.from('tournaments')
      .update({ status: 'completed', winner_id: winnerId, completed_at: new Date().toISOString() })
      .eq('id', tournament.id).select().single()

    if (updated) setTournament(updated)

    if (winnerId) {
      const winnerName = userMap[winnerId]?.name || 'Someone'
      await supabase.from('activity_feed').insert([{
        user_id: currentUser.id,
        type: 'tournament_created',
        data: { tournament_name: tournament.name, tournament_type: '🏆 Winner: ' + winnerName, creator_name: winnerName },
      }])
    }
    setMessage(`Tournament closed!${winnerId ? ` Winner: ${userMap[winnerId]?.name}` : ''}`)
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

  const handleAddMatchSession = async () => {
    const playerIds = participants.filter(p => p.confirmed).map(p => p.user_id)
    if (playerIds.length < 2) return
    const allMatches = matches
    const maxOrder = allMatches.length > 0 ? Math.max(...allMatches.map(m => m.match_order ?? 0)) : -1
    await supabase.from('matches').insert([{
      tournament_id: tournament.id,
      player1_id: playerIds[0],
      player2_id: playerIds[1],
      match_status: 'pending',
      round: 1,
      match_order: maxOrder + 1,
    }])
    setMessage('New match added — go to Record Match to enter the score.')
    fetchAll()
  }

  const typeLabel = { 'one-to-one': 'One-to-One', 'round-robin': 'Round Robin', 'knockout': 'Knockout' }
  const statusColor = { setup: 'var(--c-secondary)', active: '#00C896', completed: 'var(--c-primary)' }

  const pending         = participants.filter(p => !p.confirmed)
  const confirmed       = participants.filter(p => p.confirmed)
  const isAdmin         = tournament.admin_id === currentUser?.id
  const participantIds  = participants.map(p => p.user_id)
  const eligibleToAdd   = allUsers.filter(u => !participantIds.includes(u.id))
  const isOneToOne      = tournament.tournament_type === 'one-to-one'
  const pendingMatches  = matches.filter(m => m.match_status === 'pending')

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
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isAdmin && tournament.status === 'setup' && (
            <button className="activate-btn" onClick={handleForceActivate} disabled={activating}>
              {activating ? 'Activating…' : '⚡ Force Activate'}
            </button>
          )}
          {isAdmin && tournament.status === 'active' && (
            <button className="close-tournament-btn" onClick={handleCloseTournament}>
              🏁 Close Tournament
            </button>
          )}
          {isOneToOne && tournament.status === 'active' && pendingMatches.length === 0 && (
            <button className="activate-btn" onClick={handleAddMatchSession}>
              + Add Match Session
            </button>
          )}
          {isOneToOne && tournament.status === 'active' && pendingMatches.length > 0 && (
            <span className="detail-hint" style={{ alignSelf: 'center', margin: 0 }}>
              {pendingMatches.length} match{pendingMatches.length > 1 ? 'es' : ''} ready to record
            </span>
          )}
        </div>
      </div>

      {message && <div className="success-message">{message}</div>}

      {loading && <div className="loading-wrap"><div className="spinner" /></div>}

      {/* Winner banner */}
      {tournament.status === 'completed' && tournament.winner_id && (
        <div className="winner-banner">
          🏆 Tournament Winner: <strong>{userMap[tournament.winner_id]?.name || '—'}</strong>
        </div>
      )}

      {/* Tabs */}
      {!loading && (
        <div className="detail-tabs">
          {['overview', 'chat', 'schedule'].map(tab => (
            <button key={tab} className={`detail-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}>
              {tab === 'overview' ? '📊 Overview' : tab === 'chat' ? `💬 Chat${chatMessages.length > 0 ? ` (${chatMessages.length})` : ''}` : '📅 Schedule'}
            </button>
          ))}
        </div>
      )}

      {!loading && activeTab === 'chat' && (
        <div className="detail-card chat-card">
          <div className="chat-messages">
            {chatMessages.length === 0 && <p className="chat-empty">No messages yet — start the conversation!</p>}
            {chatMessages.map(m => {
              const isMe = m.user_id === currentUser?.id
              return (
                <div key={m.id} className={`chat-bubble ${isMe ? 'mine' : 'theirs'}`}>
                  {!isMe && <span className="chat-author">{userMap[m.user_id]?.name || '?'}</span>}
                  <span className="chat-text">{m.text}</span>
                  <span className="chat-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-form" onSubmit={handleSendChat}>
            <input className="chat-input" placeholder="Message…" value={chatText}
              onChange={e => setChatText(e.target.value)} maxLength={300} />
            <button type="submit" className="chat-send-btn" disabled={!chatText.trim()}>Send</button>
          </form>
        </div>
      )}

      {!loading && activeTab === 'schedule' && (
        <div className="detail-card">
          <h3 className="detail-card-title">Match Schedule</h3>
          {matches.filter(m => m.match_status === 'pending').length === 0
            ? <p className="detail-hint">No pending matches to schedule.</p>
            : matches.filter(m => m.match_status === 'pending').map(m => {
              const p1 = userMap[m.player1_id]
              const p2 = userMap[m.player2_id]
              const isScheduling = schedulingMatchId === m.id
              const proposedByMe = m.schedule_proposed_by === currentUser?.id
              return (
                <div key={m.id} className="schedule-match-row">
                  <span className="schedule-players">{p1?.name || '?'} vs {p2?.name || '?'}</span>
                  {m.schedule_status === 'confirmed' && m.scheduled_at && (
                    <span className="schedule-confirmed">✓ {new Date(m.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  )}
                  {m.schedule_status === 'proposed' && m.scheduled_at && (
                    <span className="schedule-proposed">
                      ⏳ {new Date(m.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      {!proposedByMe && (
                        <button className="schedule-confirm-btn" onClick={() => handleConfirmSchedule(m.id)}>Confirm</button>
                      )}
                    </span>
                  )}
                  {(!m.schedule_status || m.schedule_status === 'none') && !isScheduling && (
                    <button className="schedule-propose-btn" onClick={() => setSchedulingMatchId(m.id)}>Propose Time</button>
                  )}
                  {isScheduling && (
                    <div className="schedule-picker">
                      <input type="datetime-local" className="schedule-input"
                        value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
                      <button className="force-add-btn" onClick={() => handleProposeSchedule(m.id)} disabled={!scheduleDate}>Propose</button>
                      <button className="confirm-all-btn" style={{ width: 'auto', padding: '6px 10px' }} onClick={() => setSchedulingMatchId(null)}>Cancel</button>
                    </div>
                  )}
                </div>
              )
            })
          }
        </div>
      )}

      {!loading && activeTab === 'overview' && (
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
                    const setScores = []
                    if (m.set1_player1 != null) setScores.push(`${m.set1_player1}–${m.set1_player2}`)
                    if (m.set2_player1 != null) setScores.push(`${m.set2_player1}–${m.set2_player2}`)
                    if (m.set3_player1 != null) setScores.push(`${m.set3_player1}–${m.set3_player2}`)
                    return (
                      <div key={m.id} className={`match-row ${isComplete ? 'match-done' : ''}`}>
                        <span className={m.winner_id === m.player1_id ? 'match-winner-name' : 'match-player-name'}>
                          {p1?.name || 'TBD'}
                        </span>
                        <div className="match-score-col">
                          {isComplete ? (
                            <>
                              <span className="match-set-count">{m.player1_score ?? 0}–{m.player2_score ?? 0}</span>
                              {setScores.length > 0 && (
                                <span className="match-game-scores">{setScores.join(', ')}</span>
                              )}
                            </>
                          ) : (
                            <span className="match-vs">vs</span>
                          )}
                        </div>
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
