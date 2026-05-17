import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Match.css'

export default function Leaderboard({ user }) {
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [standings, setStandings] = useState([])
  const [userMap, setUserMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [user])

  const fetchData = async () => {
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
              setSelectedTournament(tourns[0].id)
              fetchStandings(tourns[0].id)
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

  const fetchStandings = async (tournamentId) => {
    try {
      const { data, error: standingsError } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('wins', { ascending: false })

      if (standingsError) {
        setError(`Error fetching standings: ${standingsError.message}`)
      } else {
        setStandings(data || [])
      }
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
        <h2>Leaderboard</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {tournaments.length === 0 ? (
        <p className="no-matches">You haven't joined any tournaments yet</p>
      ) : (
        <>
          <div className="tournament-selector">
            <select
              value={selectedTournament}
              onChange={(e) => {
                setSelectedTournament(e.target.value)
                fetchStandings(e.target.value)
              }}
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="leaderboard">
            <div className="leaderboard-header">
              <div className="rank">Rank</div>
              <div className="player">Player</div>
              <div className="stat">Wins</div>
              <div className="stat">Losses</div>
              <div className="stat">Win %</div>
            </div>

            {standings.length === 0 ? (
              <p className="no-matches">No participants yet</p>
            ) : (
              standings.map((standing, index) => {
                const total = standing.wins + standing.losses
                const winPercentage = total > 0 ? Math.round((standing.wins / total) * 100) : 0

                return (
                  <div key={standing.user_id} className="leaderboard-row">
                    <div className="rank">#{index + 1}</div>
                    <div className="player">{userMap[standing.user_id] || 'Unknown'}</div>
                    <div className="stat wins">{standing.wins}</div>
                    <div className="stat losses">{standing.losses}</div>
                    <div className="stat">{winPercentage}%</div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}