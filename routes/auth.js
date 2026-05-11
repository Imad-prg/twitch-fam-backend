// backend/routes/auth.js
const express = require('express');
const passport = require('passport');
const router = express.Router();
const crypto = require('crypto');

const tokenStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tokenStore.entries()) {
    if (now > v.expires) tokenStore.delete(k);
  }
}, 10 * 60 * 1000);

router.get('/discord', passport.authenticate('discord'));

router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/auth/failed' }),
  (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');
    tokenStore.set(token, {
      user: req.user,
      expires: Date.now() + 10 * 60 * 1000
    });
    // Send HTML directly — token in URL via JS after page loads
    res.send(`<!DOCTYPE html>
<html>
<head><title>TWITCH FAM</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:linear-gradient(180deg,#050816,#140224);height:100vh;
display:flex;justify-content:center;align-items:center;font-family:Arial;color:white;}
.box{width:320px;padding:36px;border-radius:20px;
background:rgba(15,23,42,0.95);border:1px solid rgba(124,58,237,0.5);text-align:center;}
.logo{font-size:28px;font-weight:900;margin-bottom:16px;
background:linear-gradient(90deg,#9146FF,#00d4c8);
-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.check{font-size:48px;margin:16px 0;}
.title{font-size:20px;font-weight:800;margin-bottom:8px;}
.desc{font-size:13px;color:#94a3b8;}
.bar{width:100%;height:4px;background:#1e293b;border-radius:2px;margin-top:20px;overflow:hidden;}
.fill{height:100%;background:linear-gradient(90deg,#9146FF,#00d4c8);animation:load 2s forwards;}
@keyframes load{from{width:0}to{width:100%}}
</style></head>
<body>
<div class="box">
<div class="logo">TWITCH FAM</div>
<div class="check">✅</div>
<div class="title">Discord Verified</div>
<div class="desc">Access granted. Returning to extension...</div>
<div class="bar"><div class="fill"></div></div>
</div>
<script>
const token = '${token}';
// Put token in URL so chrome.tabs can read it
history.replaceState(null, '', '/auth/callback-success?token=' + token);
</script>
</body></html>`);
  }
);

router.get('/verify-token', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.json({ success: false, error: 'No token' });
  const entry = tokenStore.get(token);
  if (!entry) return res.json({ success: false, error: 'Invalid token' });
  if (Date.now() > entry.expires) {
    tokenStore.delete(token);
    return res.json({ success: false, error: 'Expired' });
  }
  req.session.user = entry.user;
  req.session.save();
  tokenStore.delete(token);
  return res.json({
    success: true,
    user: {
      id: entry.user.id,
      username: entry.user.username,
      global_name: entry.user.global_name,
      avatar: entry.user.avatar,
      points: entry.user.points || 0
    }
  });
});

router.get('/session', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const user = req.isAuthenticated() ? req.user : (req.session?.user || null);
  if (user) {
    return res.json({ success: true, user: { id: user.id, username: user.username, global_name: user.global_name, avatar: user.avatar, points: user.points || 0 } });
  }
  return res.json({ success: false, user: null });
});

router.get('/logout', (req, res) => {
  req.logout(() => { req.session.destroy(); res.json({ logout: true }); });
});

router.get('/failed', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>TWITCH FAM</title></head>
<body style="background:#050816;color:white;display:flex;justify-content:center;align-items:center;height:100vh;font-family:Arial">
<div style="padding:40px;border:1px solid #ef4444;border-radius:16px;background:#0d0f1e;text-align:center">
<h2 style="color:#ef4444">⛔ Access Denied</h2>
<p style="color:#94a3b8;margin-top:10px">You need the <strong style="color:#9146FF">whitelisted</strong> role.</p>
</div></body></html>`);
});

module.exports = router;
