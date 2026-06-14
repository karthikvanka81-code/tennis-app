import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './ActivityFeed.css'

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (s < 60)  return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const TYPE_META = {
  match_recorded:     { icon: '🎾', label: 'Match' },
  tournament_created: { icon: '🏆', label: 'Tournament' },
  tournament_joined:  { icon: '✅', label: 'Joined' },
  elo_milestone:      { icon: '⬆️', label: 'Milestone' },
  new_member:         { icon: '👋', label: 'New' },
}

function formatText(item) {
  const d = item.data || {}
  switch (item.type) {
    case 'match_recorded': {
      const sign = d.elo_change >= 0 ? '+' : ''
      return (
        <>
          <strong>{d.winner_name}</strong> beat <strong>{d.loser_name}</strong>
          {d.score ? ` · ${d.score}` : ''}
          {d.elo_change != null ? <span className="elo-pill">ELO {sign}{d.elo_change}</span> : null}
        </>
      )
    }
    case 'tournament_created':
      return <><strong>{d.creator_name}</strong> created <strong>{d.tournament_name}</strong> ({d.tournament_type})</>
    case 'tournament_joined':
      return <><strong>{d.player_name}</strong> joined <strong>{d.tournament_name}</strong></>
    case 'elo_milestone':
      return <><strong>{d.player_name}</strong> reached <strong>{d.new_tier}</strong> tier! {d.emoji}</>
    case 'new_member':
      return <><strong>{d.player_name}</strong> joined the app</>
    default:
      return JSON.stringify(d)
  }
}

const DEFAULT_VISIBLE = 3

export default function ActivityFeed() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState(false)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30)
      setActivities(data || [])
      setLoading(false)
    }
    fetch()

    const channel = supabase
      .channel('activity_feed_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed' },
        payload => setActivities(prev => [payload.new, ...prev].slice(0, 30))
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="activity-feed">
      <div className="feed-header">
        <h3>Activity</h3>
        <span className="feed-live">● Live</span>
      </div>

      {loading && <div className="loading-wrap"><div className="spinner" /></div>}

      {!loading && activities.length === 0 && (
        <div className="feed-empty">No activity yet — record a match to get started!</div>
      )}

      <div className="feed-list">
        {(expanded ? activities : activities.slice(0, DEFAULT_VISIBLE)).map((item, i) => {
          const meta = TYPE_META[item.type] || { icon: '📌' }
          return (
            <div key={item.id} className="feed-item" style={{ animationDelay: `${i * 0.03}s` }}>
              <span className="feed-icon">{meta.icon}</span>
              <div className="feed-body">
                <p className="feed-text">{formatText(item)}</p>
                <span className="feed-time">{timeAgo(item.created_at)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {activities.length > DEFAULT_VISIBLE && (
        <button className="feed-toggle-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less ↑' : `View ${activities.length - DEFAULT_VISIBLE} more ↓`}
        </button>
      )}
    </div>
  )
}
