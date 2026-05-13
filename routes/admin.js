// routes/admin.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const ADMIN_USER = 'hitman';
const ADMIN_PASS = 'TF@dm1n#2026!';

const PointsSchema = new mongoose.Schema({
  discordId: { type: String, required: true },
  discordUsername: { type: String, default: '' },
  twitchUsername: { type: String, default: '' },
  points: { type: Number, default: 0 },
  totalChats: { type: Number, default: 0 },
  totalStreamsSupported: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now }
});
const Points = mongoose.models.Points || mongoose.model('Points', PointsSchema);

const ActivitySchema = new mongoose.Schema({
  discordId: String,
  discordUsername: String,
  action: String,
  targetStreamer: String,
  points: Number,
  timestamp: { type: Date, default: Date.now }
});
const Activity = mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);

const loginPage = (error = '') => `<!DOCTYPE html>
<html>
<head>
<title>TWITCH FAM — Admin Login</title>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0e1021; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Segoe UI', sans-serif; }
.box { background: #151929; border: 1px solid #1f2640; border-radius: 16px; padding: 40px; width: 340px; }
.icon { font-size: 40px; text-align: center; margin-bottom: 16px; }
.logo { font-size: 22px; font-weight: 900; background: linear-gradient(90deg,#9146FF,#00d4c8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 4px; }
.sub { font-size: 11px; color: #4a5270; margin-bottom: 28px; letter-spacing: 1px; text-transform: uppercase; }
label { font-size: 10px; font-weight: 700; color: #7a85a8; letter-spacing: 0.8px; text-transform: uppercase; display: block; margin-bottom: 5px; }
input { width: 100%; background: #0d0f1e; border: 1px solid #1f2640; border-radius: 8px; padding: 10px 12px; color: #dde3f5; font-size: 13px; outline: none; margin-bottom: 14px; font-family: inherit; }
input:focus { border-color: #9146FF; }
button { width: 100%; background: #9146FF; color: #fff; border: none; border-radius: 8px; padding: 12px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
button:hover { background: #7c3aed; }
.error { color: #f87171; font-size: 12px; margin-bottom: 12px; text-align: center; }
</style>
</head>
<body>
<div class="box">
  <div class="icon">🔐</div>
  <div class="logo">TWITCH FAM</div>
  <div class="sub">Admin Dashboard</div>
  ${error ? `<div class="error">❌ ${error}</div>` : ''}
  <form method="POST" action="/admin/login">
    <label>Username</label>
    <input type="text" name="username" placeholder="admin username" autocomplete="off">
    <label>Password</label>
    <input type="password" name="password" placeholder="••••••••••">
    <button type="submit">Login</button>
  </form>
</div>
</body>
</html>`;

router.get('/login', (req, res) => res.send(loginPage()));

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.adminAuth = true;
    res.redirect('/admin/dashboard');
  } else {
    res.send(loginPage('Invalid username or password'));
  }
});

router.get('/logout', (req, res) => {
  req.session.adminAuth = false;
  res.redirect('/admin/login');
});

