import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Tournament.css'

export default function TournamentList({ user }) {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTournamentName, setNewTournamentName] = useState('')
  const [joinedTournaments, setJoinedTournaments] = useState([])

  // Fetch all tournaments and user's joined tournaments
  useEffect(() => {
    fetchTournaments()
    fetchJoinedTournaments()
  }, [user])

  const fetchTournaments = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(`Error fetching tournaments: ${fetchError.message}`)
      } else {
        setTournaments(data || [])
      }
      setLoading(false)
    } catch (err) {
      setError(`Error: ${err.message}`)
      setLoading(false)
    }
  }

  const fetchJoinedTournaments = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('tournament_participants')
        .select('tournament_id')
        .eq('user_id', user.id)

      if (!fetchError && data) {
        setJoinedTournaments(data.map((p) => p.tournament_id))
      }
    } catch (err) {
      console.error('Error fetching joined tournaments:', err)
    }
  }

  const handleCreateTournament = async (e) => {
    e.preventDefault()
    if (!newTournamentName.trim()) {
      setError('Please enter a tournament name')
      return
    }

    try {
      const { data, error: createError } = await supabase
        .from('tournaments')
        .insert([
          {
            admin_id: user.id,
            name: newTournamentName,
            status: 'ongoing',
          },
        ])
        .select()

      if (createError) {
        setError(`Error creating tournament: ${createError.message}`)
        return
      }

      // Also add creator as a participant
      if (data && data[0]) {
        await supabase.from('tournament_participants').insert([
          {
            tournament_id: data[0].id,
            user_id: user.id,
            wins: 0,
            losses: 0,
          },
        ])
      }

      setNewTournamentName('')
      setShowCreateForm(false)
      fetchTournaments()
      fetchJoinedTournaments()
      setError('')
    } catch (err) {
      setError(`Error: ${err.message}`)
    }
  }

  const handleJoinTournament = async (tournamentId) => {
    try {
      const { error: joinError } = await supabase
        .from('tournament_participants')
        .insert([
          {
            tournament_id: tournamentId,
            user_id: user.id,
            wins: 0,
            losses: 0,
          },
        ])

      if (joinError) {
        setError(`Error joining tournament: ${joinError.message}`)
        return
      }

      fetchJoinedTournaments()
      setError('')
    } catch (err) {
      setError(`Error: ${err.message}`)
    }
  }

  if (loading) {
    return <div className="tournament-container"><p>Loading tournaments...</p></div>
  }

  return (
    <div className="tournament-container">
      <div className="tournament-header">
        <h2>Tournaments</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="create-btn"
        >
          {showCreateForm ? 'Cancel' : '+ Create Tournament'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showCreateForm && (
        <form onSubmit={handleCreateTournament} className="create-form">
          <input
            type="text"
            placeholder="Tournament name"
            value={newTournamentName}
            onChange={(e) => setNewTournamentName(e.target.value)}
            required
          />
          <button type="submit" className="submit-btn">
            Create Tournament
          </button>
        </form>
      )}

      <div className="tournaments-grid">
        {tournaments.length === 0 ? (
          <p className="no-tournaments">No tournaments yet. Create one!</p>
        ) : (
          tournaments.map((tournament) => (
            <div key={tournament.id} className="tournament-card">
              <h3>{tournament.name}</h3>
              <p className="status">{tournament.status}</p>
              <p className="created">Created: {new Date(tournament.created_at).toLocaleDateString()}</p>
              
              {joinedTournaments.includes(tournament.id) ? (
                <button className="joined-btn" disabled>
                  ✓ Joined
                </button>
              ) : (
                <button
                  onClick={() => handleJoinTournament(tournament.id)}
                  className="join-btn"
                >
                  Join Tournament
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}