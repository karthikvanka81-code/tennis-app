import { useState, useEffect, useCallback, useRef } from 'react'
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

function parseMentions(text, userMap) {
  const names = Object.values(userMap).map(u => u.name)
  const mentioned = []
  names.forEach(name => {
    if (text.toLowerCase().includes(`@${name.toLowerCase()}`)) mentioned.push(name)
  })
  return mentioned
}

function FeedItem({ item, currentUser, userMap }) {
  const [liked, setLiked]               = useState(false)
  const [likeCount, setLikeCount]       = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments]         = useState([])
  const [commentText, setCommentText]   = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const inputRef                      = useRef(null)

  useEffect(() => {
    const fetchReactions = async () => {
      const { data } = await supabase
        .from('activity_reactions')
        .select('user_id')
        .eq('activity_id', item.id)
      if (data) {
        setLikeCount(data.length)
        setLiked(data.some(r => r.user_id === currentUser?.id))
      }
    }
    fetchReactions()
  }, [item.id, currentUser?.id])

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('activity_comments')
      .select('*')
      .eq('activity_id', item.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }, [item.id])

  useEffect(() => {
    if (showComments) fetchComments()
  }, [showComments, fetchComments])

  const handleLike = async () => {
    if (!currentUser) return
    if (liked) {
      await supabase.from('activity_reactions')
        .delete()
        .eq('activity_id', item.id)
        .eq('user_id', currentUser.id)
      setLiked(false)
      setLikeCount(c => c - 1)
    } else {
      await supabase.from('activity_reactions')
        .insert([{ activity_id: item.id, user_id: currentUser.id }])
      setLiked(true)
      setLikeCount(c => c + 1)
    }
  }

  const handleCommentInput = (e) => {
    const val = e.target.value
    setCommentText(val)
    // detect @mention being typed
    const match = val.match(/@(\w[\w ]*)$/)
    if (match) {
      const query = match[1].toLowerCase()
      const allUsers = Object.values(userMap).filter(u => u.id !== currentUser?.id)
      setSuggestions(allUsers.filter(u => u.name.toLowerCase().startsWith(query)))
    } else {
      setSuggestions([])
    }
  }

  const handlePickSuggestion = (name) => {
    setCommentText(prev => prev.replace(/@[\w ]*/g, `@${name} `))
    setSuggestions([])
    inputRef.current?.focus()
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim() || !currentUser) return
    setSubmitting(true)
    const text = commentText.trim()

    await supabase.from('activity_comments').insert([{
      activity_id: item.id,
      user_id: currentUser.id,
      text,
    }])

    // Fire notifications for each @mention
    const mentioned = parseMentions(text, userMap)
    const senderName = userMap[currentUser.id]?.name || 'Someone'
    for (const name of mentioned) {
      const target = Object.values(userMap).find(u => u.name.toLowerCase() === name.toLowerCase())
      if (target && target.id !== currentUser.id) {
        await supabase.from('notifications').insert([{
          user_id: target.id,
          from_user_id: currentUser.id,
          from_name: senderName,
          type: 'mention',
          activity_id: item.id,
          comment_text: text.length > 80 ? text.slice(0, 80) + '…' : text,
        }])
      }
    }

    setCommentText('')
    setSuggestions([])
    fetchComments()
    setSubmitting(false)
  }

  const handleDeleteComment = async (commentId) => {
    await supabase.from('activity_comments').delete().eq('id', commentId)
    fetchComments()
  }

  const meta = TYPE_META[item.type] || { icon: '📌' }

  return (
    <div className="feed-item">
      <span className="feed-icon">{meta.icon}</span>
      <div className="feed-body">
        <p className="feed-text">{formatText(item)}</p>
        <span className="feed-time">{timeAgo(item.created_at)}</span>

        <div className="feed-actions">
          <button
            className={`feed-like-btn ${liked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            👍 {likeCount > 0 ? likeCount : ''}
          </button>
          <button
            className="feed-comment-btn"
            onClick={() => setShowComments(v => !v)}
          >
            💬 {comments.length > 0 ? comments.length : ''} {showComments ? 'Hide' : 'Comment'}
          </button>
        </div>

        {showComments && (
          <div className="feed-comments">
            {comments.map(c => (
              <div key={c.id} className="feed-comment">
                <span className="comment-author">{userMap[c.user_id]?.name || 'Player'}</span>
                <span className="comment-text">{c.text}</span>
                {(c.user_id === currentUser?.id) && (
                  <button className="comment-delete" onClick={() => handleDeleteComment(c.id)}>✕</button>
                )}
              </div>
            ))}
            <form className="comment-form" onSubmit={handleComment}>
              <div className="comment-input-wrap">
                <input
                  ref={inputRef}
                  className="comment-input"
                  placeholder="Add a comment… type @ to mention"
                  value={commentText}
                  onChange={handleCommentInput}
                  maxLength={200}
                />
                {suggestions.length > 0 && (
                  <div className="mention-suggestions">
                    {suggestions.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        className="mention-suggestion-item"
                        onClick={() => handlePickSuggestion(u.name)}
                      >
                        @{u.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="comment-submit" disabled={submitting || !commentText.trim()}>
                Post
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ActivityFeed({ currentUser }) {
  const [activities, setActivities] = useState([])
  const [userMap, setUserMap]       = useState({})
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: acts }, { data: users }] = await Promise.all([
        supabase.from('activity_feed').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('users').select('id, name'),
      ])
      setActivities(acts || [])
      const map = {}
      if (users) users.forEach(u => { map[u.id] = u })
      setUserMap(map)
      setLoading(false)
    }
    fetchData()

    const channel = supabase
      .channel('activity_feed_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_feed' },
        payload => setActivities(prev => [payload.new, ...prev].slice(0, 30))
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const visible = expanded ? activities : activities.slice(0, DEFAULT_VISIBLE)

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
        {visible.map((item, i) => (
          <FeedItem
            key={item.id}
            item={item}
            currentUser={currentUser}
            userMap={userMap}
          />
        ))}
      </div>

      {activities.length > DEFAULT_VISIBLE && (
        <button className="feed-toggle-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less ↑' : `View ${activities.length - DEFAULT_VISIBLE} more ↓`}
        </button>
      )}
    </div>
  )
}
