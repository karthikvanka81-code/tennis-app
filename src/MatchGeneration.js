import { supabase } from './supabaseClient'

export async function generateOneToOneMatches(tournamentId, player1Id, player2Id) {
  const { error } = await supabase.from('matches').insert([{
    tournament_id: tournamentId,
    player1_id: player1Id,
    player2_id: player2Id,
    match_status: 'pending',
    round: 1,
    match_order: 0,
  }])
  return { error }
}

export async function generateRoundRobinMatches(tournamentId, playerIds) {
  const matches = []
  let order = 0
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      matches.push({
        tournament_id: tournamentId,
        player1_id: playerIds[i],
        player2_id: playerIds[j],
        match_status: 'pending',
        round: 1,
        match_order: order++,
      })
    }
  }
  const { error } = await supabase.from('matches').insert(matches)
  return { error }
}

export async function generateKnockoutMatches(tournamentId, playerIds) {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
  const n = shuffled.length
  const totalRounds = Math.log2(n)
  const matches = []

  for (let i = 0; i < n; i += 2) {
    matches.push({
      tournament_id: tournamentId,
      player1_id: shuffled[i],
      player2_id: shuffled[i + 1],
      match_status: 'pending',
      round: 1,
      match_order: i / 2,
    })
  }

  // Placeholder matches for future rounds (players filled as winners advance)
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = n / Math.pow(2, round)
    for (let pos = 0; pos < matchesInRound; pos++) {
      matches.push({
        tournament_id: tournamentId,
        player1_id: null,
        player2_id: null,
        match_status: 'pending',
        round,
        match_order: pos,
      })
    }
  }

  const { error } = await supabase.from('matches').insert(matches)
  return { error }
}

// After a knockout match completes, slot the winner into the next round
export async function advanceKnockoutWinner(tournamentId, currentRound, currentMatchOrder, winnerId) {
  const nextRound = currentRound + 1
  const nextMatchOrder = Math.floor(currentMatchOrder / 2)

  const { data: nextMatch, error: fetchError } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('round', nextRound)
    .eq('match_order', nextMatchOrder)
    .single()

  if (fetchError || !nextMatch) return

  // Even match_order feeds into player1 slot, odd into player2 slot
  const slotField = currentMatchOrder % 2 === 0 ? 'player1_id' : 'player2_id'
  await supabase
    .from('matches')
    .update({ [slotField]: winnerId })
    .eq('id', nextMatch.id)
}

export async function checkAndActivateTournament(tournamentId) {
  const { data: participants, error } = await supabase
    .from('tournament_participants')
    .select('user_id, confirmed')
    .eq('tournament_id', tournamentId)

  if (error || !participants || participants.length === 0) return false

  const allConfirmed = participants.every(p => p.confirmed)
  if (!allConfirmed) return false

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('tournament_type')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return false

  const playerIds = participants.map(p => p.user_id)
  let genError = null

  if (tournament.tournament_type === 'one-to-one') {
    const result = await generateOneToOneMatches(tournamentId, playerIds[0], playerIds[1])
    genError = result.error
  } else if (tournament.tournament_type === 'round-robin') {
    const result = await generateRoundRobinMatches(tournamentId, playerIds)
    genError = result.error
  } else if (tournament.tournament_type === 'knockout') {
    const result = await generateKnockoutMatches(tournamentId, playerIds)
    genError = result.error
  }

  if (!genError) {
    await supabase
      .from('tournaments')
      .update({ status: 'active' })
      .eq('id', tournamentId)
    return true
  }
  return false
}
