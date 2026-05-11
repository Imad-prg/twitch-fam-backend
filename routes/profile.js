const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/auth');

const profiles = {};

router.get('/', isAuth, (req, res) => {
  const userId = req.user?.id;
  res.json({ success: true, profile: profiles[userId] || {} });
});

router.post('/save', isAuth, (req, res) => {
  const userId = req.user?.id;
  profiles[userId] = { ...profiles[userId], ...req.body };
  res.json({ success: true });
});

router.post('/attach-twitch', isAuth, (req, res) => {
  const userId = req.user?.id;
  const { url } = req.body;
  if (!url || !url.includes('twitch.tv')) {
    return res.json({ success: false, error: 'Invalid Twitch URL' });
  }
  if (!profiles[userId]) profiles[userId] = {};
  profiles[userId].twitchUrl = url;
  profiles[userId].twitchAttached = true;
  res.json({ success: true, url });
});

router.post('/gemini-key', isAuth, (req, res) => {
  const userId = req.user?.id;
  const { key } = req.body;
  if (!profiles[userId]) profiles[userId] = {};
  profiles[userId].geminiKey = key;
  res.json({ success: true });
});

router.delete('/gemini-key', isAuth, (req, res) => {
  const userId = req.user?.id;
  if (profiles[userId]) delete profiles[userId].geminiKey;
  res.json({ success: true });
});

module.exports = router;
