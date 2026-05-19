import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { checkAndActivateTournament } from './MatchGeneration'
import './Tournament.css'

export default function TournamentInvitations({ user, onCountChange }) {
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)

  const fetchInvitations = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('tournament_invitations')
        .select('*, tournaments(id, name, tournament_type, admin_id, max_players)')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (err) { setError(err.message); setLoading(false); return }

      const invites = data || []
      setInvitations(invites)
      onCountChange?.(invites.length)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }, [user.id, onCountChange])

  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  const handleAccept = async (invitation) => {
    setActioningId(invitation.id)
    try {
      await supabase
        .from('tournament_participants')
        .update({ confirmed: true })
        .eq('tournament_id', invitation.tournament_id)
        .eq('user_id', user.id)

      await supabase
        .from('tournament_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id)

      const activated = await checkAndActivateTournament(invitation.tournament_id)

      setInvitations(prev => prev.filter(i => i.id !== invitation.id))
      onCountChange?.(invitations.length - 1)

      if (activated) {
        alert(`All players confirmed! The tournament "${invitation.tournaments.name}" is now active and matches have been generated.`)
      }
    } catch (err) {
      setError(err.message)
    }
    setActioningId(null)
  }

  const handleDecline = async (invitation) => {
    setActioningId(invitation.id)
    try {
      await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', invitation.tournament_id)
        .eq('user_id', user.id)

      await supabase
        .from('tournament_invitations')
        .update({ status: 'declined' })
        .eq('id', invitation.id)

      setInvitations(prev => prev.filter(i => i.id !== invitation.id))
      onCountChange?.(invitations.length - 1)
    } catch (err) {
      setError(err.message)
    }
    setActioningId(null)
  }

  const typeLabel = (type) => {
    const map = { 'one-to-one': 'One-to-One', 'round-robin': 'Round Robin', 'knockout': 'Knockout' }
    return map[type] || type
  }

  if (loading) return <div className="tournament-container"><p>Loading invitations...</p></div>

  return (
    <div className="tournament-container">
      <div className="tournament-header">
        <h2>Invitations</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {invitations.length === 0 ? (
        <div className="no-invitations">
          <p>No pending invitations</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>When someone invites you to a tournament, it will appear here.</p>
        </div>
      ) : (
        <div className="invitations-list">
          {invitations.map(inv => (
            <div key={inv.id} className="invitation-card">
              <div className="invitation-info">
                <h3 className="invitation-title">{inv.tournaments?.name}</h3>
                <div className="invitation-meta">
                  <span className="tournament-type-chip">{typeLabel(inv.tournaments?.tournament_type)}</span>
                  <span className="invitation-players">{inv.tournaments?.max_players} players</span>
                </div>
                <p className="invitation-date">
                  Invited {new Date(inv.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="invitation-actions">
                <button
                  className="accept-btn"
                  onClick={() => handleAccept(inv)}
                  disabled={actioningId === inv.id}
                >
                  {actioningId === inv.id ? '...' : 'Accept'}
                </button>
                <button
                  className="decline-btn"
                  onClick={() => handleDecline(inv)}
                  disabled={actioningId === inv.id}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
