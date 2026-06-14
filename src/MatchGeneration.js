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
  const totalRounds = Math.ceil(Math.log2(n))
  const matches = []

  // Round 1: pair up players, byes for odd player out
  for (let i = 0; i < n - 1; i += 2) {
    matches.push({
      tournament_id: tournamentId,
      player1_id: shuffled[i],
      player2_id: shuffled[i + 1],
      match_status: 'pending',
      round: 1,
      match_order: Math.floor(i / 2),
    })
  }

  // Placeholder matches for future rounds
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = Math.ceil(n / Math.pow(2, round))
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

  const slotField = currentMatchOrder % 2 === 0 ? 'player1_id' : 'player2_id'
  await supabase
    .from('matches')
    .update({ [slotField]: winnerId })
    .eq('id', nextMatch.id)
}

// Returns { success: bool, error: string | null }
export async function checkAndActivateTournament(tournamentId) {
  const { data: participants, error: partError } = await supabase
    .from('tournament_participants')
    .select('user_id, confirmed')
    .eq('tournament_id', tournamentId)

  if (partError) return { success: false, error: `Could not read participants: ${partError.message}` }
  if (!participants || participants.length === 0) return { success: false, error: 'No participants found.' }

  const unconfirmed = participants.filter(p => !p.confirmed)
  if (unconfirmed.length > 0) return { success: false, error: `${unconfirmed.length} player(s) haven't confirmed yet.` }

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('tournament_type, max_players, status')
    .eq('id', tournamentId)
    .single()

  if (tErr || !tournament) return { success: false, error: 'Could not load tournament.' }
  if (tournament.status === 'active') return { success: true, error: null }

  // Check if matches already exist (avoid duplicates on double-click)
  const { data: existing } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
    .limit(1)
  if (existing && existing.length > 0) {
    // Matches exist but status not active — just flip status
    await supabase.from('tournaments').update({ status: 'active' }).eq('id', tournamentId)
    return { success: true, error: null }
  }

  const playerIds = participants.map(p => p.user_id)
  let genError = null

  if (tournament.tournament_type === 'one-to-one') {
    if (playerIds.length < 2) return { success: false, error: 'Need at least 2 players for a one-to-one match.' }
    const result = await generateOneToOneMatches(tournamentId, playerIds[0], playerIds[1])
    genError = result.error
  } else if (tournament.tournament_type === 'round-robin') {
    if (playerIds.length < 2) return { success: false, error: 'Need at least 2 players for round-robin.' }
    const result = await generateRoundRobinMatches(tournamentId, playerIds)
    genError = result.error
  } else if (tournament.tournament_type === 'knockout') {
    if (playerIds.length < 2) return { success: false, error: 'Need at least 2 players for knockout.' }
    const result = await generateKnockoutMatches(tournamentId, playerIds)
    genError = result.error
  } else {
    return { success: false, error: `Unknown tournament type: ${tournament.tournament_type}` }
  }

  if (genError) return { success: false, error: `Match generation failed: ${genError.message}` }

  const { error: statusErr } = await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', tournamentId)

  if (statusErr) return { success: false, error: `Matches created but couldn't set status to active: ${statusErr.message}` }

  return { success: true, error: null }
}
