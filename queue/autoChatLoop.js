// queue/autoChatLoop.js — Chat via tmi.js IRC (pas Puppeteer)

const twitchClient = require('../twitch/twitchClient');
const { sendMessage, joinChannel, leaveChannel } = require('../twitch/twitchClient');
const { getAIMessage } = require('../ai/geminiService');
const { Profile } = require('../routes/profile');

const activeLoops = new Map();

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function randomDelay(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function generateMessage(streamer, chatConfig = {}) {
  const mood  = (chatConfig.moodTags  || ['casual']).join(', ');
  const langs = (chatConfig.langTags  || ['English']).join(', ');
  const games = (chatConfig.gameTags  || []).join(', ');
  const name  =  chatConfig.displayName || 'viewer';

  const prompt = `You are "${name}", a Twitch viewer watching ${streamer}'s stream.
Write ONE short Twitch chat message. Max 8 words. Natural and human, not spam.
Mood: ${mood}. Language: ${langs}.${games ? ` Game: ${games}.` : ''}
Sometimes use Twitch emotes (Kappa, PogChamp, LUL, OMEGALUL, Pog, EZ, KEKW, POGGERS, BibleThump, NotLikeThis, PauseChamp, FailFish, EleGiggle, 4Head, ResidentSleeper, <3, DansGame, SwiftRage, Kreygasm, FrankerZ).
Reply with ONLY the message text, no quotes, nothing else.`;

  try {
    const msg = await getAIMessage(prompt);
    return msg ? msg.trim().replace(/^["']|["']$/g, '') : null;
  } catch(e) {
    console.log('[CHAT] AI error:', e.message);
    return null;
  }
}

async function startStreamerChatLoop(streamer, chatConfig = {}) {
  if (activeLoops.has(streamer)) return;
  activeLoops.set(streamer, true);
  console.log(`[CHAT] Loop started: ${streamer}`);

  try {
    await joinChannel(streamer);
    await wait(1000);

    while (activeLoops.has(streamer)) {
      const min = (chatConfig.minSeconds || 20) * 1000;
      const max = (chatConfig.maxSeconds || 70) * 1000;
      const delay = randomDelay(min, max);
      console.log(`[CHAT][${streamer}] Next message in ${Math.round(delay/1000)}s`);
      await wait(delay);
      if (!activeLoops.has(streamer)) break;
      const message = await generateMessage(streamer, chatConfig);
      if (!message) { console.log(`[CHAT][${streamer}] No message generated`); continue; }
      await sendMessage(streamer, message);
      console.log(`[CHAT][${streamer}] Sent: ${message}`);
    }
  } catch(err) {
    console.log(`[CHAT] Loop error ${streamer}:`, err.message);
  } finally {
    activeLoops.delete(streamer);
    try { await leaveChannel(streamer); } catch(e) {}
  }
}

function stopStreamerChatLoop(streamer) { activeLoops.delete(streamer); }

async function startAutoChatLoop() {
  console.log('[TWITCH FAM] AUTO CHAT LOOP STARTED');

  while (true) {
    try {
      const profiles = await Profile.find({ twitchAttached: true, twitchUsername: { $ne: '' } });

      for (const profile of profiles) {
        const streamer = profile.twitchUsername;
        if (!streamer) continue;
        if (activeLoops.has(streamer)) continue;

        const chatConfig = {
          moodTags:    profile.moodTags    || ['casual'],
          langTags:    profile.langTags    || ['English'],
          gameTags:    profile.gameTags    || [],
          minSeconds:  profile.minSec      || 20,
          maxSeconds:  profile.maxSec      || 70,
          displayName: profile.displayName || 'viewer',
          chatType:    profile.chatType    || 'text_emojis',
        };

        console.log(`[CHAT] Starting loop for ${streamer}`);
        startStreamerChatLoop(streamer, chatConfig).catch(e =>
          console.log(`[CHAT] Error ${streamer}:`, e.message)
        );
      }

      await wait(30000);

    } catch(err) {
      console.log('[CHAT] Auto loop error:', err.message);
      await wait(15000);
    }
  }
}

function getActiveLoops() { return Array.from(activeLoops.keys()); }

module.exports = { startAutoChatLoop, startStreamerChatLoop, stopStreamerChatLoop, getActiveLoops };