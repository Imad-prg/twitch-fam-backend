// backend/ai/gemini.js — now using Groq instead of Gemini

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

async function groqRequest(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const r = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.9
    })
  });

  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.choices?.[0]?.message?.content?.trim() || null;
}

async function getAIMessage(prompt) {
  return await groqRequest(prompt);
}

async function generateSafeChatMessage(streamer, messages = []) {
  const prompt = `You are a Twitch viewer watching ${streamer}'s stream.
Write ONE short natural Twitch chat message. Max 8 words. No spam.
Sometimes use emotes (Kappa, PogChamp, LUL, OMEGALUL).
Reply with ONLY the message, nothing else.`;
  return await groqRequest(prompt);
}

async function generateQueueMessage(streamer) {
  const prompt = `Write one short hype Twitch chat message for ${streamer}'s stream. Max 6 words. Use emotes.`;
  return await groqRequest(prompt);
}

module.exports = { getAIMessage, generateSafeChatMessage, generateQueueMessage };