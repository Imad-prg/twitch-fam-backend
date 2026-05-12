// routes/profile.js
const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/auth');
const mongoose = require('mongoose');

// Simple schema for profiles
const ProfileSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  twitchUsername: { type: String, default: '' },
  twitchUrl: { type: String, default: '' },
  twitchAttached: { type: Boolean, default: false },
  geminiKey: { type: String, default: '' },
  displayName: { type: String, default: '' },
  chatSpeed: { type: String, default: 'slow' },
  minSec: { type: Number, default: 20 },
  maxSec: { type: Number, default: 70 },
  moodTags: { type: [String], default: ['casual'] },
  gameTags: { type: [String], default: [] },
  langTags: { type: [String], default: ['English'] },
  chatType: { type: String, default: 'text_emojis' },
  emojiMode: { type: String, default: 'both' },
  updatedAt: { type: Date, default: Date.now }
});

const Profile = mongoose.models.Profile || mongoose.model('Profile', ProfileSchema);

const getUserId = (req) => req.user?.id || req.session?.user?.id;

router.get('/', isAuth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ discordId: getUserId(req) });
    res.json({ success: true, profile: profile || {} });
  } catch(e) {
    res.json({ success: true, profile: {} });
  }
});

router.post('/save', async (req, res) => {
  try {
    const userId = getUserId(req) || req.body.discordId;
    if (!userId) return res.json({ success: false, error: 'Not authenticated' });
    const data = { ...req.body, updatedAt: new Date() };

    // Extract twitch username from URL
    if (data.twitchUrl) {
      data.twitchUsername = data.twitchUrl
        .replace('https://www.twitch.tv/', '')
        .replace('https://twitch.tv/', '')
        .replace('http://twitch.tv/', '')
        .trim().toLowerCase();
    }

    await Profile.findOneAndUpdate(
      { discordId: userId },
      { $set: data },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch(e) {
    console.log('Profile save error:', e.message);
    res.json({ success: false, error: e.message });
  }
});

router.post('/attach-twitch', async (req, res) => {
  try {
    // Accept discordId from body as fallback when session fails
    const userId = getUserId(req) || req.body.discordId;
    const { url } = req.body;
    if (!userId) return res.json({ success: false, error: 'Not authenticated' });
    if (!url) return res.json({ success: false, error: 'No URL' });

    const username = url
      .replace('https://www.twitch.tv/', '')
      .replace('https://twitch.tv/', '')
      .replace('http://twitch.tv/', '')
      .trim().toLowerCase();

    if (!username) return res.json({ success: false, error: 'Invalid URL' });

    await Profile.findOneAndUpdate(
      { discordId: userId },
      { $set: { twitchUrl: url, twitchUsername: username, twitchAttached: true, updatedAt: new Date() } },
      { upsert: true, new: true }
    );

    console.log(`[TF] Twitch attached: ${username} for ${userId}`);
    res.json({ success: true, url, username });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

router.post('/gemini-key', async (req, res) => {
  try {
    const { key } = req.body;
    await Profile.findOneAndUpdate(
      { discordId: getUserId(req) },
      { $set: { geminiKey: key, updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false });
  }
});

router.delete('/gemini-key', isAuth, async (req, res) => {
  try {
    await Profile.findOneAndUpdate(
      { discordId: getUserId(req) },
      { $set: { geminiKey: '', updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false });
  }
});

// Get all registered streamers from MongoDB — persists across restarts
router.get('/registered-streamers', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  try {
    const profiles = await Profile.find({ twitchAttached: true, twitchUsername: { $ne: '' } });
    const streamers = profiles.map(p => p.twitchUsername).filter(Boolean);
    res.json({ success: true, streamers, count: streamers.length });
  } catch(e) {
    res.json({ success: true, streamers: [], count: 0 });
  }
});

module.exports = router;
module.exports.Profile = Profile;