const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/auth');

let _getQueueStats = null;
try { _getQueueStats = require('../queue/queueManager').getQueueStats; } catch(e) {}

router.get('/', isAuth, (req, res) => {
  try {
    const qs = _getQueueStats ? _getQueueStats() : {};
    res.json({
      success: true,
      liveStreamers: qs.liveStreamers || 0,
      queuedTabs: qs.queued || 0,
      openJobs: qs.opened || 0,
      total: qs.total || 0,
      queued: qs.queued || 0
    });
  } catch (e) {
    res.json({ success: true, liveStreamers: 0, queuedTabs: 0, openJobs: 0, total: 0, queued: 0 });
  }
});

module.exports = router;
