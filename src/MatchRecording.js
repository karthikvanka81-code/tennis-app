import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { advanceKnockoutWinner } from './MatchGeneration'
import ConfirmDialog from './ConfirmDialog'
import { friendlyError } from './errorMessages'
import './Match.css'

const EMPTY_SET = { p1: '', p2: '' }
const DEFAULT_SETS = () => [{ p1: '', p2: '' }]

// sets is an array of { p1, p2 }
function calcWinner(sets, p1Id, p2Id) {
  let p1Sets = 0, p2Sets = 0
  for (const s of sets) {
    if (s.p1 === '' || s.p2 === '') continue
    if (parseInt(s.p1) > parseInt(s.p2)) p1Sets++; else p2Sets++
  }
  if (p1Sets === 0 && p2Sets === 0) return null
  if (p1Sets > p2Sets) return { winnerId: p1Id, p1Sets, p2Sets }
  if (p2Sets > p1Sets) return { winnerId: p2Id, p1Sets, p2Sets }
  return null
}

export default function MatchRecording({ user }) {
  const [userMap, setUserMap]           = useState({})
  const [tournaments, setTournaments]   = useState([])
  const [tournamentId, setTournamentId] = useState('')
  const [pendingMatches, setPendingMatches] = useState([])
  const [selectedMatch, setSelectedMatch]   = useState(null)
  const [sets, setSets]         = useState(DEFAULT_SETS())
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [confirmSubmit, setConfirmSubmit] = useState(null)

  useEffect(() => {
    fetchInitialData()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInitialData = async () => {
    const { data: users } = await supabase.from('users').select('id, name, elo_rating')
    if (users) {
      const map = {}
      users.forEach(u => { map[u.id] = u })
      setUserMap(map)
    }

    const { data: parts } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('user_id', user.id)

    if (parts && parts.length > 0) {
      const ids = parts.map(p => p.tournament_id)
      const { data: tourns } = await supabase
        .from('tournaments')
        .select('*')
        .in('id', ids)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (tourns) {
        setTournaments(tourns)
        if (tourns.length > 0) {
          setTournamentId(tourns[0].id)
          fetchPendingMatches(tourns[0].id)
          return
        }
      }
    }
    setLoading(false)
  }

  const fetchPendingMatches = async (tid) => {
    setLoading(true)
    setPendingMatches([])
    setSelectedMatch(null)
    setSets(DEFAULT_SETS())

    if (!tid) { setLoading(false); return }

    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tid)
      .eq('match_status', 'pending')
      .not('player1_id', 'is', null)
      .not('player2_id', 'is', null)
      .order('round',       { ascending: true })
      .order('match_order', { ascending: true })

    setPendingMatches(data || [])
    setLoading(false)
  }

  const handleTournamentChange = (tid) => {
    setTournamentId(tid)
    setError('')
    setSuccess('')
    fetchPendingMatches(tid)
  }

  const handleMatchSelect = (match) => {
    setSelectedMatch(match)
    setSets(DEFAULT_SETS())
    setError('')
    setSuccess('')
  }

  const setVal = (index, field, val) =>
    setSets(prev => prev.map((s, i) => i === index ? { ...s, [field]: val } : s))

  const addSet = () => setSets(prev => [...prev, { ...EMPTY_SET }])
  const removeSet = (index) => setSets(prev => prev.filter((_, i) => i !== index))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!selectedMatch) { setError('Please select a match first.'); return }
    const filledSets = sets.filter(s => s.p1 !== '' && s.p2 !== '')
    if (filledSets.length === 0) {
      setError('Please enter at least one set score.')
      return
    }

    const result = calcWinner(sets, selectedMatch.player1_id, selectedMatch.player2_id)
    if (!result) { setError('Could not determine a winner — scores are tied. Add a deciding set.'); return }

    const { winnerId, p1Sets, p2Sets } = result
    const loserId = winnerId === selectedMatch.player1_id
      ? selectedMatch.player2_id
      : selectedMatch.player1_id

    setConfirmSubmit({ winnerId, loserId, p1Sets, p2Sets })
  }

  const submitResult = async () => {
    const { winnerId, loserId, p1Sets, p2Sets } = confirmSubmit
    setConfirmSubmit(null)
    setSubmitting(true)
    try {
      // Guard: check if match is already completed to prevent double ELO
      const { data: currentMatch } = await supabase
        .from('matches').select('match_status').eq('id', selectedMatch.id).single()
      if (currentMatch?.match_status === 'completed') {
        setError('This match has already been recorded.')
        setSubmitting(false)
        fetchPendingMatches(tournamentId)
        return
      }

      // 1. Update match record
      const filledSets = sets.filter(s => s.p1 !== '' && s.p2 !== '')
      const updatePayload = {
        winner_id:    winnerId,
        match_status: 'completed',
        player1_score: p1Sets,
        player2_score: p2Sets,
      }
      if (filledSets[0]) { updatePayload.set1_player1 = parseInt(filledSets[0].p1); updatePayload.set1_player2 = parseInt(filledSets[0].p2) }
      if (filledSets[1]) { updatePayload.set2_player1 = parseInt(filledSets[1].p1); updatePayload.set2_player2 = parseInt(filledSets[1].p2) }
      if (filledSets[2]) { updatePayload.set3_player1 = parseInt(filledSets[2].p1); updatePayload.set3_player2 = parseInt(filledSets[2].p2) }

      const { error: updateErr } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', selectedMatch.id)

      if (updateErr) { setError(friendlyError(updateErr)); setSubmitting(false); return }

      // 2. Tournament points (10 per set won)
      const [{ data: wp }, { data: lp }] = await Promise.all([
        supabase.from('tournament_participants').select('wins, points')
          .eq('tournament_id', tournamentId).eq('user_id', winnerId).single(),
        supabase.from('tournament_participants').select('losses, points')
          .eq('tournament_id', tournamentId).eq('user_id', loserId).single(),
      ])

      const winnerSets = winnerId === selectedMatch.player1_id ? p1Sets : p2Sets
      const loserSets  = winnerId === selectedMatch.player1_id ? p2Sets : p1Sets

      await Promise.all([
        wp && supabase.from('tournament_participants').update({
          wins:   wp.wins + 1,
          points: (wp.points || 0) + winnerSets * 10,
        }).eq('tournament_id', tournamentId).eq('user_id', winnerId),
        lp && supabase.from('tournament_participants').update({
          losses: lp.losses + 1,
          points: (lp.points || 0) + loserSets * 10,
        }).eq('tournament_id', tournamentId).eq('user_id', loserId),
      ])

      // 3. ELO + H2H via server-side Postgres function (tamper-proof)
      const winnerSetsWon = winnerId === selectedMatch.player1_id ? p1Sets : p2Sets
      const loserSetsWon  = winnerId === selectedMatch.player1_id ? p2Sets : p1Sets
      const { data: eloData, error: eloErr } = await supabase.rpc('update_elo_and_stats', {
        p_match_id:    selectedMatch.id,
        p_winner_id:   winnerId,
        p_loser_id:    loserId,
        p_winner_sets: winnerSetsWon,
        p_loser_sets:  loserSetsWon,
      })
      if (eloErr) { setError(friendlyError(eloErr)); setSubmitting(false); return }
      const eloResult = eloData
        ? { winnerNewRating: eloData.winner_new_elo, loserNewRating: eloData.loser_new_elo, winnerChange: eloData.elo_change, loserChange: -eloData.elo_change }
        : null
      if (eloResult) {
        setUserMap(prev => ({
          ...prev,
          [winnerId]: { ...prev[winnerId], elo_rating: eloResult.winnerNewRating },
          [loserId]:  { ...prev[loserId],  elo_rating: eloResult.loserNewRating  },
        }))
      }

      // 6. Knockout bracket advancement
      const tournament = tournaments.find(t => t.id === tournamentId)
      if (tournament?.tournament_type === 'knockout' && selectedMatch.round != null) {
        await advanceKnockoutWinner(
          tournamentId,
          selectedMatch.round,
          selectedMatch.match_order,
          winnerId,
        )
      }

      // 7. Success message with ELO changes
      const winnerName = userMap[winnerId]?.name || 'Winner'
      const loserName  = userMap[loserId]?.name  || 'Loser'

      let eloMsg = ''
      if (eloResult) {
        const wSign = eloResult.winnerChange >= 0 ? '+' : ''
        const lSign = eloResult.loserChange  >= 0 ? '+' : ''
        eloMsg = ` · ELO: ${winnerName} ${eloResult.winnerNewRating} (${wSign}${eloResult.winnerChange}), ${loserName} ${eloResult.loserNewRating} (${lSign}${eloResult.loserChange})`
      }

      setSuccess(`${winnerName} wins!${eloMsg}`)
      setSelectedMatch(null)
      setSets(DEFAULT_SETS())
      fetchPendingMatches(tournamentId)
    } catch (err) {
      setError(`Error: ${err.message}`)
    }
    setSubmitting(false)
  }

  const p1Name = selectedMatch ? (userMap[selectedMatch.player1_id]?.name || 'Player 1') : ''
  const p2Name = selectedMatch ? (userMap[selectedMatch.player2_id]?.name || 'Player 2') : ''

  if (loading) return <div className="match-container"><p>Loading…</p></div>

  return (
    <div className="match-container">
      <ConfirmDialog
        isOpen={!!confirmSubmit}
        title="Confirm match result"
        message={confirmSubmit ? `${userMap[confirmSubmit.winnerId]?.name || 'Winner'} beat ${userMap[confirmSubmit.loserId]?.name || 'Loser'} — sets ${confirmSubmit.p1Sets}–${confirmSubmit.p2Sets}` : ''}
        detail="ELO ratings will be updated and this result cannot be changed without admin help."
        confirmLabel="Record Result"
        onConfirm={submitResult}
        onCancel={() => setConfirmSubmit(null)}
      />
      <div className="match-header">
        <h2>Record Match</h2>
      </div>

      {error   && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="form-section">
        <label>Tournament</label>
        <select value={tournamentId} onChange={e => handleTournamentChange(e.target.value)}>
          <option value="">Select a tournament</option>
          {tournaments.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {tournaments.length === 0 && (
          <p className="hint">No active tournaments found. Create one and wait for all players to accept.</p>
        )}
      </div>

      {tournamentId && pendingMatches.length === 0 && (
        <p className="no-matches">No pending matches — all done or waiting for bracket to fill.</p>
      )}

      {pendingMatches.length > 0 && (
        <div className="pending-matches-list">
          <span className="form-section-label">Select a match to record</span>
          {pendingMatches.map(m => {
            const p1 = userMap[m.player1_id]
            const p2 = userMap[m.player2_id]
            const p1Elo = p1?.elo_rating || 1200
            const p2Elo = p2?.elo_rating || 1200
            const roundLabel = m.round > 1 ? ` · Round ${m.round}` : ''
            return (
              <div
                key={m.id}
                className={`pending-match-row ${selectedMatch?.id === m.id ? 'selected' : ''}`}
                onClick={() => handleMatchSelect(m)}
              >
                <span className="pending-match-players">
                  {p1?.name || '?'}
                  <span style={{ fontSize: 11, color: 'var(--c-secondary)', marginLeft: 4 }}>({p1Elo})</span>
                  <span className="vs"> vs </span>
                  {p2?.name || '?'}
                  <span style={{ fontSize: 11, color: 'var(--c-secondary)', marginLeft: 4 }}>({p2Elo})</span>
                </span>
                <span className="pending-match-round">{roundLabel}</span>
              </div>
            )
          })}
        </div>
      )}

      {selectedMatch && (
        <form onSubmit={handleSubmit} className="match-form" style={{ marginTop: 24 }}>
          <div className="set-scoring-header">
            <span className="set-player-col">{p1Name}</span>
            <span className="set-label-col"></span>
            <span className="set-player-col">{p2Name}</span>
          </div>

          {sets.map((s, i) => (
            <div key={i} className="set-row">
              <input
                type="number" min="0" max="7"
                className="set-input"
                value={s.p1}
                onChange={e => setVal(i, 'p1', e.target.value)}
                placeholder="0"
              />
              <span className="set-label">
                Set {i + 1}
                {sets.length > 1 && (
                  <button type="button" className="remove-set-btn" onClick={() => removeSet(i)}>✕</button>
                )}
              </span>
              <input
                type="number" min="0" max="7"
                className="set-input"
                value={s.p2}
                onChange={e => setVal(i, 'p2', e.target.value)}
                placeholder="0"
              />
            </div>
          ))}

          {sets.length < 5 && (
            <button type="button" className="add-set-btn" onClick={addSet}>
              + Add Set
            </button>
          )}

          <button
            type="submit"
            className="record-btn"
            disabled={submitting}
            style={{ marginTop: 16 }}
          >
            {submitting ? 'Saving…' : 'Record Match Result'}
          </button>
        </form>
      )}
    </div>
  )
}
