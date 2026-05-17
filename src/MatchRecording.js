import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Match.css'

export default function MatchRecording({ user }) {
  const [allUsers, setAllUsers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [player1Id, setPlayer1Id] = useState('')
  const [player2Id, setPlayer2Id] = useState('')
  const [player1Score, setPlayer1Score] = useState('')
  const [player2Score, setPlayer2Score] = useState('')
  const [tournamentId, setTournamentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchData()
  }, [user])

  const fetchData = async () => {
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')

      if (!usersError && users) {
        setAllUsers(users)
      }

      const { data: participations, error: particError } = await supabase
        .from('tournament_participants')
        .select('tournament_id')
        .eq('user_id', user.id)

      if (!particError && participations) {
        const tournamentIds = participations.map((p) => p.tournament_id)
        
        if (tournamentIds.length > 0) {
          const { data: tourns, error: tournsError } = await supabase
            .from('tournaments')
            .select('*')
            .in('id', tournamentIds)

          if (!tournsError && tourns) {
            setTournaments(tourns)
            if (tourns.length > 0) {
              setTournamentId(tourns[0].id)
            }
          }
        }
      }

      setLoading(false)
    } catch (err) {
      setError(`Error: ${err.message}`)
      setLoading(false)
    }
  }

  const handleRecordMatch = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!player1Id || !player2Id || !player1Score || !player2Score) {
      setError('Please fill in all fields')
      return
    }

    if (player1Id === player2Id) {
      setError('Players must be different')
      return
    }

    try {
      const p1Score = parseInt(player1Score)
      const p2Score = parseInt(player2Score)

      const winnerId = p1Score > p2Score ? player1Id : player2Id

      const { error: insertError } = await supabase
        .from('matches')
        .insert([
          {
            tournament_id: tournamentId,
            player1_id: player1Id,
            player2_id: player2Id,
            player1_score: p1Score,
            player2_score: p2Score,
            winner_id: winnerId,
          },
        ])
        .select()

      if (insertError) {
        setError(`Error recording match: ${insertError.message}`)
        return
      }

      if (tournamentId) {
        const { data: winnerData } = await supabase
          .from('tournament_participants')
          .select('wins, losses')
          .eq('tournament_id', tournamentId)
          .eq('user_id', winnerId)
          .single()

        if (winnerData) {
          await supabase
            .from('tournament_participants')
            .update({ wins: winnerData.wins + 1 })
            .eq('tournament_id', tournamentId)
            .eq('user_id', winnerId)
        }

        const loserId = winnerId === player1Id ? player2Id : player1Id
        const { data: loserData } = await supabase
          .from('tournament_participants')
          .select('wins, losses')
          .eq('tournament_id', tournamentId)
          .eq('user_id', loserId)
          .single()

        if (loserData) {
          await supabase
            .from('tournament_participants')
            .update({ losses: loserData.losses + 1 })
            .eq('tournament_id', tournamentId)
            .eq('user_id', loserId)
        }
      }

      setSuccess('Match recorded successfully!')
      setPlayer1Id('')
      setPlayer2Id('')
      setPlayer1Score('')
      setPlayer2Score('')
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(`Error: ${err.message}`)
    }
  }

  if (loading) {
    return <div className="match-container"><p>Loading...</p></div>
  }

  return (
    <div className="match-container">
      <div className="match-header">
        <h2>Record Match</h2>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleRecordMatch} className="match-form">
        <div className="form-section">
          <label>Tournament</label>
          <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} required>
            <option value="">Select a tournament</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {tournaments.length === 0 && <p className="hint">You haven't joined any tournaments yet</p>}
        </div>

        <div className="match-players">
          <div className="form-section">
            <label>Player 1</label>
            <select value={player1Id} onChange={(e) => setPlayer1Id(e.target.value)} required>
              <option value="">Select player</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="vs-divider">VS</div>

          <div className="form-section">
            <label>Player 2</label>
            <select value={player2Id} onChange={(e) => setPlayer2Id(e.target.value)} required>
              <option value="">Select player</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="match-scores">
          <div className="form-section">
            <label>Player 1 Score</label>
            <input
              type="number"
              min="0"
              value={player1Score}
              onChange={(e) => setPlayer1Score(e.target.value)}
              placeholder="0"
              required
            />
          </div>

          <div className="form-section">
            <label>Player 2 Score</label>
            <input
              type="number"
              min="0"
              value={player2Score}
              onChange={(e) => setPlayer2Score(e.target.value)}
              placeholder="0"
              required
            />
          </div>
        </div>

        <button type="submit" className="record-btn">
          Record Match
        </button>
      </form>
    </div>
  )
}