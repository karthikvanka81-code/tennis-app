import './Tournament.css'

export default function TournamentRules() {
  return (
    <div className="tournament-container">
      <div className="tournament-header">
        <h2>Tournament Rules</h2>
      </div>

      <div className="rules-grid">
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
            <p>A vs B, A vs C, B vs C — 3 matches total. Player with highest cumulative set-win points wins the tournament.</p>
          </div>
        </div>

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
            <p>Winners advance automatically to the next round slot. Once a match is recorded, the bracket updates in real-time.</p>
          </div>
        </div>

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
      </div>
    </div>
  )
}
