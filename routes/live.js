const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/auth');

let cachedStreamers = [];

router.get('/streamers', isAuth, async (req, res) => {
  const managerUrl = req.query.managerUrl || process.env.MANAGER_API_URL || '';

  if (managerUrl) {
    try {
      const nodeFetch = require('node-fetch');
      const fetch = nodeFetch.default || nodeFetch;
      const r = await fetch(`${managerUrl}/live/streamers`, { timeout: 5000 });
      const d = await r.json();
      if (d.streamers) {
        cachedStreamers = d.streamers;
        return res.json({ success: true, count: cachedStreamers.length, streamers: cachedStreamers });
      }
    } catch (e) {
      console.log('Manager fetch failed:', e.message);
    }
  }

  if (!cachedStreamers.length) {
    cachedStreamers = [
      {
        username: 'lordminugaming',
        title: 'Ranked Grind',
        game: 'Fortnite',
        viewers: 99,
        thumbnail: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?w=80&h=80&fit=crop'
      }
    ];
  }

  res.json({ success: true, count: cachedStreamers.length, streamers: cachedStreamers });
});

module.exports = router;
