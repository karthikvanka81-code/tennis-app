import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Tournament.css'

export default function TournamentBracket({ tournamentId, tournamentName, onClose }) {
  const [matchesByRound, setMatchesByRound] = useState({})
  const [userMap, setUserMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBracketData()
  }, [tournamentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBracketData = async () => {
    try {
      const { data: users } = await supabase.from('users').select('id, name')
      if (users) {
        const map = {}
        users.forEach(u => { map[u.id] = u.name })
        setUserMap(map)
      }

      const { data: matches, error: matchErr } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('match_order', { ascending: true })

      if (matchErr) { setError(matchErr.message); setLoading(false); return }

      const grouped = {}
      ;(matches || []).forEach(m => {
        if (!grouped[m.round]) grouped[m.round] = []
        grouped[m.round].push(m)
      })
      setMatchesByRound(grouped)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const rounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b)
  const totalRounds = rounds.length

  const getRoundLabel = (round) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semi-Finals'
    return `Round ${round}`
  }

  const getSetScoreDisplay = (match) => {
    if (match.match_status !== 'completed') return null
    const sets = []
    if (match.set1_player1 != null) sets.push(`${match.set1_player1}-${match.set1_player2}`)
    if (match.set2_player1 != null) sets.push(`${match.set2_player1}-${match.set2_player2}`)
    if (match.set3_player1 != null) sets.push(`${match.set3_player1}-${match.set3_player2}`)
    return sets.join(' | ')
  }

  if (loading) return <div className="bracket-overlay"><div className="bracket-modal"><p>Loading bracket...</p></div></div>

  return (
    <div className="bracket-overlay" onClick={onClose}>
      <div className="bracket-modal" onClick={e => e.stopPropagation()}>
        <div className="bracket-modal-header">
          <h2>{tournamentName} — Bracket</h2>
          <button className="bracket-close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="bracket-container">
          {rounds.map(round => (
            <div key={round} className="bracket-round">
              <div className="bracket-round-label">{getRoundLabel(round)}</div>
              <div className="bracket-matches">
                {matchesByRound[round].map(match => {
                  const p1Name = match.player1_id ? (userMap[match.player1_id] || 'Unknown') : 'TBD'
                  const p2Name = match.player2_id ? (userMap[match.player2_id] || 'Unknown') : 'TBD'
                  const isCompleted = match.match_status === 'completed'
                  const scores = getSetScoreDisplay(match)

                  return (
                    <div key={match.id} className={`bracket-match ${isCompleted ? 'completed' : ''}`}>
                      <div className={`bracket-player ${match.winner_id === match.player1_id && isCompleted ? 'winner' : ''}`}>
                        <span className="bracket-player-name">{p1Name}</span>
                      </div>
                      <div className="bracket-match-divider">
                        {isCompleted && scores
                          ? <span className="bracket-scores">{scores}</span>
                          : <span className="bracket-vs">vs</span>}
                      </div>
                      <div className={`bracket-player ${match.winner_id === match.player2_id && isCompleted ? 'winner' : ''}`}>
                        <span className="bracket-player-name">{p2Name}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
