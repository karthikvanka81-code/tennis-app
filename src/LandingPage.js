import { useState, useEffect, useRef } from 'react'
import './Landing.css'

const W = 1000
const H = 420
const GROUND = 340

const CITIES = [
  { id: 'melbourne', name: 'Melbourne',  slam: 'Australian Open', x: 80,  color: '#00A8E8' },
  { id: 'paris',     name: 'Paris',      slam: 'Roland Garros',   x: 290, color: '#E8442A' },
  { id: 'london',    name: 'London',     slam: 'Wimbledon',       x: 500, color: '#4AE3B5' },
  { id: 'newyork',   name: 'New York',   slam: 'US Open',         x: 720, color: '#5B9BD5' },
  { id: 'amsterdam', name: 'Amsterdam',  slam: '🏠 Home',          x: 920, color: '#FFD700' },
]

// Cubic bezier: arc from city A to city B with peak height h
function arcPoint(t, x0, x1, h) {
  const x = x0 + (x1 - x0) * t
  // Quadratic parabola: y = ground - h * 4t(1-t)
  const y = GROUND - h * 4 * t * (1 - t)
  return { x, y }
}

const ARCS = [
  { from: 0, to: 1, height: 220 },
  { from: 1, to: 2, height: 170 },
  { from: 2, to: 3, height: 250 },
  { from: 3, to: 4, height: 200 },
]

const SEGMENT_DURATION = 1400 // ms per arc
const PAUSE_AT_CITY    = 420  // ms pause when ball lands

