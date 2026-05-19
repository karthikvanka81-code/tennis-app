import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Tournament.css'

const TYPES = [
  {
    value: 'one-to-one',
    label: 'One-to-One',
    description: '2 players, 1 match, best of 3 sets',
    playerNote: 'Select exactly 1 opponent',
  },
  {
    value: 'round-robin',
    label: 'Round Robin',
    description: 'All players face each other once',
    playerNote: 'Select 2+ opponents (3+ total)',
  },
  {
    value: 'knockout',
    label: 'Knockout',
    description: 'Single elimination bracket',
    playerNote: 'Total players must be 2, 4, 8, or 16',
  },
]

const KNOCKOUT_SIZES = [2, 4, 8, 16]

export default function CreateTournament({ user }) {
  const [allUsers, setAllUsers] = useState([])
  const [name, setName] = useState('')
  const [type, setType] = useState('one-to-one')
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [createdTournament, setCreatedTournament] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = async () => {
    const { data, error: err } = await supabase
      .from('users')
      .select('id, name, email')
      .neq('id', user.id)
      .order('name')
    if (!err) setAllUsers(data || [])
    setLoading(false)
  }

  const totalPlayers = selectedPlayers.length + 1

  const validate = () => {
    if (!name.trim()) return 'Please enter a tournament name'
    if (type === 'one-to-one' && totalPlayers !== 2) return 'One-to-One requires exactly 1 opponent'
    if (type === 'round-robin' && totalPlayers < 3) return 'Round Robin requires at least 2 opponents (3+ total)'
    if (type === 'knockout' && !KNOCKOUT_SIZES.includes(totalPlayers))
      return `Knockout requires 2, 4, 8, or 16 total players (currently ${totalPlayers})`
    return null
  }

  const togglePlayer = (id) => {
    setSelectedPlayers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleTypeChange = (newType) => {
    setType(newType)
    setSelectedPlayers([])
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSubmitting(true)
    try {
      const { data: tournament, error: createError } = await supabase
        .from('tournaments')
        .insert([{
          admin_id: user.id,
          name: name.trim(),
          tournament_type: type,
          max_players: totalPlayers,
          status: 'setup',
        }])
        .select()
        .single()

      if (createError) { setError(createError.message); setSubmitting(false); return }

      const tid = tournament.id

      await supabase.from('tournament_participants').insert([{
        tournament_id: tid,
        user_id: user.id,
        wins: 0,
        losses: 0,
        points: 0,
        confirmed: true,
      }])

      for (const playerId of selectedPlayers) {
        await supabase.from('tournament_participants').insert([{
          tournament_id: tid,
          user_id: playerId,
          wins: 0,
          losses: 0,
          points: 0,
          confirmed: false,
        }])
        await supabase.from('tournament_invitations').insert([{
          tournament_id: tid,
          user_id: playerId,
          status: 'pending',
        }])
      }

      setCreatedTournament({ ...tournament, inviteCount: selectedPlayers.length })
      setSuccess(`"${name}" created! Invitations sent to ${selectedPlayers.length} player(s).`)
      setName('')
      setSelectedPlayers([])
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  if (loading) return <div className="tournament-container"><p>Loading...</p></div>

  return (
    <div className="tournament-container">
      <div className="tournament-header">
        <h2>Create Tournament</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {success && (
        <div className="success-message" style={{ marginBottom: 24 }}>
          {success}
          {createdTournament && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Status: <strong>Waiting for {createdTournament.inviteCount} player(s) to accept</strong>. Matches will be generated automatically once everyone confirms.
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="create-form-section">
          <label className="create-form-label">Tournament Name</label>
          <input
            type="text"
            className="create-form-input"
            placeholder="e.g. Summer Championship 2026"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="create-form-section">
          <label className="create-form-label">Tournament Type</label>
          <div className="type-cards">
            {TYPES.map(t => (
              <div
                key={t.value}
                className={`type-card ${type === t.value ? 'selected' : ''}`}
                onClick={() => handleTypeChange(t.value)}
              >
                <div className="type-card-header">
                  <div className={`type-radio ${type === t.value ? 'checked' : ''}`} />
                  <span className="type-card-label">{t.label}</span>
                </div>
                <p className="type-card-desc">{t.description}</p>
                <p className="type-card-note">{t.playerNote}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="create-form-section">
          <label className="create-form-label">
            Select Opponents
            <span className="player-count-badge">{totalPlayers} total player{totalPlayers !== 1 ? 's' : ''}</span>
          </label>
          <div className="player-checklist">
            <div className="player-check-item creator-item">
              <span className="player-check-name">{user.email?.split('@')[0]} (you)</span>
              <span className="confirmed-chip">Creator</span>
            </div>
            {allUsers.map(u => (
              <div
                key={u.id}
                className={`player-check-item ${selectedPlayers.includes(u.id) ? 'selected' : ''}`}
                onClick={() => togglePlayer(u.id)}
              >
                <div className={`player-checkbox ${selectedPlayers.includes(u.id) ? 'checked' : ''}`}>
                  {selectedPlayers.includes(u.id) && '✓'}
                </div>
                <span className="player-check-name">{u.name || u.email}</span>
              </div>
            ))}
          </div>
          {type === 'knockout' && (
            <p className="hint">
              Need: {KNOCKOUT_SIZES.map(s => `${s}`).join(', ')} players total.
              Currently: {totalPlayers}.
            </p>
          )}
        </div>

        <button
          type="submit"
          className="record-btn"
          disabled={submitting}
          style={{ maxWidth: 280 }}
        >
          {submitting ? 'Creating...' : 'Create & Send Invitations'}
        </button>
      </form>
    </div>
  )
}
