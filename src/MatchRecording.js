import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { advanceKnockoutWinner } from './MatchGeneration'
import { updatePlayerELO, updateHeadToHeadStats, recordELOHistory } from './UpdateELOLogic'
import './Match.css'

const EMPTY_SETS = { s1p1: '', s1p2: '', s2p1: '', s2p2: '', s3p1: '', s3p2: '' }

function calcWinner(sets, p1Id, p2Id) {
  let p1Sets = 0, p2Sets = 0
  if (sets.s1p1 !== '' && sets.s1p2 !== '') {
    if (parseInt(sets.s1p1) > parseInt(sets.s1p2)) p1Sets++; else p2Sets++
  }
  if (sets.s2p1 !== '' && sets.s2p2 !== '') {
    if (parseInt(sets.s2p1) > parseInt(sets.s2p2)) p1Sets++; else p2Sets++
  }
  if (p1Sets < 2 && p2Sets < 2 && sets.s3p1 !== '' && sets.s3p2 !== '') {
    if (parseInt(sets.s3p1) > parseInt(sets.s3p2)) p1Sets++; else p2Sets++
  }
  if (p1Sets >= 2) return { winnerId: p1Id, p1Sets, p2Sets }
  if (p2Sets >= 2) return { winnerId: p2Id, p1Sets, p2Sets }
  return null
}

export default function MatchRecording({ user }) {
  const [userMap, setUserMap]           = useState({})
  const [tournaments, setTournaments]   = useState([])
  const [tournamentId, setTournamentId] = useState('')
  const [pendingMatches, setPendingMatches] = useState([])
  const [selectedMatch, setSelectedMatch]   = useState(null)
  const [sets, setSets]         = useState(EMPTY_SETS)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

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
    setSets(EMPTY_SETS)

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
    setSets(EMPTY_SETS)
    setError('')
    setSuccess('')
  }

  const setVal = (key, val) => setSets(prev => ({ ...prev, [key]: val }))

  const needsSet3 = () => {
    const { s1p1, s1p2, s2p1, s2p2 } = sets
    if (s1p1 === '' || s2p1 === '') return false
    const p1 = (parseInt(s1p1) > parseInt(s1p2) ? 1 : 0) + (parseInt(s2p1) > parseInt(s2p2) ? 1 : 0)
    const p2 = (parseInt(s1p2) > parseInt(s1p1) ? 1 : 0) + (parseInt(s2p2) > parseInt(s2p1) ? 1 : 0)
    return p1 === 1 && p2 === 1
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!selectedMatch) { setError('Select a match to record'); return }
    if (!sets.s1p1 || !sets.s1p2 || !sets.s2p1 || !sets.s2p2) {
      setError('Enter scores for Set 1 and Set 2')
      return
    }

    const result = calcWinner(sets, selectedMatch.player1_id, selectedMatch.player2_id)
    if (!result) { setError('Cannot determine winner — check set scores'); return }

    const { winnerId, p1Sets, p2Sets } = result
    const loserId = winnerId === selectedMatch.player1_id
      ? selectedMatch.player2_id
      : selectedMatch.player1_id

    setSubmitting(true)
    try {
      // 1. Update match record
      const updatePayload = {
        set1_player1: parseInt(sets.s1p1),
        set1_player2: parseInt(sets.s1p2),
        set2_player1: parseInt(sets.s2p1),
        set2_player2: parseInt(sets.s2p2),
        winner_id:    winnerId,
        match_status: 'completed',
        player1_score: p1Sets,
        player2_score: p2Sets,
      }
      if (sets.s3p1 !== '' && sets.s3p2 !== '') {
        updatePayload.set3_player1 = parseInt(sets.s3p1)
        updatePayload.set3_player2 = parseInt(sets.s3p2)
      }

      const { error: updateErr } = await supabase
        .from('matches')
        .update(updatePayload)
        .eq('id', selectedMatch.id)

      if (updateErr) { setError(updateErr.message); setSubmitting(false); return }

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

      // 3. ELO update
      const eloResult = await updatePlayerELO(winnerId, loserId)

      // 4. ELO history
      if (eloResult) {
        await Promise.all([
          recordELOHistory(winnerId, selectedMatch.id, eloResult.winnerNewRating, eloResult.winnerChange),
          recordELOHistory(loserId,  selectedMatch.id, eloResult.loserNewRating,  eloResult.loserChange),
        ])
        // refresh userMap with new ratings
        setUserMap(prev => ({
          ...prev,
          [winnerId]: { ...prev[winnerId], elo_rating: eloResult.winnerNewRating },
          [loserId]:  { ...prev[loserId],  elo_rating: eloResult.loserNewRating  },
        }))
      }

      // 5. Head-to-head stats
      await updateHeadToHeadStats(
        selectedMatch.player1_id,
        selectedMatch.player2_id,
        winnerId,
        p1Sets,
        p2Sets,
      )

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
      setSets(EMPTY_SETS)
      fetchPendingMatches(tournamentId)
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  const p1Name = selectedMatch ? (userMap[selectedMatch.player1_id]?.name || 'Player 1') : ''
  const p2Name = selectedMatch ? (userMap[selectedMatch.player2_id]?.name || 'Player 2') : ''

  if (loading) return <div className="match-container"><p>Loading…</p></div>

  return (
    <div className="match-container">
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
                  <span style={{ fontSize: 11, color: '#A0754F', marginLeft: 4 }}>({p1Elo})</span>
                  <span className="vs"> vs </span>
                  {p2?.name || '?'}
                  <span style={{ fontSize: 11, color: '#A0754F', marginLeft: 4 }}>({p2Elo})</span>
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

          {[
            { label: 'Set 1', k1: 's1p1', k2: 's1p2' },
            { label: 'Set 2', k1: 's2p1', k2: 's2p2' },
          ].map(({ label, k1, k2 }) => (
            <div key={label} className="set-row">
              <input
                type="number" min="0" max="7"
                className="set-input"
                value={sets[k1]}
                onChange={e => setVal(k1, e.target.value)}
                placeholder="0"
              />
              <span className="set-label">{label}</span>
              <input
                type="number" min="0" max="7"
                className="set-input"
                value={sets[k2]}
                onChange={e => setVal(k2, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}

          {needsSet3() && (
            <div className="set-row set-row-decisive">
              <input
                type="number" min="0" max="7"
                className="set-input"
                value={sets.s3p1}
                onChange={e => setVal('s3p1', e.target.value)}
                placeholder="0"
              />
              <span className="set-label">
                Set 3 <span className="set-label-decisive">(decisive)</span>
              </span>
              <input
                type="number" min="0" max="7"
                className="set-input"
                value={sets.s3p2}
                onChange={e => setVal('s3p2', e.target.value)}
                placeholder="0"
              />
            </div>
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
