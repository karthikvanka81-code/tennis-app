import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import './NotificationBell.css'

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NotificationBell({ currentUser }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen]                   = useState(false)
  const ref                               = useRef(null)

  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!currentUser) return
    fetchNotifications()

    const channel = supabase
      .channel('notifications_live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`,
      }, payload => {
        setNotifications(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUser]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  const handleOpen = async () => {
    setOpen(v => !v)
    if (!open && unread > 0) {
      await supabase.from('notifications')
        .update({ read: true })
        .eq('user_id', currentUser.id)
        .eq('read', false)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button className="notif-bell-btn" onClick={handleOpen} aria-label="Notifications">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button className="notif-clear-btn" onClick={async () => {
                await supabase.from('notifications').delete().eq('user_id', currentUser.id)
                setNotifications([])
              }}>Clear all</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="notif-empty">No notifications yet</div>
          ) : (
            <div className="notif-list">
              {notifications.map(n => (
                <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                  <span className="notif-icon">💬</span>
                  <div className="notif-body">
                    <p className="notif-text">
                      <strong>{n.from_name || 'Someone'}</strong> mentioned you: "{n.comment_text}"
                    </p>
                    <span className="notif-time">{timeAgo(n.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
