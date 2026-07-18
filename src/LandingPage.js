import { useState, useEffect, useRef } from 'react'
import './Landing.css'

const CX = 160  // center x
const BALL_R = 12

const CITIES = [
  { name: 'Melbourne', slam: 'Australian Open', y: 80,  color: '#00A8E8' },
  { name: 'Paris',     slam: 'Roland Garros',   y: 200, color: '#E8442A' },
  { name: 'London',    slam: 'Wimbledon',        y: 320, color: '#4AE3B5' },
  { name: 'New York',  slam: 'US Open',          y: 440, color: '#5B9BD5' },
  { name: 'Amsterdam', slam: '🏠 Home',           y: 560, color: '#FFD700' },
]

const SVG_W = 320
const SVG_H = 640

const FALL_DURATION  = 700   // ms to fall to next city
const BOUNCE_HEIGHT  = 28    // px bounce up after landing
const BOUNCE_DURATION = 250  // ms for bounce
const PAUSE_DURATION  = 380  // ms pause at city

// Bounce ease: starts fast, decelerates
function easeFall(t) {
  return 1 - Math.pow(1 - t, 2.2)
}

export default function LandingPage({ onEnter }) {
  const [ballY, setBallY]         = useState(CITIES[0].y - 180)
  const [ballX, setBallX]         = useState(CX)
  const [visitedIdx, setVisitedIdx] = useState(-1)
  const [phase, setPhase]         = useState('animating')
  const rafRef   = useRef(null)
  const stateRef = useRef({ step: 'fall-to-first', cityIdx: 0, startTime: null, startY: CITIES[0].y - 180 })

  useEffect(() => {
    function tick(now) {
      const s = stateRef.current
      if (!s.startTime) s.startTime = now
      const elapsed = now - s.startTime

      if (s.step === 'fall-to-first') {
        // Initial drop to city 0
        const t = Math.min(elapsed / FALL_DURATION, 1)
        const y = s.startY + (CITIES[0].y - s.startY) * easeFall(t)
        setBallY(y)
        if (t >= 1) {
          setVisitedIdx(0)
          s.step = 'pause'
          s.startTime = null
        }
      } else if (s.step === 'pause') {
        if (elapsed >= PAUSE_DURATION) {
          const nextIdx = s.cityIdx + 1
          if (nextIdx >= CITIES.length) {
            setPhase('done')
            return
          }
          s.cityIdx   = nextIdx
          s.step      = 'bounce-up'
          s.startTime = null
          s.fromY     = CITIES[nextIdx - 1].y
          s.toY       = CITIES[nextIdx].y
        }
      } else if (s.step === 'bounce-up') {
        // slight bounce up before falling to next
        const t = Math.min(elapsed / BOUNCE_DURATION, 1)
        const y = s.fromY - BOUNCE_HEIGHT * Math.sin(t * Math.PI)
        setBallY(y)
        if (t >= 1) {
          s.step      = 'fall'
          s.startTime = null
          s.fallStartY = s.fromY
        }
      } else if (s.step === 'fall') {
        const t = Math.min(elapsed / FALL_DURATION, 1)
        const y = s.fallStartY + (s.toY - s.fallStartY) * easeFall(t)
        // slight lateral wobble as it falls
        const wobble = Math.sin(t * Math.PI * 2) * 6
        setBallY(y)
        setBallX(CX + wobble)
        if (t >= 1) {
          setBallX(CX)
          setVisitedIdx(s.cityIdx)
          s.step      = 'pause'
          s.startTime = null
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
      <div className="landing-grid" />

      <div className="landing-inner-v">
        {/* Logo */}
        <div className={`landing-logo ${isDone ? 'logo-big' : ''}`}>
          <span className="landing-ace">Ace</span>
          {isDone && <p className="landing-tagline">Your tennis season. Tracked.</p>}
        </div>

        {/* Vertical animation */}
        <div className={`landing-stage-v ${isDone ? 'stage-fade' : ''}`}>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="landing-svg-v" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="ballGlowV" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#cdf520" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#cdf520" stopOpacity="0" />
              </radialGradient>
              <filter id="glowV">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="cityGlowV">
                <feGaussianBlur stdDeviation="6" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Vertical track line */}
            <line x1={CX} y1={CITIES[0].y} x2={CX} y2={CITIES[CITIES.length-1].y}
              stroke="#1E3352" strokeWidth="1.5" strokeDasharray="4 4" />

            {/* Visited trail */}
            {visitedIdx >= 0 && (
              <line x1={CX} y1={CITIES[0].y}
                x2={CX} y2={CITIES[Math.min(visitedIdx, CITIES.length-1)].y}
                stroke="rgba(205,245,32,0.25)" strokeWidth="2" />
            )}

            {/* City nodes */}
            {CITIES.map((city, i) => {
              const visited = i <= visitedIdx
              const isHome  = i === CITIES.length - 1
              return (
                <g key={city.name}>
                  {/* Glow ring */}
                  {visited && (
                    <circle cx={CX} cy={city.y} r={isHome ? 28 : 20}
                      fill="none" stroke={city.color} strokeWidth="1"
                      opacity="0.3" filter="url(#cityGlowV)" />
                  )}

                  {/* Node dot */}
                  <circle cx={CX} cy={city.y} r={visited ? 7 : 5}
                    fill={visited ? city.color : '#0E1B2E'}
                    stroke={visited ? city.color : '#2A4A6E'}
                    strokeWidth="2"
                    filter={visited ? 'url(#cityGlowV)' : undefined}
                    style={{ transition: 'all 0.35s ease' }}
                  />

                  {/* Slam name — right side */}
                  <text x={CX + 20} y={city.y - 5}
                    fontSize="11" fontWeight="700" letterSpacing="0.4"
                    fill={visited ? city.color : '#2A4A6E'}
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{ transition: 'fill 0.35s ease' }}
                  >
                    {city.slam}
                  </text>
                  {/* City name — right side */}
                  <text x={CX + 20} y={city.y + 10}
                    fontSize="9"
                    fill={visited ? 'rgba(255,255,255,0.5)' : '#1E3352'}
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{ transition: 'fill 0.35s ease' }}
                  >
                    {city.name}
                  </text>
                </g>
              )
            })}

            {/* Ball */}
            {!isDone && (
              <g>
                <circle cx={ballX} cy={ballY} r={28}
                  fill="url(#ballGlowV)" opacity="0.7" />
                <circle cx={ballX} cy={ballY} r={BALL_R}
                  fill="#cdf520" filter="url(#glowV)" />
                {/* Seams */}
                <path d={`M ${ballX-7} ${ballY-4} Q ${ballX} ${ballY+7} ${ballX+7} ${ballY-4}`}
                  fill="none" stroke="#9fd000" strokeWidth="2" />
                <path d={`M ${ballX-7} ${ballY+4} Q ${ballX} ${ballY-7} ${ballX+7} ${ballY+4}`}
                  fill="none" stroke="#9fd000" strokeWidth="2" />
                {/* Shadow on track */}
                <ellipse cx={CX} cy={CITIES[Math.max(0, stateRef.current.cityIdx)].y + 2}
                  rx="10" ry="3" fill="rgba(0,0,0,0.3)"
                  opacity={Math.max(0, 1 - Math.abs(ballY - CITIES[Math.max(0, stateRef.current.cityIdx)].y) / 60)}
                />
              </g>
            )}

            {/* Static ball at Amsterdam when done */}
            {isDone && (
              <g>
                <circle cx={CX} cy={CITIES[4].y - BALL_R - 2} r={28}
                  fill="url(#ballGlowV)" opacity="0.9" />
                <circle cx={CX} cy={CITIES[4].y - BALL_R - 2} r={BALL_R}
                  fill="#cdf520" filter="url(#glowV)" />
                <path d={`M ${CX-7} ${CITIES[4].y-BALL_R-6} Q ${CX} ${CITIES[4].y-BALL_R+5} ${CX+7} ${CITIES[4].y-BALL_R-6}`}
                  fill="none" stroke="#9fd000" strokeWidth="2" />
                <path d={`M ${CX-7} ${CITIES[4].y-BALL_R+2} Q ${CX} ${CITIES[4].y-BALL_R-9} ${CX+7} ${CITIES[4].y-BALL_R+2}`}
                  fill="none" stroke="#9fd000" strokeWidth="2" />
              </g>
            )}
          </svg>
        </div>

        {/* CTA */}
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

        {!isDone && (
          <button className="landing-skip"
            onClick={() => { cancelAnimationFrame(rafRef.current); setVisitedIdx(4); setPhase('done') }}>
            Skip →
          </button>
        )}
      </div>
    </div>
  )
}
