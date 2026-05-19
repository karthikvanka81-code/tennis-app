import './Tournament.css'

export default function TournamentRules() {
  return (
    <div className="tournament-container">
      <div className="tournament-header">
        <h2>Tournament Rules</h2>
      </div>

      <div className="rules-grid">
        {/* One-to-One */}
        <div className="rules-card">
          <div className="rules-card-header">
            <span className="rules-type-badge">One-to-One</span>
            <h3>Head-to-Head Match</h3>
          </div>
          <ul className="rules-list">
            <li>Exactly <strong>2 players</strong> compete</li>
            <li><strong>1 match</strong> total</li>
            <li>Best of <strong>3 sets</strong></li>
            <li>Winner: first player to win <strong>2 sets</strong></li>
            <li>Points: <strong>10 points per set won</strong></li>
          </ul>
          <div className="rules-example">
            <span className="rules-example-label">Example</span>
            <p>Player A wins sets 6-4, 3-6, 7-5 → Player A wins 2-1, earns 20 pts. Player B earns 10 pts.</p>
          </div>
        </div>

        {/* Round Robin */}
        <div className="rules-card">
          <div className="rules-card-header">
            <span className="rules-type-badge">Round Robin</span>
            <h3>All vs All</h3>
          </div>
          <ul className="rules-list">
            <li>Every player faces <strong>every other player once</strong></li>
            <li>Total matches = <strong>n × (n-1) / 2</strong></li>
            <li>4 players = 6 matches, 5 players = 10 matches</li>
            <li>Best of <strong>3 sets</strong> per match</li>
            <li>Points: <strong>10 points per set won</strong></li>
            <li>Winner: player with the <strong>most total points</strong></li>
          </ul>
          <div className="rules-example">
            <span className="rules-example-label">Example (3 players)</span>
            <p>A vs B, A vs C, B vs C — 3 matches total. Highest cumulative set-win points wins.</p>
          </div>
        </div>

        {/* Knockout */}
        <div className="rules-card">
          <div className="rules-card-header">
            <span className="rules-type-badge">Knockout</span>
            <h3>Single Elimination</h3>
          </div>
          <ul className="rules-list">
            <li>Must have <strong>2, 4, 8, or 16 players</strong></li>
            <li>Players are seeded randomly into a bracket</li>
            <li>Lose once → <strong>eliminated</strong></li>
            <li>Best of <strong>3 sets</strong> per match</li>
            <li>8 players: 4 R1 matches → 2 semis → 1 final</li>
            <li>Points: <strong>10 points per set won</strong> (for history)</li>
            <li>Winner: last player standing</li>
          </ul>
          <div className="rules-example">
            <span className="rules-example-label">Bracket progression</span>
            <p>Winners advance automatically. Bracket updates in real-time as scores are entered.</p>
          </div>
        </div>

        {/* General */}
        <div className="rules-card rules-card-wide">
          <div className="rules-card-header">
            <span className="rules-type-badge neutral">General Rules</span>
            <h3>How It Works</h3>
          </div>
          <div className="rules-general-grid">
            <div>
              <h4>Set Scoring</h4>
              <ul className="rules-list">
                <li>Enter scores for Set 1, Set 2, and (if needed) Set 3</li>
                <li>Set 3 is only played if each player won 1 set</li>
                <li>Winner determined by sets won (2 sets = win)</li>
              </ul>
            </div>
            <div>
              <h4>Tournament Flow</h4>
              <ul className="rules-list">
                <li>Creator sends invitations to all players</li>
                <li>Matches generate once everyone accepts</li>
                <li>Admin can remove players before tournament starts</li>
                <li>No changes after tournament becomes active</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ELO Rating */}
        <div className="rules-card rules-card-wide">
          <div className="rules-card-header">
            <span className="rules-type-badge" style={{ background: '#EDE9FE', color: '#7C3AED' }}>ELO System</span>
            <h3>ELO Rating — How Skill Is Ranked</h3>
          </div>
          <div className="rules-general-grid">
            <div>
              <h4>What is ELO?</h4>
              <ul className="rules-list">
                <li>Chess-based rating system adapted for tennis</li>
                <li>Every player starts at <strong>1200</strong></li>
                <li>Win → your rating goes up. Lose → it goes down</li>
                <li>Beating a higher-rated player earns <strong>more points</strong></li>
                <li>Losing to a weaker player costs <strong>more points</strong></li>
                <li>K-factor: <strong>32</strong> (standard competitive rating)</li>
              </ul>

              <h4 style={{ marginTop: 16 }}>Formula</h4>
              <div className="rules-example" style={{ marginTop: 8 }}>
                <span className="rules-example-label">Industry Standard (Chess ELO)</span>
                <p style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>
                  Expected = 1 / (1 + 10^((opp − you) / 400))<br />
                  New rating = Old + 32 × (Actual − Expected)<br />
                  Actual: Win = 1.0 · Loss = 0.0
                </p>
              </div>
            </div>
            <div>
              <h4>Rating Changes (approx.)</h4>
              <ul className="rules-list">
                <li>Beat stronger player: <strong style={{ color: '#FB9D6B' }}>+20 to +30 pts</strong></li>
                <li>Beat weaker player: <strong style={{ color: '#FB9D6B' }}>+5 to +15 pts</strong></li>
                <li>Lose to stronger player: <strong style={{ color: '#ef4444' }}>−5 to −15 pts</strong></li>
                <li>Lose to weaker player: <strong style={{ color: '#ef4444' }}>−15 to −30 pts</strong></li>
              </ul>

              <h4 style={{ marginTop: 16 }}>Rating Badges</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {[
                  { emoji: '🥉', label: 'Bronze',   range: '< 1000',    color: '#92400E', bg: '#FEF3C7' },
                  { emoji: '🥈', label: 'Silver',   range: '1000–1200', color: '#6B7280', bg: '#F3F4F6' },
                  { emoji: '🥇', label: 'Gold',     range: '1200–1400', color: '#D97706', bg: '#FEF9C3' },
                  { emoji: '💎', label: 'Platinum', range: '1400–1600', color: '#2563EB', bg: '#DBEAFE' },
                  { emoji: '💠', label: 'Diamond',  range: '> 1600',    color: '#7C3AED', bg: '#EDE9FE' },
                ].map(t => (
                  <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      className="elo-badge-sm"
                      style={{ background: t.bg, color: t.color, minWidth: 90 }}
                    >
                      {t.emoji} {t.label}
                    </span>
                    <span style={{ fontSize: 13, color: '#555' }}>{t.range} ELO</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
