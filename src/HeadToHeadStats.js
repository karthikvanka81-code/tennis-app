import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Tournament.css'
import './Match.css'

export default function HeadToHeadStats({ user }) {
  const [allUsers, setAllUsers]     = useState([])
  const [opponentId, setOpponentId] = useState('')
  const [h2hData, setH2hData]       = useState(null)
  const [recentMatches, setRecentMatches] = useState([])
  const [loading, setLoading]       = useState(true)
  const [loadingH2h, setLoadingH2h] = useState(false)
  const [userMap, setUserMap]       = useState({})

  useEffect(() => {
    supabase
      .from('users')
      .select('id, name, email')
      .neq('id', user.id)
      .order('name')
      .then(({ data }) => {
        if (data) {
          setAllUsers(data)
          const map = {}
          data.forEach(u => { map[u.id] = u.name || u.email })
          setUserMap(map)
        }
        setLoading(false)
      })
  }, [user.id])

  const fetchH2H = async (oppId) => {
    if (!oppId) return
    setLoadingH2h(true)
    setH2hData(null)
    setRecentMatches([])

    const h2hP1 = user.id < oppId ? user.id : oppId
    const h2hP2 = user.id < oppId ? oppId   : user.id
    const isMeP1 = user.id === h2hP1

    const [{ data: h2h }, { data: matches }] = await Promise.all([
      supabase
        .from('head_to_head_stats')
        .select('*')
        .eq('player1_id', h2hP1)
        .eq('player2_id', h2hP2)
        .maybeSingle(),
      supabase
        .from('matches')
        .select('*')
        .or(`and(player1_id.eq.${user.id},player2_id.eq.${oppId}),and(player1_id.eq.${oppId},player2_id.eq.${user.id})`)
        .eq('match_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (h2h) {
      setH2hData({
        myWins:  isMeP1 ? h2h.player1_wins       : h2h.player2_wins,
        oppWins: isMeP1 ? h2h.player2_wins        : h2h.player1_wins,
        mySets:  isMeP1 ? h2h.total_sets_player1  : h2h.total_sets_player2,
        oppSets: isMeP1 ? h2h.total_sets_player2  : h2h.total_sets_player1,
        total:   h2h.player1_wins + h2h.player2_wins,
      })
    } else if (matches && matches.length > 0) {
      // Compute from raw matches if H2H record not yet written
      let myWins = 0, oppWins = 0, mySets = 0, oppSets = 0
      matches.forEach(m => {
        const isP1 = m.player1_id === user.id
        if (m.winner_id === user.id) myWins++; else oppWins++
        mySets  += (isP1 ? m.player1_score : m.player2_score) || 0
        oppSets += (isP1 ? m.player2_score : m.player1_score) || 0
      })
      setH2hData({ myWins, oppWins, mySets, oppSets, total: myWins + oppWins })
    }

    setRecentMatches(matches || [])
    setLoadingH2h(false)
  }

  const handleSelect = (id) => {
    setOpponentId(id)
    fetchH2H(id)
  }

  const opponent = allUsers.find(u => u.id === opponentId)
  const oppName  = opponent?.name || opponent?.email || 'Opponent'

  if (loading) return <div className="tournament-container"><p>Loading...</p></div>

  return (
    <div className="tournament-container">
      <div className="tournament-header">
        <h2>Head-to-Head</h2>
      </div>

      <div className="form-section" style={{ maxWidth: 360, marginBottom: 28 }}>
        <label>Select Opponent</label>
        <select value={opponentId} onChange={e => handleSelect(e.target.value)}>
          <option value="">Choose a player…</option>
          {allUsers.map(u => (
            <option key={u.id} value={u.id}>{u.name || u.email}</option>
          ))}
        </select>
      </div>

      {loadingH2h && <p style={{ color: '#A0754F' }}>Loading…</p>}

      {!loadingH2h && opponentId && !h2hData && (
        <p className="no-matches">No completed matches against {oppName} yet.</p>
      )}

      {h2hData && (
        <>
          {/* Main record card */}
          <div className="h2h-record-card">
            <div className="h2h-side">
              <div className="h2h-player-name">You</div>
              <div className="h2h-big-wins" style={{ color: h2hData.myWins >= h2hData.oppWins ? '#F97316' : '#A0754F' }}>
                {h2hData.myWins}
              </div>
              <div className="h2h-small-label">wins</div>
            </div>

            <div className="h2h-center">
              <div className="h2h-vs-text">vs</div>
              <div className="h2h-total-label">{h2hData.total} match{h2hData.total !== 1 ? 'es' : ''}</div>
              <div className="h2h-pct-pill">
                {h2hData.total > 0 ? Math.round((h2hData.myWins / h2hData.total) * 100) : 0}% win rate
              </div>
            </div>

            <div className="h2h-side">
              <div className="h2h-player-name">{oppName}</div>
              <div className="h2h-big-wins" style={{ color: h2hData.oppWins > h2hData.myWins ? '#ef4444' : '#A0754F' }}>
                {h2hData.oppWins}
              </div>
              <div className="h2h-small-label">wins</div>
            </div>
          </div>

          {/* Sets breakdown */}
          <div className="h2h-sets-card">
            <span className="h2h-sets-label">Total Sets Won</span>
            <div className="h2h-sets-bar-wrap">
              <span className="h2h-sets-num" style={{ color: '#F97316' }}>{h2hData.mySets}</span>
              <div className="h2h-sets-bar">
                {(h2hData.mySets + h2hData.oppSets) > 0 && (
                  <div
                    className="h2h-sets-bar-fill"
                    style={{ width: `${Math.round((h2hData.mySets / (h2hData.mySets + h2hData.oppSets)) * 100)}%` }}
                  />
                )}
              </div>
              <span className="h2h-sets-num" style={{ color: '#A0754F' }}>{h2hData.oppSets}</span>
            </div>
          </div>

          {/* Recent matches */}
          {recentMatches.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h4 style={{ color: '#333', marginBottom: 12, fontSize: 16, fontWeight: 700 }}>
                Recent Matches
              </h4>
              <div className="matches-list">
                {recentMatches.map(m => {
                  const isP1  = m.player1_id === user.id
                  const iWon  = m.winner_id  === user.id
                  const myScore  = (isP1 ? m.player1_score : m.player2_score) || 0
                  const oppScore = (isP1 ? m.player2_score : m.player1_score) || 0

                  const sets = []
                  if (m.set1_player1 != null) {
                    sets.push(`${isP1 ? m.set1_player1 : m.set1_player2}-${isP1 ? m.set1_player2 : m.set1_player1}`)
                  }
                  if (m.set2_player1 != null) {
                    sets.push(`${isP1 ? m.set2_player1 : m.set2_player2}-${isP1 ? m.set2_player2 : m.set2_player1}`)
                  }
                  if (m.set3_player1 != null) {
                    sets.push(`${isP1 ? m.set3_player1 : m.set3_player2}-${isP1 ? m.set3_player2 : m.set3_player1}`)
                  }

                  return (
                    <div key={m.id} className="match-item">
                      <div className="match-info">
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: iWon ? '#FB9D6B' : '#ef4444',
                            minWidth: 28,
                          }}
                        >
                          {iWon ? 'W' : 'L'}
                        </span>
                        <span className="match-score">
                          <span style={{ color: iWon ? '#F97316' : '#333' }}>{myScore}</span>
                          <span className="vs">–</span>
                          <span style={{ color: !iWon ? '#ef4444' : '#333' }}>{oppScore}</span>
                        </span>
                        <span style={{ fontSize: 13, color: '#A0754F' }}>
                          {sets.join('  ')}
                        </span>
                      </div>
                      <span className="match-date">
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
