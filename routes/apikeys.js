// routes/apikeys.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');

const ApiKeySchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  discordUsername: { type: String, default: '' },
  apiKey: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  lastUsed: { type: Date, default: null },
  active: { type: Boolean, default: true }
});

const ApiKey = mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);

function generateKey() {
  return 'tf_' + crypto.randomBytes(24).toString('base64url');
}

// Middleware to verify API key
async function verifyApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey || req.body?.apiKey;
  if (!key) return res.json({ success: false, error: 'Missing API key' });

  try {
    const record = await ApiKey.findOne({ apiKey: key, active: true });
    if (!record) return res.json({ success: false, error: 'Invalid API key' });
    
    // Update last used
    record.lastUsed = new Date();
    await record.save();
    
    req.apiUser = { discordId: record.discordId, discordUsername: record.discordUsername };
    next();
  } catch(e) {
    res.json({ success: false, error: 'Key verification failed' });
  }
}

// Validate key (public route — used by extension)
router.post('/validate', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { apiKey } = req.body;
  if (!apiKey) return res.json({ success: false, error: 'Missing key' });

  try {
    const record = await ApiKey.findOne({ apiKey, active: true });
    if (!record) return res.json({ success: false, valid: false });
    
    record.lastUsed = new Date();
    await record.save();
    
    res.json({ success: true, valid: true, discordId: record.discordId, discordUsername: record.discordUsername });
  } catch(e) {
    res.json({ success: false, valid: false });
  }
});

// Generate key for a user (admin only)
router.post('/generate', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false, error: 'Unauthorized' });
  const { discordId, discordUsername } = req.body;
  if (!discordId) return res.json({ success: false, error: 'Missing discordId' });

  try {
    const apiKey = generateKey();
    await ApiKey.findOneAndUpdate(
      { discordId },
      { $set: { apiKey, discordUsername: discordUsername || '', active: true, createdAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ success: true, apiKey });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// Revoke key (admin only)
router.post('/revoke', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false, error: 'Unauthorized' });
  const { discordId } = req.body;
  try {
    await ApiKey.findOneAndUpdate({ discordId }, { $set: { active: false } });
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// Get all keys (admin only)
router.get('/list', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false });
  try {
    const keys = await ApiKey.find().sort({ createdAt: -1 });
    res.json({ success: true, keys });
  } catch(e) {
    res.json({ success: false, keys: [] });
  }
});

module.exports = router;
module.exports.ApiKey = ApiKey;
module.exports.verifyApiKey = verifyApiKey;