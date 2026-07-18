const API_KEY = process.env.REACT_APP_GEMINI_KEY
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`

export async function getCoachingAdvice(entries) {
  if (!entries || entries.length === 0) throw new Error('No journal entries to analyse.')

  const formatted = entries.slice(0, 20).map((e, i) =>
    `Match ${i + 1} — ${e.match_date} vs ${e.opponent_name} (${e.result}${e.score ? `, ${e.score}` : ''})
Notes: ${e.notes || 'No notes recorded.'}`
  ).join('\n\n')

  const prompt = `You are a personal tennis coach. Here are your player's recent match journal entries:\n\n${formatted}\n\nBased on these entries, provide concise coaching advice covering:
1. **Patterns you notice** (tactical, mental, or physical trends)
2. **Key strengths** to keep building on
3. **Top 3 things to focus on** in the next match (be specific and actionable)
4. **One mental cue** to remember on court

Keep your response friendly, direct, and under 250 words. Address the player directly as "you".`

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${res.status}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No advice returned.'
}
