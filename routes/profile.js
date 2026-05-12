// routes/profile.js
const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/auth');

// Store profiles in memory (MongoDB model exists but keeping simple)
const profiles = {};

// Store all registered Twitch usernames
const registeredStreamers = new Map(); // twitchUsername -> userId

router.get('/', isAuth, (req, res) => {
  const userId = req.user?.id || req.session?.user?.id;
  res.json({ success: true, profile: profiles[userId] || {} });
});

router.post('/save', isAuth, (req, res) => {
  const userId = req.user?.id || req.session?.user?.id;
  profiles[userId] = { ...profiles[userId], ...req.body };

  // Register twitch username if provided
  if (req.body.twitchUrl) {
    const username = req.body.twitchUrl.replace('https://twitch.tv/', '').replace('https://www.twitch.tv/', '').trim().toLowerCase();
    if (username) {
      registeredStreamers.set(username, userId);
      profiles[userId].twitchUsername = username;
    }
  }

  res.json({ success: true });
});

router.post('/attach-twitch', isAuth, (req, res) => {
  const userId = req.user?.id || req.session?.user?.id;
  const { url } = req.body;
  if (!url) return res.json({ success: false, error: 'No URL' });

  const username = url.replace('https://twitch.tv/', '').replace('https://www.twitch.tv/', '').replace('http://twitch.tv/', '').trim().toLowerCase();
  if (!username) return res.json({ success: false, error: 'Invalid URL' });

  if (!profiles[userId]) profiles[userId] = {};
  profiles[userId].twitchUrl = url;
  profiles[userId].twitchUsername = username;
  profiles[userId].twitchAttached = true;

  // Register globally
  registeredStreamers.set(username, userId);

  console.log(`[TF] Twitch attached: ${username} for user ${userId}`);
  console.log(`[TF] Total registered streamers: ${registeredStreamers.size}`);

  res.json({ success: true, url, username });
});

router.post('/gemini-key', isAuth, (req, res) => {
  const userId = req.user?.id || req.session?.user?.id;
  const { key } = req.body;
  if (!profiles[userId]) profiles[userId] = {};
  profiles[userId].geminiKey = key;
  res.json({ success: true });
});

router.delete('/gemini-key', isAuth, (req, res) => {
  const userId = req.user?.id || req.session?.user?.id;
  if (profiles[userId]) delete profiles[userId].geminiKey;
  res.json({ success: true });
});

// Get all registered streamers (public — extension calls this)
router.get('/registered-streamers', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const list = Array.from(registeredStreamers.keys());
  res.json({ success: true, streamers: list, count: list.size });
});

module.exports = router;
module.exports.registeredStreamers = registeredStreamers;
module.exports.profiles = profiles;