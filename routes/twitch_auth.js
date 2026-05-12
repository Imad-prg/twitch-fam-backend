// routes/twitch_auth.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_CALLBACK_URL = process.env.TWITCH_CALLBACK_URL;

// Store tokens per user (use MongoDB in production)
const twitchTokens = new Map();

/* STEP 1 — Redirect to Twitch OAuth */
router.get('/connect', (req, res) => {
  if (!req.session?.user) return res.json({ success: false, error: 'Not logged in' });

  const scopes = 'chat:read chat:edit channel:read:stream_key user:read:email';
  const url = `https://id.twitch.tv/oauth2/authorize?client_id=${TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(TWITCH_CALLBACK_URL)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${req.session.user.id}`;
  res.redirect(url);
});

/* STEP 2 — Handle callback */
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect('/auth/failed');

  try {
    // Exchange code for token
    const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: TWITCH_CALLBACK_URL
      }
    });

    const { access_token, refresh_token } = tokenRes.data;

    // Get Twitch user info
    const userRes = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Client-Id': TWITCH_CLIENT_ID
      }
    });

    const twitchUser = userRes.data.data[0];

    // Store token linked to Discord user ID (state)
    twitchTokens.set(state, {
      access_token,
      refresh_token,
      twitch_id: twitchUser.id,
      twitch_login: twitchUser.login,
      twitch_display: twitchUser.display_name
    });

    res.send(`<!DOCTYPE html>
<html><head><title>TWITCH FAM</title></head>
<body style="background:#050816;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:Arial">
<div style="text-align:center;padding:40px;border:1px solid #9146FF;border-radius:16px;background:#0d0f1e">
<h2 style="color:#9146FF">✅ Twitch Connected</h2>
<p style="color:#94a3b8;margin-top:10px">@${twitchUser.login} linked successfully.</p>
<p style="color:#94a3b8;margin-top:6px">You can close this tab.</p>
</div>
</body></html>`);

  } catch(e) {
    console.error('Twitch callback error:', e.message);
    res.redirect('/auth/failed');
  }
});

/* GET Twitch token for user */
router.get('/token', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const userId = req.session?.user?.id || req.query.userId;
  if (!userId) return res.json({ success: false, error: 'No user' });

  const token = twitchTokens.get(userId);
  if (!token) return res.json({ success: false, error: 'No Twitch token' });

  return res.json({ success: true, ...token });
});

/* GET Live Streamers using Twitch Helix API */
router.get('/live', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');

  // Get app access token
  try {
    const appTokenRes = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`);
    const appToken = appTokenRes.data.access_token;

    // Get all connected users' streamers
    const allStreamers = [];

    // For each connected user, check if they're live
    for (const [userId, tokenData] of twitchTokens.entries()) {
      try {
        const streamRes = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${tokenData.twitch_login}`, {
          headers: {
            'Authorization': `Bearer ${appToken}`,
            'Client-Id': TWITCH_CLIENT_ID
          }
        });

        if (streamRes.data.data.length > 0) {
          const stream = streamRes.data.data[0];
          allStreamers.push({
            username: tokenData.twitch_login,
            title: stream.title,
            game: stream.game_name,
            viewers: stream.viewer_count,
            thumbnail: stream.thumbnail_url.replace('{width}', '80').replace('{height}', '80')
          });
        }
      } catch(e) {}
    }

    res.json({ success: true, count: allStreamers.length, streamers: allStreamers });

  } catch(e) {
    res.json({ success: false, error: e.message, streamers: [] });
  }
});

module.exports = router;
module.exports.twitchTokens = twitchTokens;
