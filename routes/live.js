// routes/live.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || 'ceuwi31nmv1wjaqowzh9mflduyj1xl';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '5z3apxnwxehnaho0eqq3d8gsp5kn5q';

let appAccessToken = null;
let tokenExpiry = 0;

async function getAppToken() {
  if (appAccessToken && Date.now() < tokenExpiry) return appAccessToken;
  try {
    const r = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: { client_id: TWITCH_CLIENT_ID, client_secret: TWITCH_CLIENT_SECRET, grant_type: 'client_credentials' }
    });
    appAccessToken = r.data.access_token;
    tokenExpiry = Date.now() + (r.data.expires_in - 60) * 1000;
    return appAccessToken;
  } catch(e) {
    console.log('Twitch token error:', e.message);
    return null;
  }
}

// Returns ALL registered streamers — live ones first, offline ones after
router.get('/streamers', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

  try {
    const { Profile } = require('./profile');
    const profiles = await Profile.find({ twitchAttached: true, twitchUsername: { $ne: '' } });
    const registeredUsernames = profiles.map(p => p.twitchUsername).filter(Boolean);

    if (registeredUsernames.length === 0) {
      return res.json({ success: true, count: 0, streamers: [] });
    }

    // Build profile map
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.twitchUsername] = p; });

    let liveStreamers = [];
    let token = null;

    // Check which ones are live
    try {
      token = await getAppToken();
      if (token) {
        const query = registeredUsernames.map(u => `user_login=${u}`).join('&');
        const r = await axios.get(`https://api.twitch.tv/helix/streams?${query}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
        });
        liveStreamers = r.data.data.map(s => s.user_login);
      }
    } catch(e) {}

    // Build full list: live first, then offline
    const streamers = registeredUsernames.map(username => {
      const p = profileMap[username] || {};
      const isLive = liveStreamers.includes(username);
      return {
        username,
        displayName: username,
        isLive,
        isRegistered: true,
        game: isLive ? (liveStreamers.find ? '' : '') : '',
        viewers: 0,
        thumbnail: '',
        chatConfig: {
          moodTags: p.moodTags || ['casual'],
          gameTags: p.gameTags || [],
          langTags: p.langTags || ['English'],
          minSeconds: p.minSec || 20,
          maxSeconds: p.maxSec || 70,
          displayName: p.displayName || '',
          chatType: p.chatType || 'text_emojis'
        }
      };
    });

    // Get viewer counts for live streamers
    if (token && liveStreamers.length > 0) {
      try {
        const query = liveStreamers.map(u => `user_login=${u}`).join('&');
        const r = await axios.get(`https://api.twitch.tv/helix/streams?${query}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID }
        });
        r.data.data.forEach(stream => {
          const s = streamers.find(x => x.username === stream.user_login);
          if (s) {
            s.game = stream.game_name;
            s.viewers = stream.viewer_count;
            s.title = stream.title;
            s.thumbnail = stream.thumbnail_url.replace('{width}', '80').replace('{height}', '80');
          }
        });
      } catch(e) {}
    }

    // Sort: live first
    streamers.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));

    res.json({ success: true, count: streamers.length, streamers });
  } catch(e) {
    console.log('Live fetch error:', e.message);
    res.json({ success: false, error: e.message, streamers: [] });
  }
});

module.exports = router;