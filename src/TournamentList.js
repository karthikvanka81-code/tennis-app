import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import TournamentBracket from './TournamentBracket'
import './Tournament.css'

export default function TournamentList({ user }) {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joinedTournaments, setJoinedTournaments] = useState([])
  const [bracketTournament, setBracketTournament] = useState(null)

  useEffect(() => {
    fetchTournaments()
    fetchJoinedTournaments()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTournaments = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })
      if (fetchError) setError(`Error fetching tournaments: ${fetchError.message}`)
      else setTournaments(data || [])
      setLoading(false)
    } catch (err) {
      setError(`Error: ${err.message}`)
      setLoading(false)
    }
  }

  const fetchJoinedTournaments = async () => {
    try {
      const { data } = await supabase
        .from('tournament_participants')
        .select('tournament_id')
        .eq('user_id', user.id)
      if (data) setJoinedTournaments(data.map(p => p.tournament_id))
    } catch (err) {
      console.error('Error fetching joined tournaments:', err)
    }
  }

  const handleJoinTournament = async (tournamentId) => {
    try {
      const { error: joinError } = await supabase
        .from('tournament_participants')
        .insert([{ tournament_id: tournamentId, user_id: user.id, wins: 0, losses: 0 }])
      if (joinError) { setError(`Error joining tournament: ${joinError.message}`); return }
      fetchJoinedTournaments()
      setError('')
    } catch (err) {
      setError(`Error: ${err.message}`)
    }
  }

  const typeLabel = (type) => {
    const map = { 'one-to-one': 'One-to-One', 'round-robin': 'Round Robin', 'knockout': 'Knockout' }
    return map[type] || type || 'Classic'
  }

  const statusLabel = (status) => {
    const map = { setup: 'Waiting', active: 'Active', completed: 'Completed', ongoing: 'Active' }
    return map[status] || status
  }

  if (loading) return <div className="tournament-container"><p>Loading tournaments...</p></div>

  return (
    <div className="tournament-container">
      <div className="tournament-header">
        <h2>Tournaments</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tournaments-grid">
        {tournaments.length === 0 ? (
          <p className="no-tournaments">No tournaments yet. Use "Create Tournament" to start one!</p>
        ) : (
          tournaments.map(tournament => (
            <div key={tournament.id} className="tournament-card">
              <div className="tournament-card-top">
                <h3>{tournament.name}</h3>
                <span className="status">{statusLabel(tournament.status)}</span>
              </div>
              {tournament.tournament_type && (
                <span className="tournament-type-chip">{typeLabel(tournament.tournament_type)}</span>
              )}
              <p className="created">Created: {new Date(tournament.created_at).toLocaleDateString()}</p>
              {tournament.max_players && (
                <p className="created">{tournament.max_players} players</p>
              )}

              <div className="tournament-card-actions">
                {tournament.tournament_type === 'knockout' && tournament.status === 'active' && (
                  <button
                    className="bracket-btn"
                    onClick={() => setBracketTournament(tournament)}
                  >
                    View Bracket
                  </button>
                )}
                {joinedTournaments.includes(tournament.id) ? (
                  <button className="joined-btn" disabled>✓ Joined</button>
                ) : (
                  <button className="join-btn" onClick={() => handleJoinTournament(tournament.id)}>
                    Join
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {bracketTournament && (
        <TournamentBracket
          tournamentId={bracketTournament.id}
          tournamentName={bracketTournament.name}
          onClose={() => setBracketTournament(null)}
        />
      )}
    </div>
  )
}
