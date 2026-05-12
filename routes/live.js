// routes/live.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const isAuth = require('../middleware/auth');

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let appAccessToken = null;
let tokenExpiry = 0;

async function getAppToken() {
  if (appAccessToken && Date.now() < tokenExpiry) return appAccessToken;
  try {
    const r = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`);
    appAccessToken = r.data.access_token;
    tokenExpiry = Date.now() + (r.data.expires_in - 60) * 1000;
    return appAccessToken;
  } catch(e) {
    console.log('Twitch token error:', e.message);
    return null;
  }
}

// Cache streamers
let cachedStreamers = [];
let lastFetch = 0;

router.get('/streamers', isAuth, async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

  // Return cache if less than 2 minutes old
  if (cachedStreamers.length && Date.now() - lastFetch < 120000) {
    return res.json({ success: true, count: cachedStreamers.length, streamers: cachedStreamers });
  }

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    // No Twitch API — return mock
    return res.json({ success: true, count: 0, streamers: [], message: 'Configure TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET' });
  }

  try {
    const token = await getAppToken();
    if (!token) throw new Error('No app token');

    // Get top live streams
    const r = await axios.get('https://api.twitch.tv/helix/streams?first=50', {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
    });

    cachedStreamers = r.data.data.map(s => ({
      username: s.user_login,
      displayName: s.user_name,
      title: s.title,
      game: s.game_name,
      viewers: s.viewer_count,
      thumbnail: s.thumbnail_url.replace('{width}', '80').replace('{height}', '80'),
      language: s.language
    }));

    lastFetch = Date.now();
    res.json({ success: true, count: cachedStreamers.length, streamers: cachedStreamers });

  } catch(e) {
    console.log('Live fetch error:', e.message);
    res.json({ success: true, count: cachedStreamers.length, streamers: cachedStreamers });
  }
});

// Check if specific streamers are live
router.post('/check', isAuth, async (req, res) => {
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
