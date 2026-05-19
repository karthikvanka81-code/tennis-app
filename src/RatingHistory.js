import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function RatingHistory({ userId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('elo_history')
      .select('rating, change, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(20)
      .then(({ data }) => {
        setHistory(data || [])
        setLoading(false)
      })
  }, [userId])

  if (loading) return <p style={{ color: '#A0754F', fontSize: 14 }}>Loading chart...</p>

  if (history.length < 2) return (
    <p style={{ color: '#A0754F', fontSize: 14, margin: 0 }}>
      Play at least 2 matches to see your rating history.
    </p>
  )

  const W = 520, H = 180, PX = 36, PY = 20
  const ratings = history.map(h => h.rating)
  const minR = Math.min(...ratings) - 30
  const maxR = Math.max(...ratings) + 30
  const range = maxR - minR || 1

  const cx = i => PX + (i / (history.length - 1)) * (W - PX * 2)
  const cy = r => PY + (1 - (r - minR) / range) * (H - PY * 2)

  const polyline = history.map((h, i) => `${cx(i)},${cy(h.rating)}`).join(' ')

  // Y-axis grid labels
  const gridSteps = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
        {/* Grid lines */}
        {gridSteps.map(t => {
          const yp = PY + t * (H - PY * 2)
          const rLabel = Math.round(maxR - t * range)
          return (
            <g key={t}>
              <line x1={PX} y1={yp} x2={W - PX} y2={yp}
                stroke="#E1D0B8" strokeWidth="1" strokeDasharray="4,3" />
              <text x={PX - 5} y={yp + 4} textAnchor="end" fontSize="9" fill="#A0754F">
                {rLabel}
              </text>
            </g>
          )
        })}

        {/* Gradient fill under line */}
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${cx(0)},${H - PY} ${polyline} ${cx(history.length - 1)},${H - PY}`}
          fill="url(#lineGrad)"
        />

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#F97316"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots */}
        {history.map((h, i) => (
          <circle
            key={i}
            cx={cx(i)}
            cy={cy(h.rating)}
            r="4.5"
            fill={h.change >= 0 ? '#FB9D6B' : '#ef4444'}
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>

      <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12, color: '#A0754F' }}>
        <span><span style={{ color: '#FB9D6B', fontWeight: 700 }}>●</span> Win</span>
        <span><span style={{ color: '#ef4444', fontWeight: 700 }}>●</span> Loss</span>
        <span style={{ marginLeft: 'auto' }}>
          {history[0]?.rating} → {history[history.length - 1]?.rating}
          {' '}
          <span style={{ color: history[history.length-1]?.rating >= history[0]?.rating ? '#FB9D6B' : '#ef4444', fontWeight: 700 }}>
            ({history[history.length-1]?.rating - history[0]?.rating >= 0 ? '+' : ''}
            {history[history.length-1]?.rating - history[0]?.rating})
          </span>
        </span>
      </div>
    </div>
  )
}
