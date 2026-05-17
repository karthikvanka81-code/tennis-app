import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Match.css'

export default function MatchHistory({ user }) {
  const [matches, setMatches] = useState([])
  const [userMap, setUserMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMatches()
  }, [user])

  const fetchMatches = async () => {
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')

      if (!usersError && users) {
        const userDict = {}
        users.forEach((u) => {
          userDict[u.id] = u.name
        })
        setUserMap(userDict)
      }

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: false })

      if (matchesError) {
        setError(`Error fetching matches: ${matchesError.message}`)
      } else {
        setMatches(matchesData || [])
      }

      setLoading(false)
    } catch (err) {
      setError(`Error: ${err.message}`)
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="match-container"><p>Loading...</p></div>
  }

  return (
    <div className="match-container">
      <div className="match-header">
        <h2>Match History</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="matches-list">
        {matches.length === 0 ? (
          <p className="no-matches">No matches recorded yet</p>
        ) : (
          matches.map((match) => (
            <div key={match.id} className="match-item">
              <div className="match-info">
                <div className="player-name">{userMap[match.player1_id] || 'Unknown'}</div>
                <div className="match-score">
                  <span className={match.winner_id === match.player1_id ? 'winner-score' : ''}>
                    {match.player1_score}
                  </span>
                  <span className="vs">-</span>
                  <span className={match.winner_id === match.player2_id ? 'winner-score' : ''}>
                    {match.player2_score}
                  </span>
                </div>
                <div className="player-name">{userMap[match.player2_id] || 'Unknown'}</div>
              </div>
              <div className="match-meta">
                <span className="match-date">
                  {new Date(match.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}