import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { getELOBadge } from './UpdateELOLogic'
import RatingHistory from './RatingHistory'
import './Tournament.css'

export default function PlayerProfile({ userId, currentUser }) {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const targetId = userId || currentUser?.id

  useEffect(() => {
    if (!targetId) return
    fetchProfile()
  }, [targetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfile = async () => {
    try {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', targetId)
        .single()

      if (userErr) { setError(userErr.message); setLoading(false); return }
      setProfile(user)

      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${targetId},player2_id.eq.${targetId}`)
        .eq('match_status', 'completed')

      if (matches) {
        let wins = 0, losses = 0, setsWon = 0, setsLost = 0
        matches.forEach(m => {
          const isP1 = m.player1_id === targetId
          const isWinner = m.winner_id === targetId
          if (isWinner) wins++; else losses++
          setsWon  += (isP1 ? m.player1_score : m.player2_score) || 0
          setsLost += (isP1 ? m.player2_score : m.player1_score) || 0
        })
        setStats({ wins, losses, setsWon, setsLost, total: wins + losses })
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (loading) return <div className="tournament-container"><p>Loading profile...</p></div>
  if (error)   return <div className="tournament-container"><div className="error-message">{error}</div></div>
  if (!profile) return null

  const elo   = profile.elo_rating || 1200
  const badge = getELOBadge(elo)
  const winPct = stats?.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0

  return (
    <div className="tournament-container">
      <div className="tournament-header">
        <h2>Player Profile</h2>
      </div>

      <div className="profile-card">
        <div className="profile-top">
          <div className="profile-avatar">
            {(profile.name || profile.email || '?')[0].toUpperCase()}
          </div>
          <div className="profile-info">
            <h3 className="profile-name">{profile.name || profile.email}</h3>
            <p className="profile-email">{profile.email}</p>
          </div>
          <div className="profile-elo-block">
            <div className="profile-elo-rating">{elo}</div>
            <div className="elo-badge" style={{ background: badge.bg, color: badge.color }}>
              {badge.emoji} {badge.label}
            </div>
          </div>
        </div>

        <div className="profile-stats-grid">
          {[
            { value: stats?.wins   || 0, label: 'Wins',      color: '#FB9D6B' },
            { value: stats?.losses || 0, label: 'Losses',    color: '#ef4444' },
            { value: `${winPct}%`,       label: 'Win Rate',  color: '#F97316' },
            { value: stats?.total  || 0, label: 'Matches',   color: null      },
            { value: stats?.setsWon  || 0, label: 'Sets Won',  color: '#FB9D6B' },
            { value: stats?.setsLost || 0, label: 'Sets Lost', color: '#ef4444' },
          ].map(({ value, label, color }) => (
            <div key={label} className="profile-stat">
              <div className="profile-stat-value" style={color ? { color } : {}}>
                {value}
              </div>
              <div className="profile-stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="profile-section">
        <h4 className="profile-section-title">ELO Rating History</h4>
        <div style={{ background: 'white', borderRadius: 10, padding: '20px 16px', border: '1px solid #E1D0B8' }}>
          <RatingHistory userId={targetId} />
        </div>
      </div>

      <div className="profile-section">
        <h4 className="profile-section-title">Rating Tier</h4>
        <div className="elo-tiers-grid">
          {[
            { label: 'Bronze',   range: '< 1000',     color: '#92400E', bg: '#FEF3C7', emoji: '🥉' },
            { label: 'Silver',   range: '1000–1200',  color: '#6B7280', bg: '#F3F4F6', emoji: '🥈' },
            { label: 'Gold',     range: '1200–1400',  color: '#D97706', bg: '#FEF9C3', emoji: '🥇' },
            { label: 'Platinum', range: '1400–1600',  color: '#2563EB', bg: '#DBEAFE', emoji: '💎' },
            { label: 'Diamond',  range: '> 1600',     color: '#7C3AED', bg: '#EDE9FE', emoji: '💠' },
          ].map(tier => (
            <div
              key={tier.label}
              className="elo-tier-chip"
              style={{
                background: tier.bg,
                color: tier.color,
                border: `2px solid ${badge.label === tier.label ? tier.color : 'transparent'}`,
                fontWeight: badge.label === tier.label ? 700 : 500,
              }}
            >
              {tier.emoji} {tier.label}
              <span className="elo-tier-range">{tier.range}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
