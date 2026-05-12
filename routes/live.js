// routes/live.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'ceuwi31nmv1wjaqowzh9mflduyj1xl';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '5z3apxnwxehnaho0eqq3d8gsp5kn5q';

let appAccessToken = null;
let tokenExpiry = 0;
let cachedStreamers = [];
let lastFetch = 0;

async function getAppToken() {
  if (appAccessToken && Date.now() < tokenExpiry) return appAccessToken;
  try {
    const r = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    });
    appAccessToken = r.data.access_token;
    tokenExpiry = Date.now() + (r.data.expires_in - 60) * 1000;
    return appAccessToken;
  } catch(e) {
    console.log('Twitch token error:', e.message);
    return null;
  }
}

// Get streamers — registered members first, then top streams
router.get('/streamers', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

  if (cachedStreamers.length && Date.now() - lastFetch < 30000) {
    return res.json({ success: true, count: cachedStreamers.length, streamers: cachedStreamers });
  }

  try {
    const token = await getAppToken();
    if (!token) throw new Error('No app token');

    // Get registered streamers from profile module
    let registeredUsernames = [];
    let profileModule = null;
    try {
      profileModule = require('./profile');
      registeredUsernames = Array.from(profileModule.registeredStreamers?.keys() || []);
    } catch(e) {}

    let allStreamers = [];

    // ALWAYS check registered streamers directly — no viewer count limit
    if (registeredUsernames.length > 0) {
      const query = registeredUsernames.map(u => `user_login=${u}`).join('&');
      try {
        const regRes = await axios.get(`https://api.twitch.tv/helix/streams?${query}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
        });
        const liveRegistered = regRes.data.data.map(s => {
          // Get streamer's own chat config
          const streamerId = profileModule.registeredStreamers?.get(s.user_login);
          const streamerProfile = streamerId ? (profileModule.profiles?.[streamerId] || {}) : {};
          return {
            username: s.user_login,
            displayName: s.user_name,
            title: s.title,
            game: s.game_name,
            viewers: s.viewer_count,
            thumbnail: s.thumbnail_url.replace('{width}', '80').replace('{height}', '80'),
            language: s.language,
            isRegistered: true,
            // Streamer's chat config — viewers will use this
            chatConfig: {
              moodTags: streamerProfile.moodTags || ['casual'],
              gameTags: streamerProfile.gameTags || [s.game_name],
              langTags: streamerProfile.langTags || ['English'],
              chatSpeed: streamerProfile.chatSpeed || 'slow',
              minSeconds: streamerProfile.minSec || 20,
              maxSeconds: streamerProfile.maxSec || 70,
              displayName: streamerProfile.displayName || '',
              chatType: streamerProfile.chatType || 'text_emojis',
              emojiMode: streamerProfile.emojiMode || 'both'
            }
          };
        });
        allStreamers = [...liveRegistered];
        console.log(`[TF] ${liveRegistered.length}/${registeredUsernames.length} registered streamers are live`);
      } catch(e) {}
    }

    // Fill rest with top streams if less than 50
    if (allStreamers.length < 50) {
      const r = await axios.get(`https://api.twitch.tv/helix/streams?first=${50 - allStreamers.length}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
      });
      const topStreams = r.data.data
        .filter(s => !allStreamers.find(x => x.username === s.user_login))
        .map(s => ({
          username: s.user_login,
          displayName: s.user_name,
          title: s.title,
          game: s.game_name,
          viewers: s.viewer_count,
          thumbnail: s.thumbnail_url.replace('{width}', '80').replace('{height}', '80'),
          language: s.language,
          isRegistered: false
        }));
      allStreamers = [...allStreamers, ...topStreams];
    }

    cachedStreamers = allStreamers;
    lastFetch = Date.now();
    res.json({ success: true, count: cachedStreamers.length, streamers: cachedStreamers });

  } catch(e) {
    console.log('Live fetch error:', e.message);
    res.json({ success: true, count: cachedStreamers.length, streamers: cachedStreamers });
  }
});

// Check specific streamers
router.post('/check', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { usernames } = req.body;
  if (!usernames?.length) return res.json({ success: false, streamers: [] });
  try {
    const token = await getAppToken();
    const query = usernames.map(u => `user_login=${u}`).join('&');
    const r = await axios.get(`https://api.twitch.tv/helix/streams?${query}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
    });
    const live = r.data.data.map(s => ({
      username: s.user_login,
      title: s.title,
      game: s.game_name,
      viewers: s.viewer_count,
      thumbnail: s.thumbnail_url.replace('{width}', '80').replace('{height}', '80')
    }));
    res.json({ success: true, streamers: live });
  } catch(e) {
    res.json({ success: false, error: e.message, streamers: [] });
  }
});

module.exports = router;