router.get('/dashboard', async (req, res) => {
  if (!req.session?.adminAuth) return res.redirect('/admin/login');
  try {
    const { Profile } = require('./profile');
    const users = await Profile.find({ twitchAttached: true });
    const leaderboard = await Points.find().sort({ points: -1 });
    const recentActivity = await Activity.find().sort({ timestamp: -1 }).limit(50);

    res.send(`<!DOCTYPE html>
<html>
<head>
<title>TWITCH FAM — Admin</title>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0e1021; color: #dde3f5; font-family: 'Segoe UI', sans-serif; }
.header { background: #151929; padding: 20px 30px; border-bottom: 1px solid #1f2640; display: flex; align-items: center; justify-content: space-between; }
.logo { font-size: 22px; font-weight: 900; background: linear-gradient(90deg,#9146FF,#00d4c8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.sub { font-size: 11px; color: #4a5270; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px; }
.logout-btn { background: transparent; border: 1px solid #1f2640; color: #7a85a8; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; text-decoration: none; }
.logout-btn:hover { border-color: #9146FF; color: #dde3f5; }
.stat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; padding: 20px 30px; }
.stat { background: #151929; border: 1px solid #1f2640; border-radius: 10px; padding: 16px; text-align: center; }
.stat-val { font-size: 32px; font-weight: 900; color: #9146FF; }
.stat-lbl { font-size: 11px; color: #4a5270; margin-top: 4px; }
.content { padding: 0 30px 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.card { background: #151929; border: 1px solid #1f2640; border-radius: 12px; padding: 20px; }
.card h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #9146FF; }
table { width: 100%; border-collapse: collapse; }
th { font-size: 10px; font-weight: 700; color: #4a5270; text-transform: uppercase; letter-spacing: 0.8px; padding: 8px; text-align: left; border-bottom: 1px solid #1f2640; }
td { padding: 10px 8px; font-size: 13px; border-bottom: 1px solid rgba(31,38,64,0.5); }
.badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.badge-twitch { background: rgba(145,70,255,0.15); color: #9146FF; border: 1px solid rgba(145,70,255,0.3); }
.badge-discord { background: rgba(88,101,242,0.15); color: #5865F2; border: 1px solid rgba(88,101,242,0.3); }
.badge-pts { background: rgba(0,212,200,0.15); color: #00d4c8; border: 1px solid rgba(0,212,200,0.3); }
.rank { font-weight: 900; color: #fbbf24; }
.full { grid-column: 1 / -1; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #23d18b; display: inline-block; margin-right: 6px; }
.time { font-size: 11px; color: #4a5270; }
</style>
</head>
<body>
<div class="header">
  <div><div class="logo">TWITCH FAM</div><div class="sub">Admin Dashboard</div></div>
  <a href="/admin/logout" class="logout-btn">Logout</a>
</div>

<div class="stat-grid">
  <div class="stat"><div class="stat-val">${users.length}</div><div class="stat-lbl">Registered Users</div></div>
  <div class="stat"><div class="stat-val">${leaderboard.reduce((a,u) => a + u.points, 0).toLocaleString()}</div><div class="stat-lbl">Total Points</div></div>
  <div class="stat"><div class="stat-val">${leaderboard.reduce((a,u) => a + u.totalChats, 0).toLocaleString()}</div><div class="stat-lbl">Total Chats Sent</div></div>
</div>

<div class="content">
  <div class="card">
    <h2>👥 Registered Users (${users.length})</h2>
    <table>
      <tr><th>#</th><th>Discord ID</th><th>Twitch</th><th>Status</th></tr>
      ${users.map((u, i) => `<tr><td>${i+1}</td><td><span class="badge badge-discord">${u.discordId?.slice(-6)||'?'}</span></td><td><span class="badge badge-twitch">@${u.twitchUsername||'?'}</span></td><td><span class="dot"></span>Active</td></tr>`).join('')}
    </table>
  </div>

  <div class="card">
    <h2>🏆 Leaderboard</h2>
    <table>
      <tr><th>Rank</th><th>User</th><th>Points</th><th>Chats</th><th>Streams</th></tr>
      ${leaderboard.length === 0 ? '<tr><td colspan="5" style="color:#4a5270;text-align:center;padding:20px">No points yet</td></tr>' : leaderboard.map((u,i) => `<tr><td class="rank">#${i+1}</td><td>${u.discordUsername||u.discordId?.slice(-6)||'?'} ${u.twitchUsername?`<span class="badge badge-twitch">@${u.twitchUsername}</span>`:''}</td><td><span class="badge badge-pts">${u.points.toLocaleString()} pts</span></td><td>${u.totalChats}</td><td>${u.totalStreamsSupported}</td></tr>`).join('')}
    </table>
  </div>

  <div class="card full">
    <h2>📊 Recent Activity</h2>
    <table>
      <tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Points</th></tr>
      ${recentActivity.length === 0 ? '<tr><td colspan="5" style="color:#4a5270;text-align:center;padding:20px">No activity yet</td></tr>' : recentActivity.map(a => `<tr><td class="time">${new Date(a.timestamp).toLocaleTimeString()}</td><td>${a.discordUsername||a.discordId?.slice(-6)||'?'}</td><td>${a.action==='chat_sent'?'💬 Chat sent':a.action==='stream_opened'?'🟢 Stream opened':'⭐ Stream supported'}</td><td>${a.targetStreamer?`<span class="badge badge-twitch">@${a.targetStreamer}</span>`:'-'}</td><td><span class="badge badge-pts">+${a.points} pts</span></td></tr>`).join('')}
    </table>
  </div>
</div>
<script>setTimeout(()=>location.reload(),30000);</script>
</body></html>`);
  } catch(e) {
    res.status(500).send('Error: ' + e.message);
  }
});

router.post('/award-points', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { discordId, discordUsername, twitchUsername, action, targetStreamer } = req.body;
  if (!discordId) return res.json({ success: false });
  try {
    let pts = 0;
    if (action === 'chat_sent') pts = 1;
    if (action === 'stream_opened') pts = 5;
    if (action === 'stream_supported') pts = 10;
    const user = await Points.findOneAndUpdate(
      { discordId },
      { $inc: { points: pts, totalChats: action==='chat_sent'?1:0, totalStreamsSupported: action==='stream_opened'?1:0 }, $set: { discordUsername:discordUsername||'', twitchUsername:twitchUsername||'', lastActive:new Date() } },
      { upsert: true, new: true }
    );
    await Activity.create({ discordId, discordUsername, action, targetStreamer, points: pts });
    res.json({ success: true, points: user.points });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

router.get('/leaderboard', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  try {
    const users = await Points.find().sort({ points: -1 }).limit(100);
    res.json({ success: true, leaderboard: users });
  } catch(e) {
    res.json({ success: true, leaderboard: [] });
  }
});

router.get('/points/:discordId', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  try {
    const user = await Points.findOne({ discordId: req.params.discordId });
    res.json({ success: true, points: user?.points||0, user });
  } catch(e) {
    res.json({ success: true, points: 0 });
  }
});

module.exports = router;