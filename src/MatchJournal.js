import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import ConfirmDialog from './ConfirmDialog'
import { friendlyError } from './errorMessages'
import './MatchJournal.css'

const EMPTY_FORM = { opponentName: '', result: 'Win', score: '', notes: '', matchDate: new Date().toISOString().split('T')[0] }

export default function MatchJournal({ user }) {
  const [entries, setEntries]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [submitting, setSubmitting]     = useState(false)
  const [message, setMessage]           = useState({ text: '', type: '' })
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [editingId, setEditingId]       = useState(null)
  const [expandedId, setExpandedId]     = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedOpponent, setSelectedOpponent] = useState(null)
  const [showSuggestions, setShowSuggestions]   = useState(false)

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('match_journal')
      .select('*')
      .eq('user_id', user.id)
      .order('match_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (!error) setEntries(data || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const flash = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 3500)
  }

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    const payload = {
      user_id: user.id,
      opponent_name: form.opponentName.trim(),
      result: form.result,
      score: form.score.trim(),
      notes: form.notes.trim(),
      match_date: form.matchDate,
      updated_at: new Date().toISOString(),
    }

    let error
    if (editingId) {
      ;({ error } = await supabase.from('match_journal').update(payload).eq('id', editingId))
    } else {
      ;({ error } = await supabase.from('match_journal').insert([payload]))
    }

    if (error) {
      flash(friendlyError(error), 'error')
    } else {
      flash(editingId ? 'Match updated!' : 'Match recorded!')
      resetForm()
      await fetchEntries()
    }
    setSubmitting(false)
  }

  const handleEdit = (entry) => {
    setForm({
      opponentName: entry.opponent_name,
      result: entry.result,
      score: entry.score,
      notes: entry.notes || '',
      matchDate: entry.match_date,
    })
    setEditingId(entry.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async () => {
    const id = confirmDelete.id
    setConfirmDelete(null)
    const { error } = await supabase.from('match_journal').delete().eq('id', id)
    if (error) { flash(friendlyError(error), 'error'); return }
    flash('Match entry deleted.')
    setEntries(prev => prev.filter(e => e.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  // ── Search / filter logic ──────────────────────────────────────────────────

  const opponentCounts = entries.reduce((acc, e) => {
    const key = e.opponent_name.toLowerCase()
    if (!acc[key]) acc[key] = { name: e.opponent_name, count: 0 }
    acc[key].count++
    return acc
  }, {})

  const suggestions = searchQuery.trim().length > 0
    ? Object.values(opponentCounts).filter(o =>
        o.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const visibleEntries = selectedOpponent
    ? entries.filter(e => e.opponent_name.toLowerCase() === selectedOpponent.toLowerCase())
    : searchQuery.trim() && !showSuggestions
      ? entries.filter(e => e.opponent_name.toLowerCase().includes(searchQuery.toLowerCase()))
      : entries

  const opponentRecord = selectedOpponent
    ? visibleEntries.reduce((acc, e) => {
        if (e.result === 'Win') acc.wins++; else acc.losses++
        return acc
      }, { wins: 0, losses: 0 })
    : null

  const formatDate = (dateStr) =>
    new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="journal-container">
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete match entry?"
        message={confirmDelete ? `vs ${confirmDelete.opponent_name} · ${confirmDelete.result} · ${confirmDelete.score}` : ''}
        detail="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
      <div className="journal-header">
        <h2>{editingId ? 'Edit Match' : 'Match Journal'}</h2>
        {editingId && (
          <button className="cancel-edit-btn" onClick={resetForm}>Cancel Edit</button>
        )}
      </div>


      {message.text && (
        <div className={message.type === 'error' ? 'error-message' : 'success-message'}>
          {message.text}
        </div>
      )}

      {/* ── Add / Edit Form ── */}
      <div className="journal-form-card">
        <h3 className="form-card-title">{editingId ? 'Editing Entry' : 'Add New Match'}</h3>
        <form onSubmit={handleSubmit} className="journal-form">
          <div className="journal-form-row">
            <div className="journal-field">
              <label>Opponent Name *</label>
              <input
                type="text"
                placeholder="e.g. John Smith"
                value={form.opponentName}
                onChange={e => setForm(f => ({ ...f, opponentName: e.target.value }))}
                required
              />
            </div>
            <div className="journal-field">
              <label>Match Date *</label>
              <input
                type="date"
                value={form.matchDate}
                onChange={e => setForm(f => ({ ...f, matchDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="journal-form-row">
            <div className="journal-field">
              <label>Result *</label>
              <select
                value={form.result}
                onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
              >
                <option value="Win">Win</option>
                <option value="Loss">Loss</option>
              </select>
            </div>
            <div className="journal-field">
              <label>Score *</label>
              <input
                type="text"
                placeholder="e.g. 6-4, 7-5"
                value={form.score}
                onChange={e => setForm(f => ({ ...f, score: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="journal-field">
            <label>Notes <span className="optional-label">(optional)</span></label>
            <textarea
              placeholder="Observations, tactics, what worked, what to improve…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={4}
            />
          </div>

          <button type="submit" className="journal-submit-btn" disabled={submitting}>
            {submitting ? 'Saving…' : editingId ? 'Update Match' : 'Save Match'}
          </button>
        </form>
      </div>

      {/* ── Search ── */}
      <div className="journal-search-wrap">
        <div className="journal-search-field">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search opponent…"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSelectedOpponent(null); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {(searchQuery || selectedOpponent) && (
            <button
              className="search-clear"
              onClick={() => { setSearchQuery(''); setSelectedOpponent(null); setShowSuggestions(false) }}
            >✕</button>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="search-suggestions">
            {suggestions.map(s => (
              <button
                key={s.name}
                className="suggestion-item"
                onMouseDown={() => { setSelectedOpponent(s.name); setSearchQuery(s.name); setShowSuggestions(false) }}
              >
                <span className="suggestion-name">{s.name}</span>
                <span className="suggestion-count">{s.count} match{s.count !== 1 ? 'es' : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Opponent stats banner ── */}
      {selectedOpponent && opponentRecord && (
        <div className="opponent-stats-banner">
          <div className="opponent-stats-name">vs {selectedOpponent}</div>
          <div className="opponent-stats-record">
            <span className="opp-wins">{opponentRecord.wins}W</span>
            <span className="opp-divider">–</span>
            <span className="opp-losses">{opponentRecord.losses}L</span>
          </div>
          <div className="opponent-stats-sub">{visibleEntries.length} match{visibleEntries.length !== 1 ? 'es' : ''} recorded</div>
        </div>
      )}

      {/* ── Match list ── */}
      <div className="journal-section-header">
        <h3>
          {selectedOpponent ? `Matches vs ${selectedOpponent}` : 'Match History'}
          <span className="entry-count">{visibleEntries.length}</span>
        </h3>
      </div>

      {loading && (
        <div className="loading-wrap"><div className="spinner" /></div>
      )}

      {!loading && visibleEntries.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">😊</div>
          <p className="empty-title">No matches recorded yet</p>
          <p className="empty-desc">Add your first match using the form above!</p>
        </div>
      )}

      <div className="journal-entries">
        {visibleEntries.map(entry => (
          <div
            key={entry.id}
            className={`journal-entry ${expandedId === entry.id ? 'expanded' : ''} ${entry.result === 'Win' ? 'entry-win' : 'entry-loss'}`}
          >
            <div
              className="entry-summary"
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            >
              <div className="entry-left">
                <span className={`result-badge ${entry.result === 'Win' ? 'badge-win' : 'badge-loss'}`}>
                  {entry.result === 'Win' ? 'W' : 'L'}
                </span>
                <div className="entry-main">
                  <span className="entry-opponent">vs {entry.opponent_name}</span>
                  <span className="entry-score">{entry.score}</span>
                </div>
              </div>
              <div className="entry-right">
                <span className="entry-date">{formatDate(entry.match_date)}</span>
                {entry.notes && <span className="has-notes-dot" title="Has notes" />}
                <span className="expand-chevron">{expandedId === entry.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {expandedId === entry.id && (
              <div className="entry-detail">
                {entry.notes ? (
                  <div className="entry-notes">
                    <div className="notes-label">Notes</div>
                    <p>{entry.notes}</p>
                  </div>
                ) : (
                  <p className="no-notes">No notes for this match.</p>
                )}
                <div className="entry-actions">
                  <button className="edit-btn" onClick={() => handleEdit(entry)}>Edit</button>
                  <button className="delete-btn" onClick={() => setConfirmDelete(entry)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
