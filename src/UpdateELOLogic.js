import { supabase } from './supabaseClient'

export function calculateExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
}

export function calculateNewELO(oldRating, expectedScore, actualScore, kFactor = 32) {
  return Math.round(oldRating + kFactor * (actualScore - expectedScore))
}

export function getELOBadge(rating) {
  if (rating < 1000) return { label: 'Bronze',   color: '#92400E', bg: '#FEF3C7', emoji: '🥉' }
  if (rating < 1200) return { label: 'Silver',   color: '#6B7280', bg: '#F3F4F6', emoji: '🥈' }
  if (rating < 1400) return { label: 'Gold',     color: '#D97706', bg: '#FEF9C3', emoji: '🥇' }
  if (rating < 1600) return { label: 'Platinum', color: '#2563EB', bg: '#DBEAFE', emoji: '💎' }
  return               { label: 'Diamond',  color: '#7C3AED', bg: '#EDE9FE', emoji: '💠' }
}

export async function updatePlayerELO(winnerId, loserId) {
  const { data: players, error } = await supabase
    .from('users')
    .select('id, elo_rating')
    .in('id', [winnerId, loserId])

  if (error || !players) return null

  const winner = players.find(p => p.id === winnerId)
  const loser  = players.find(p => p.id === loserId)

  const winnerRating = winner?.elo_rating ?? 1200
  const loserRating  = loser?.elo_rating  ?? 1200

  const winnerExpected = calculateExpectedScore(winnerRating, loserRating)
  const loserExpected  = calculateExpectedScore(loserRating,  winnerRating)

  const winnerNewRating = calculateNewELO(winnerRating, winnerExpected, 1.0)
  const loserNewRating  = calculateNewELO(loserRating,  loserExpected,  0.0)

  await Promise.all([
    supabase.from('users').update({ elo_rating: winnerNewRating }).eq('id', winnerId),
    supabase.from('users').update({ elo_rating: loserNewRating  }).eq('id', loserId),
  ])

  return {
    winnerOldRating: winnerRating,
    winnerNewRating,
    winnerChange: winnerNewRating - winnerRating,
    loserOldRating: loserRating,
    loserNewRating,
    loserChange: loserNewRating - loserRating,
  }
}

export async function recordELOHistory(userId, matchId, rating, change) {
  await supabase.from('elo_history').insert([{ user_id: userId, match_id: matchId, rating, change }])
}

// matchPlayer1Id/2Id are the match's player1_id/player2_id.
// p1Sets/p2Sets are sets WON by each respective player in this match.
export async function updateHeadToHeadStats(matchPlayer1Id, matchPlayer2Id, winnerId, p1Sets, p2Sets) {
  // Canonical ordering: lower UUID string is always player1 in H2H table
  const swap  = matchPlayer1Id > matchPlayer2Id
  const h2hP1 = swap ? matchPlayer2Id : matchPlayer1Id
  const h2hP2 = swap ? matchPlayer1Id : matchPlayer2Id
  const h2hP1Sets = swap ? p2Sets : p1Sets
  const h2hP2Sets = swap ? p1Sets : p2Sets
  const isWinner1 = winnerId === h2hP1

  const { data: existing } = await supabase
    .from('head_to_head_stats')
    .select('*')
    .eq('player1_id', h2hP1)
    .eq('player2_id', h2hP2)
    .maybeSingle()

  if (existing) {
    await supabase.from('head_to_head_stats').update({
      player1_wins:      existing.player1_wins      + (isWinner1 ? 1 : 0),
      player2_wins:      existing.player2_wins      + (isWinner1 ? 0 : 1),
      total_sets_player1: existing.total_sets_player1 + h2hP1Sets,
      total_sets_player2: existing.total_sets_player2 + h2hP2Sets,
      last_match_date:   new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await supabase.from('head_to_head_stats').insert([{
      player1_id:         h2hP1,
      player2_id:         h2hP2,
      player1_wins:       isWinner1 ? 1 : 0,
      player2_wins:       isWinner1 ? 0 : 1,
      total_sets_player1: h2hP1Sets,
      total_sets_player2: h2hP2Sets,
      last_match_date:    new Date().toISOString(),
    }])
  }
}
