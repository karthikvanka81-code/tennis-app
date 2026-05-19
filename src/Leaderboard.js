import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { getELOBadge } from './UpdateELOLogic'
import './Match.css'

export default function Leaderboard({ user }) {
  const [view, setView]           = useState('elo')      // 'elo' | 'tournament'
  const [globalPlayers, setGlobalPlayers] = useState([])
  const [tournaments, setTournaments]     = useState([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [standings, setStandings] = useState([])
  const [userMap, setUserMap]     = useState({})
  const [loading, setLoading]     = useState(true)
  const [sortBy, setSortBy]       = useState('elo')      // 'elo' | 'wins'
  const [error, setError]         = useState('')

  useEffect(() => {
    fetchAll()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    try {
      const { data: users } = await supabase.from('users').select('id, name, elo_rating')
      if (users) {
        const map = {}
        users.forEach(u => { map[u.id] = u })
        setUserMap(map)
        setGlobalPlayers([...users].sort((a, b) => (b.elo_rating || 1200) - (a.elo_rating || 1200)))
      }

      const { data: parts } = await supabase
        .from('tournament_participants')
        .select('tournament_id')
        .eq('user_id', user.id)

      if (parts && parts.length > 0) {
        const ids = parts.map(p => p.tournament_id)
        const { data: tourns } = await supabase.from('tournaments').select('*').in('id', ids)
        if (tourns && tourns.length > 0) {
          setTournaments(tourns)
          setSelectedTournament(tourns[0].id)
          await fetchStandings(tourns[0].id)
        }
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const fetchStandings = async (tid) => {
    const { data, error: err } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tid)
      .order('wins', { ascending: false })
    if (err) setError(err.message)
    else setStandings(data || [])
  }

  const sortedStandings = [...standings].sort((a, b) => {
    if (sortBy === 'elo') {
      const aElo = userMap[a.user_id]?.elo_rating || 1200
      const bElo = userMap[b.user_id]?.elo_rating || 1200
      return bElo - aElo
    }
    return b.wins - a.wins
  })

  if (loading) return <div className="match-container"><p>Loading…</p></div>

  return (
    <div className="match-container">
      <div className="match-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Leaderboard</h2>
        <div className="lb-view-toggle">
          <button
            className={`lb-toggle-btn ${view === 'elo' ? 'active' : ''}`}
            onClick={() => setView('elo')}
          >
            Global ELO
          </button>
          <button
            className={`lb-toggle-btn ${view === 'tournament' ? 'active' : ''}`}
            onClick={() => setView('tournament')}
          >
            Tournament
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* ── GLOBAL ELO VIEW ── */}
      {view === 'elo' && (
        <div className="leaderboard">
          <div className="leaderboard-header" style={{ gridTemplateColumns: '50px 1fr 110px 80px' }}>
            <div className="rank">Rank</div>
            <div className="player">Player</div>
            <div className="stat">Rating</div>
            <div className="stat">Badge</div>
          </div>
          {globalPlayers.length === 0 ? (
            <p className="no-matches">No players found.</p>
          ) : (
            globalPlayers.map((p, i) => {
              const elo   = p.elo_rating || 1200
              const badge = getELOBadge(elo)
              const isMe  = p.id === user.id
              return (
                <div
                  key={p.id}
                  className="leaderboard-row"
                  style={{
                    gridTemplateColumns: '50px 1fr 110px 80px',
                    background: isMe ? '#FFF3EE' : undefined,
                  }}
                >
                  <div className="rank">#{i + 1}</div>
                  <div className="player">
                    {p.name || '—'}
                    {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: '#F97316', fontWeight: 700 }}>you</span>}
                  </div>
                  <div className="stat" style={{ textAlign: 'left' }}>
                    <span className="elo-inline" style={{ color: badge.color, fontWeight: 700 }}>
                      {elo}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="elo-badge-sm" style={{ background: badge.bg, color: badge.color }}>
                      {badge.emoji} {badge.label}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── TOURNAMENT VIEW ── */}
      {view === 'tournament' && (
        tournaments.length === 0 ? (
          <p className="no-matches">You haven't joined any tournaments yet.</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <div className="tournament-selector" style={{ margin: 0 }}>
                <select
                  value={selectedTournament}
                  onChange={e => { setSelectedTournament(e.target.value); fetchStandings(e.target.value) }}
                >
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="lb-sort-toggle">
                <span style={{ fontSize: 13, color: '#A0754F', marginRight: 8 }}>Sort by:</span>
                <button
                  className={`lb-toggle-btn ${sortBy === 'elo' ? 'active' : ''}`}
                  onClick={() => setSortBy('elo')}
                >
                  ELO
                </button>
                <button
                  className={`lb-toggle-btn ${sortBy === 'wins' ? 'active' : ''}`}
                  onClick={() => setSortBy('wins')}
                >
                  Wins
                </button>
              </div>
            </div>

            <div className="leaderboard">
              <div className="leaderboard-header" style={{ gridTemplateColumns: '50px 1fr 70px 70px 70px 100px' }}>
                <div className="rank">Rank</div>
                <div className="player">Player</div>
                <div className="stat">Wins</div>
                <div className="stat">Losses</div>
                <div className="stat">Win %</div>
                <div className="stat">ELO</div>
              </div>

              {sortedStandings.length === 0 ? (
                <p className="no-matches">No participants yet.</p>
              ) : (
                sortedStandings.map((s, i) => {
                  const total  = s.wins + s.losses
                  const pct    = total > 0 ? Math.round((s.wins / total) * 100) : 0
                  const u      = userMap[s.user_id]
                  const elo    = u?.elo_rating || 1200
                  const badge  = getELOBadge(elo)
                  const isMe   = s.user_id === user.id

                  return (
                    <div
                      key={s.user_id}
                      className="leaderboard-row"
                      style={{
                        gridTemplateColumns: '50px 1fr 70px 70px 70px 100px',
                        background: isMe ? '#FFF3EE' : undefined,
                      }}
                    >
                      <div className="rank">#{i + 1}</div>
                      <div className="player">
                        {u?.name || 'Unknown'}
                        {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: '#F97316', fontWeight: 700 }}>you</span>}
                      </div>
                      <div className="stat wins">{s.wins}</div>
                      <div className="stat losses">{s.losses}</div>
                      <div className="stat">{pct}%</div>
                      <div className="stat">
                        <span className="elo-badge-sm" style={{ background: badge.bg, color: badge.color }}>
                          {badge.emoji} {elo}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )
      )}
    </div>
  )
}