export default function LandingPage({ onEnter }) {
  const [phase, setPhase]         = useState('animating') // 'animating' | 'done'
  const [visitedIdx, setVisitedIdx] = useState(0)          // which cities are lit
  const [ballPos, setBallPos]     = useState({ x: CITIES[0].x, y: GROUND })
  const [currentArc, setCurrentArc] = useState(0)
  const [arcT, setArcT]           = useState(0)
  const rafRef  = useRef(null)
  const stateRef = useRef({ arc: 0, t: 0, phase: 'pause', pauseStart: null })

  useEffect(() => {
    let startTime = null

    function tick(now) {
      const s = stateRef.current

      if (s.phase === 'pause') {
        if (!s.pauseStart) s.pauseStart = now
        if (now - s.pauseStart < PAUSE_AT_CITY) {
          rafRef.current = requestAnimationFrame(tick)
          return
        }
        // move to next arc
        if (s.arc >= ARCS.length) {
          setPhase('done')
          return
        }
        s.phase = 'flying'
        s.pauseStart = null
        startTime = now
      }

      if (s.phase === 'flying') {
        if (!startTime) startTime = now
        const elapsed = now - startTime
        const t = Math.min(elapsed / SEGMENT_DURATION, 1)
        const arc = ARCS[s.arc]
        const city0 = CITIES[arc.from]
        const city1 = CITIES[arc.to]
        const pos = arcPoint(t, city0.x, city1.x, arc.height)

        setBallPos(pos)
        setCurrentArc(s.arc)
        setArcT(t)

        if (t >= 1) {
          // Landed
          setVisitedIdx(arc.to)
          s.arc += 1
          s.phase = 'pause'
          s.pauseStart = null
          startTime = null
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const isDone = phase === 'done'

  return (
    <div className="landing-root">
      {/* Subtle grid overlay */}
      <div className="landing-grid" />

      <div className="landing-inner">
        {/* Logo */}
        <div className={`landing-logo ${isDone ? 'logo-big' : ''}`}>
          <span className="landing-ace">Ace</span>
          {isDone && <p className="landing-tagline">Your tennis season. Tracked.</p>}
        </div>

        {/* Animation stage */}
        <div className={`landing-stage ${isDone ? 'stage-fade' : ''}`}>
          <svg viewBox={`0 0 ${W} ${H}`} className="landing-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="ballGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#cdf520" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#cdf520" stopOpacity="0" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="cityGlow">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Ground line */}
            <line x1="40" y1={GROUND + 2} x2={W - 40} y2={GROUND + 2}
              stroke="#1E3352" strokeWidth="1" />

            {/* Arc trails (already-flown paths) */}
            {ARCS.slice(0, currentArc).map((arc, i) => (
              <path key={i}
                d={`M ${CITIES[arc.from].x} ${GROUND} Q ${(CITIES[arc.from].x + CITIES[arc.to].x) / 2} ${GROUND - arc.height * 1.2} ${CITIES[arc.to].x} ${GROUND}`}
                fill="none"
                stroke="rgba(205,245,32,0.15)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            ))}

            {/* Current arc progress trail */}
            {phase === 'animating' && currentArc < ARCS.length && arcT > 0 && (() => {
              const arc = ARCS[currentArc]
              const pts = []
              const steps = 30
              for (let i = 0; i <= Math.floor(arcT * steps); i++) {
                const t = i / steps
                const p = arcPoint(t, CITIES[arc.from].x, CITIES[arc.to].x, arc.height)
                pts.push(`${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
              }
              return (
                <path d={pts.join(' ')} fill="none"
                  stroke="rgba(205,245,32,0.35)" strokeWidth="1.5" strokeDasharray="4 4" />
              )
            })()}

            {/* City markers */}
            {CITIES.map((city, i) => {
              const visited = i <= visitedIdx
              const isHome  = i === 4
              return (
                <g key={city.id}>
                  {/* Glow ring when visited */}
                  {visited && (
                    <circle cx={city.x} cy={GROUND} r={isHome ? 22 : 14}
                      fill="none" stroke={city.color} strokeWidth="1"
                      opacity="0.3" filter="url(#cityGlow)"
                    />
                  )}
                  {/* Ground dot */}
                  <circle cx={city.x} cy={GROUND + 2} r={visited ? 6 : 4}
                    fill={visited ? city.color : '#1E3352'}
                    stroke={visited ? city.color : '#2A4A6E'}
                    strokeWidth="1.5"
                    style={{ transition: 'all 0.3s ease' }}
                    filter={visited ? 'url(#cityGlow)' : undefined}
                  />
                  {/* Vertical stem */}
                  <line x1={city.x} y1={GROUND + 2} x2={city.x} y2={GROUND + 18}
                    stroke={visited ? city.color : '#1E3352'} strokeWidth="1"
                    style={{ transition: 'stroke 0.3s ease' }}
                  />
                  {/* Slam label */}
                  <text x={city.x} y={GROUND + 34}
                    textAnchor="middle" fontSize="9"
                    fill={visited ? city.color : '#2A4A6E'}
                    fontWeight={visited ? '700' : '400'}
                    letterSpacing="0.5"
                    style={{ transition: 'fill 0.3s ease', textTransform: 'uppercase', fontFamily: 'system-ui' }}
                  >
                    {city.slam}
                  </text>
                  {/* City name */}
                  <text x={city.x} y={GROUND + 46}
                    textAnchor="middle" fontSize="8"
                    fill={visited ? 'rgba(255,255,255,0.5)' : '#1E3352'}
                    style={{ transition: 'fill 0.3s ease', fontFamily: 'system-ui' }}
                  >
                    {city.name}
                  </text>
                </g>
              )
            })}

            {/* Tennis ball */}
            {phase === 'animating' && (
              <g>
                {/* Glow */}
                <circle cx={ballPos.x} cy={ballPos.y} r={22}
                  fill="url(#ballGlow)" opacity="0.8" />
                {/* Ball body */}
                <circle cx={ballPos.x} cy={ballPos.y} r={11}
                  fill="#cdf520" filter="url(#glow)" />
                {/* Seam lines */}
                <path d={`M ${ballPos.x - 6} ${ballPos.y - 4} Q ${ballPos.x} ${ballPos.y + 7} ${ballPos.x + 6} ${ballPos.y - 4}`}
                  fill="none" stroke="#9fd000" strokeWidth="1.8" />
                <path d={`M ${ballPos.x - 6} ${ballPos.y + 4} Q ${ballPos.x} ${ballPos.y - 7} ${ballPos.x + 6} ${ballPos.y + 4}`}
                  fill="none" stroke="#9fd000" strokeWidth="1.8" />
                {/* Shadow */}
                <ellipse cx={ballPos.x} cy={GROUND + 4}
                  rx={Math.max(4, 14 * (1 - (GROUND - ballPos.y) / 260))}
                  ry={Math.max(1, 3 * (1 - (GROUND - ballPos.y) / 260))}
                  fill="rgba(0,0,0,0.4)"
                />
              </g>
            )}

            {/* Amsterdam: static ball after done */}
            {isDone && (
              <g>
                <circle cx={CITIES[4].x} cy={GROUND - 11} r={22}
                  fill="url(#ballGlow)" opacity="0.9" />
                <circle cx={CITIES[4].x} cy={GROUND - 11} r={11}
                  fill="#cdf520" filter="url(#glow)" />
                <path d={`M ${CITIES[4].x - 6} ${GROUND - 15} Q ${CITIES[4].x} ${GROUND - 4} ${CITIES[4].x + 6} ${GROUND - 15}`}
                  fill="none" stroke="#9fd000" strokeWidth="1.8" />
                <path d={`M ${CITIES[4].x - 6} ${GROUND - 7} Q ${CITIES[4].x} ${GROUND - 18} ${CITIES[4].x + 6} ${GROUND - 7}`}
                  fill="none" stroke="#9fd000" strokeWidth="1.8" />
              </g>
            )}
          </svg>
        </div>

        {/* CTA — shown after animation completes */}
        {isDone && (
          <div className="landing-cta">
            <button className="landing-btn-primary" onClick={() => onEnter('signin')}>
              Sign In
            </button>
            <button className="landing-btn-secondary" onClick={() => onEnter('signup')}>
              Create Account
            </button>
          </div>
        )}

        {/* Skip during animation */}
        {!isDone && (
          <button className="landing-skip" onClick={() => { setPhase('done'); setVisitedIdx(4) }}>
            Skip →
          </button>
        )}
      </div>
    </div>
  )
}
