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
  totalWatchMinutes: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
  suspended: { type: Boolean, default: false },
  suspendedUntil: { type: Date, default: null },
  suspendReason: { type: String, default: '' }
});
const Points = mongoose.models.Points || mongoose.model('Points', PointsSchema);

const ActivitySchema = new mongoose.Schema({
  discordId: String,
  discordUsername: String,
  action: String,
  targetStreamer: String,
  points: Number,
  watchMinutes: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});
const Activity = mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);

const watchSessions = new Map();

const loginPage = (error) => `<!DOCTYPE html><html><head><title>TWITCH FAM Admin</title><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0e1021;display:flex;justify-content:center;align-items:center;height:100vh;font-family:'Segoe UI',sans-serif;}.box{background:#151929;border:1px solid #1f2640;border-radius:16px;padding:40px;width:340px;}.icon{font-size:40px;text-align:center;margin-bottom:16px;}.logo{font-size:22px;font-weight:900;background:linear-gradient(90deg,#9146FF,#00d4c8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px;}.sub{font-size:11px;color:#4a5270;margin-bottom:28px;letter-spacing:1px;text-transform:uppercase;}label{font-size:10px;font-weight:700;color:#7a85a8;letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:5px;}input{width:100%;background:#0d0f1e;border:1px solid #1f2640;border-radius:8px;padding:10px 12px;color:#dde3f5;font-size:13px;outline:none;margin-bottom:14px;font-family:inherit;}input:focus{border-color:#9146FF;}button{width:100%;background:#9146FF;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;}button:hover{background:#7c3aed;}.error{color:#f87171;font-size:12px;margin-bottom:12px;text-align:center;}</style></head>
<body><div class="box"><div class="icon">🔐</div><div class="logo">TWITCH FAM</div><div class="sub">Admin Dashboard</div>${error ? '<div class="error">❌ ' + error + '</div>' : ''}<form method="POST" action="/admin/login"><label>Username</label><input type="text" name="username" autocomplete="off"><label>Password</label><input type="password" name="password"><button type="submit">Login</button></form></div></body></html>`;

router.get('/login', (req, res) => res.send(loginPage('')));
router.get('/', (req, res) => res.redirect('/admin/login'));

router.post('/login', (req, res) => {
  if (req.body.username === ADMIN_USER && req.body.password === ADMIN_PASS) {
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

router.post('/watch-start', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { discordId, streamer, tabId } = req.body;
  if (!discordId || !streamer) return res.json({ success: false });
  const key = tabId ? `${discordId}_${streamer}_${tabId}` : `${discordId}_${streamer}`;
  if (!watchSessions.has(key)) watchSessions.set(key, Date.now());
  res.json({ success: true });
});

router.post('/watch-end', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { discordId, discordUsername, streamer, tabId } = req.body;
  if (!discordId || !streamer) return res.json({ success: false });
  const key = tabId ? `${discordId}_${streamer}_${tabId}` : `${discordId}_${streamer}`;
  const start = watchSessions.get(key);
  if (!start) return res.json({ success: false });
  const minutes = Math.round((Date.now() - start) / 60000);
  watchSessions.delete(key);
  try {
    await Points.findOneAndUpdate({ discordId }, { $inc: { totalWatchMinutes: minutes }, $set: { discordUsername: discordUsername || '', lastActive: new Date() } }, { upsert: true });
    await Activity.create({ discordId, discordUsername, action: 'watch_session', targetStreamer: streamer, watchMinutes: minutes, points: 0 });
    res.json({ success: true, minutes });
  } catch(e) { res.json({ success: false }); }
});

router.get('/watch-stats/:streamer', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false });
  try {
    const stats = await Activity.aggregate([
      { $match: { action: 'watch_session', targetStreamer: req.params.streamer } },
      { $group: { _id: '$discordId', discordUsername: { $last: '$discordUsername' }, totalMinutes: { $sum: '$watchMinutes' } } },
      { $sort: { totalMinutes: -1 } }
    ]);
    res.json({ success: true, viewers: stats });
  } catch(e) { res.json({ success: false, viewers: [] }); }
});

router.post('/suspend', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false });
  const { discordId, duration, reason } = req.body;
  try {
    const suspendedUntil = duration !== 'permanent' ? new Date(Date.now() + parseInt(duration) * 3600000) : null;
    await Points.findOneAndUpdate({ discordId }, { $set: { suspended: true, suspendedUntil, suspendReason: reason || '' } }, { upsert: true });
    res.json({ success: true });
  } catch(e) { res.json({ success: false }); }
});

router.post('/unsuspend', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false });
  try {
    await Points.findOneAndUpdate({ discordId: req.body.discordId }, { $set: { suspended: false, suspendedUntil: null } });
    res.json({ success: true });
  } catch(e) { res.json({ success: false }); }
});

router.get('/check-suspended/:discordId', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  try {
    const user = await Points.findOne({ discordId: req.params.discordId });
    if (!user?.suspended) return res.json({ suspended: false });
    if (user.suspendedUntil && new Date() > user.suspendedUntil) {
      await Points.findOneAndUpdate({ discordId: req.params.discordId }, { $set: { suspended: false, suspendedUntil: null } });
      return res.json({ suspended: false });
    }
    return res.json({ suspended: true, until: user.suspendedUntil, reason: user.suspendReason, permanent: !user.suspendedUntil });
  } catch(e) { res.json({ suspended: false }); }
});

router.post('/award-points', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { discordId, discordUsername, twitchUsername, action, targetStreamer } = req.body;
  if (!discordId) return res.json({ success: false });
  try {
    const existing = await Points.findOne({ discordId });
    if (existing?.suspended && (!existing.suspendedUntil || new Date() < existing.suspendedUntil)) return res.json({ success: false, suspended: true });
    let pts = 0;
    if (action === 'chat_sent') pts = 1;
    if (action === 'stream_opened') pts = 5;
    if (action === 'stream_supported') pts = 10;
    const user = await Points.findOneAndUpdate({ discordId }, { $inc: { points: pts, totalChats: action==='chat_sent'?1:0, totalStreamsSupported: action==='stream_opened'?1:0 }, $set: { discordUsername:discordUsername||'', twitchUsername:twitchUsername||'', lastActive:new Date() } }, { upsert: true, new: true });
    await Activity.create({ discordId, discordUsername, action, targetStreamer, points: pts });
    res.json({ success: true, points: user.points });
  } catch(e) { res.json({ success: false }); }
});

router.post('/adjust-points', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false, error: 'Unauthorized' });
  const { discordId, amount, reason } = req.body;
  if (!discordId || amount === undefined) return res.json({ success: false });
  try {
    const pts = parseInt(amount);
    const user = await Points.findOneAndUpdate({ discordId }, { $inc: { points: pts } }, { new: true });
    await Activity.create({ discordId, action: pts > 0 ? 'admin_add' : 'admin_remove', targetStreamer: reason || 'Admin', points: pts });
    res.json({ success: true, newPoints: user?.points });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

router.get('/leaderboard', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  try {
    const users = await Points.find().sort({ points: -1 }).limit(100);
    res.json({ success: true, leaderboard: users });
  } catch(e) { res.json({ success: true, leaderboard: [] }); }
});

router.get('/points/:discordId', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  try {
    const user = await Points.findOne({ discordId: req.params.discordId });
    res.json({ success: true, points: user?.points||0, user });
  } catch(e) { res.json({ success: true, points: 0 }); }
});

router.get('/dashboard', async (req, res) => {
  if (!req.session?.adminAuth) return res.redirect('/admin/login');
  try {
    const { Profile } = require('./profile');
    const profiles = await Profile.find({ twitchAttached: true });
    const leaderboard = await Points.find().sort({ points: -1 });
    const recentActivity = await Activity.find().sort({ timestamp: -1 }).limit(50);
    await Points.updateMany({ suspended: true, suspendedUntil: { $lt: new Date() } }, { $set: { suspended: false, suspendedUntil: null } });

    // Sanitize data for JSON embedding
    const safeProfiles = profiles.map(u => ({
      discordId: u.discordId || '',
      twitchUsername: (u.twitchUsername || '').replace(/[<>"'`]/g, ''),
    }));
    const safeLeaderboard = leaderboard.map(u => ({
      discordId: u.discordId || '',
      discordUsername: (u.discordUsername || '').replace(/[<>"'`]/g, ''),
      twitchUsername: (u.twitchUsername || '').replace(/[<>"'`]/g, ''),
      points: u.points || 0,
      totalChats: u.totalChats || 0,
      totalWatchMinutes: u.totalWatchMinutes || 0,
      suspended: !!u.suspended,
      suspendedUntil: u.suspendedUntil || null
    }));
    const safeActivity = recentActivity.map(a => ({
      discordId: a.discordId || '',
      discordUsername: (a.discordUsername || '').replace(/[<>"'`]/g, ''),
      action: a.action || '',
      targetStreamer: (a.targetStreamer || '').replace(/[<>"'`]/g, ''),
      points: a.points || 0,
      watchMinutes: a.watchMinutes || 0,
      timestamp: a.timestamp || new Date()
    }));

    const totalWatchH = Math.round(leaderboard.reduce((a,u)=>a+(u.totalWatchMinutes||0),0)/60);

    res.send(`<!DOCTYPE html>
<html>
<head>
<title>TWITCH FAM - Admin</title>
<meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#0e1021;color:#dde3f5;font-family:'Segoe UI',sans-serif;}
.header{background:#151929;padding:20px 30px;border-bottom:1px solid #1f2640;display:flex;align-items:center;justify-content:space-between;}
.logo{font-size:22px;font-weight:900;background:linear-gradient(90deg,#9146FF,#00d4c8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.sub{font-size:11px;color:#4a5270;letter-spacing:1px;text-transform:uppercase;margin-top:4px;}
.logout-btn{background:transparent;border:1px solid #1f2640;color:#7a85a8;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;}
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px 30px;}
.stat{background:#151929;border:1px solid #1f2640;border-radius:10px;padding:16px;text-align:center;}
.stat-val{font-size:28px;font-weight:900;color:#9146FF;}
.stat-lbl{font-size:11px;color:#4a5270;margin-top:4px;}
.content{padding:0 30px 40px;display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.card{background:#151929;border:1px solid #1f2640;border-radius:12px;padding:20px;}
.card h2{font-size:16px;font-weight:700;margin-bottom:16px;color:#9146FF;}
table{width:100%;border-collapse:collapse;}
th{font-size:10px;font-weight:700;color:#4a5270;text-transform:uppercase;letter-spacing:0.8px;padding:8px;text-align:left;border-bottom:1px solid #1f2640;}
td{padding:10px 8px;font-size:13px;border-bottom:1px solid rgba(31,38,64,0.5);vertical-align:middle;}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;}
.badge-twitch{background:rgba(145,70,255,0.15);color:#9146FF;border:1px solid rgba(145,70,255,0.3);}
.badge-discord{background:rgba(88,101,242,0.15);color:#5865F2;border:1px solid rgba(88,101,242,0.3);}
.badge-pts{background:rgba(0,212,200,0.15);color:#00d4c8;border:1px solid rgba(0,212,200,0.3);}
.badge-suspended{background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.3);}
.badge-active{background:rgba(35,209,139,0.15);color:#23d18b;border:1px solid rgba(35,209,139,0.3);}
.rank{font-weight:900;color:#fbbf24;}
.full{grid-column:1/-1;}
.time{font-size:11px;color:#4a5270;}
.btn-sm{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid;font-family:inherit;margin-left:3px;}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:1000;justify-content:center;align-items:center;}
.modal.show{display:flex;}
.modal-box{background:#151929;border:1px solid #1f2640;border-radius:14px;padding:30px;width:420px;max-height:80vh;overflow-y:auto;}
.modal-box h3{font-size:16px;font-weight:700;margin-bottom:16px;}
.modal-box select,.modal-box input[type=text]{width:100%;background:#0d0f1e;border:1px solid #1f2640;border-radius:8px;padding:9px 12px;color:#dde3f5;font-size:13px;outline:none;margin-bottom:14px;font-family:inherit;}
.modal-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;}
.btn-cancel{background:transparent;color:#7a85a8;border:1px solid #1f2640;padding:10px;border-radius:8px;cursor:pointer;font-family:inherit;}
.btn-confirm{background:#f87171;color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700;}
.watch-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(31,38,64,0.3);}
</style>
</head>
<body>

<div class="modal" id="suspendModal">
  <div class="modal-box">
    <h3 style="color:#f87171">Suspend User</h3>
    <select id="suspendDuration">
      <option value="1">1 hour</option><option value="6">6 hours</option>
      <option value="12">12 hours</option><option value="24" selected>24 hours</option>
      <option value="48">2 days</option><option value="72">3 days</option>
      <option value="168">1 week</option><option value="permanent">Permanent</option>
    </select>
    <input type="text" id="suspendReason" placeholder="Reason (optional)">
    <div class="modal-row">
      <button class="btn-cancel" onclick="closeSuspend()">Cancel</button>
      <button class="btn-confirm" onclick="doSuspend()">Suspend</button>
    </div>
  </div>
</div>

<div class="modal" id="watchModal">
  <div class="modal-box">
    <h3 style="color:#9146FF">Watch Stats - <span id="watchTitle"></span></h3>
    <div id="watchList" style="margin:16px 0">Loading...</div>
    <button class="btn-cancel" style="width:100%" onclick="closeWatch()">Close</button>
  </div>
</div>

<div class="header">
  <div><div class="logo">TWITCH FAM</div><div class="sub">Admin Dashboard</div></div>
  <a href="/admin/logout" class="logout-btn">Logout</a>
</div>

<div class="stat-grid" id="stats"></div>
<div class="content" id="content"></div>

<script>
var DATA = ${JSON.stringify({ profiles: safeProfiles, leaderboard: safeLeaderboard, activity: safeActivity, totalWatchH: totalWatchH })};

var suspendId = '';

function fmt(mins) {
  if (!mins) return '0m';
  return mins >= 60 ? Math.floor(mins/60)+'h'+(mins%60)+'m' : mins+'m';
}

function render() {
  var lb = DATA.leaderboard;
  var pr = DATA.profiles;
  var ac = DATA.activity;
  var totalPts = lb.reduce(function(a,u){ return a+u.points; }, 0);
  var totalChats = lb.reduce(function(a,u){ return a+u.totalChats; }, 0);

  document.getElementById('stats').innerHTML =
    '<div class="stat"><div class="stat-val">'+pr.length+'</div><div class="stat-lbl">Users</div></div>' +
    '<div class="stat"><div class="stat-val">'+totalPts.toLocaleString()+'</div><div class="stat-lbl">Total Points</div></div>' +
    '<div class="stat"><div class="stat-val">'+totalChats.toLocaleString()+'</div><div class="stat-lbl">Total Chats</div></div>' +
    '<div class="stat"><div class="stat-val">'+DATA.totalWatchH+'h</div><div class="stat-lbl">Watch Time</div></div>';

  // Users table
  var usersHtml = '<div class="card"><h2>Users ('+pr.length+')</h2><table><tr><th>#</th><th>Discord</th><th>Twitch</th><th>Watch</th><th>Status</th><th>Actions</th></tr>';
  pr.forEach(function(u, i) {
    var pts = lb.find(function(p){ return p.discordId === u.discordId; });
    var isSusp = pts && pts.suspended;
    var watchStr = fmt(pts ? pts.totalWatchMinutes : 0);
    usersHtml += '<tr><td>'+(i+1)+'</td>';
    usersHtml += '<td><span class="badge badge-discord">'+u.discordId.slice(-6)+'</span></td>';
    usersHtml += '<td><span class="badge badge-twitch">@'+u.twitchUsername+'</span></td>';
    usersHtml += '<td style="color:#00d4c8">'+watchStr+'</td>';
    usersHtml += '<td>'+(isSusp ? '<span class="badge badge-suspended">Suspended</span>' : '<span class="badge badge-active">Active</span>')+'</td>';
    usersHtml += '<td>';
    usersHtml += '<button class="btn-sm" style="color:#9146FF;border-color:rgba(145,70,255,0.3)" onclick="showWatch(\''+u.twitchUsername+'\')">View</button>';
    if (isSusp) {
      usersHtml += '<button class="btn-sm" style="color:#23d18b;border-color:rgba(35,209,139,0.3)" onclick="doUnsuspend(\''+u.discordId+'\')">Unsuspend</button>';
    } else {
      usersHtml += '<button class="btn-sm" style="color:#f87171;border-color:rgba(248,113,113,0.3)" onclick="openSuspend(\''+u.discordId+'\')">Suspend</button>';
    }
    usersHtml += '</td></tr>';
  });
  usersHtml += '</table></div>';

  // Leaderboard
  var lbHtml = '<div class="card"><h2>Leaderboard</h2><table><tr><th>Rank</th><th>User</th><th>Points</th><th>Chats</th><th>Watch</th></tr>';
  if (lb.length === 0) {
    lbHtml += '<tr><td colspan="5" style="color:#4a5270;text-align:center;padding:20px">No points yet</td></tr>';
  } else {
    lb.forEach(function(u, i) {
      lbHtml += '<tr>';
      lbHtml += '<td class="rank">#'+(i+1)+'</td>';
      lbHtml += '<td>'+(u.discordUsername || u.discordId.slice(-6))+(u.twitchUsername ? ' <span class="badge badge-twitch">@'+u.twitchUsername+'</span>' : '')+'</td>';
      lbHtml += '<td><span class="badge badge-pts">'+u.points.toLocaleString()+' pts</span> <button class="btn-sm" style="color:#23d18b;border-color:rgba(35,209,139,0.3)" onclick="adjustPts(\''+u.discordId+'\','+u.points+')">Edit</button></td>';
      lbHtml += '<td>'+u.totalChats+'</td>';
      lbHtml += '<td style="color:#00d4c8">'+fmt(u.totalWatchMinutes)+'</td>';
      lbHtml += '</tr>';
    });
  }
  lbHtml += '</table></div>';

  // Activity
  var actHtml = '<div class="card full"><h2>Recent Activity</h2><table><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Points</th></tr>';
  if (ac.length === 0) {
    actHtml += '<tr><td colspan="5" style="color:#4a5270;text-align:center;padding:20px">No activity</td></tr>';
  } else {
    ac.forEach(function(a) {
      var actionStr = a.action === 'chat_sent' ? 'Chat sent' : a.action === 'stream_opened' ? 'Stream opened' : a.action === 'watch_session' ? 'Watched '+a.watchMinutes+'min' : a.action === 'stream_supported' ? 'Supported' : a.action === 'admin_add' ? 'Admin +pts' : a.action === 'admin_remove' ? 'Admin -pts' : a.action;
      actHtml += '<tr>';
      actHtml += '<td class="time">'+new Date(a.timestamp).toLocaleTimeString()+'</td>';
      actHtml += '<td>'+(a.discordUsername || a.discordId.slice(-6))+'</td>';
      actHtml += '<td>'+actionStr+'</td>';
      actHtml += '<td>'+(a.targetStreamer ? '<span class="badge badge-twitch">@'+a.targetStreamer+'</span>' : '-')+'</td>';
      actHtml += '<td>'+(a.points > 0 ? '<span class="badge badge-pts">+'+a.points+' pts</span>' : a.points < 0 ? '<span style="color:#f87171">'+a.points+' pts</span>' : '-')+'</td>';
      actHtml += '</tr>';
    });
  }
  actHtml += '</table></div>';

  document.getElementById('content').innerHTML = usersHtml + lbHtml + actHtml;
}

function openSuspend(id) {
  suspendId = id;
  document.getElementById('suspendReason').value = '';
  document.getElementById('suspendModal').classList.add('show');
}
function closeSuspend() { document.getElementById('suspendModal').classList.remove('show'); }

function doSuspend() {
  var dur = document.getElementById('suspendDuration').value;
  var reason = document.getElementById('suspendReason').value;
  fetch('/admin/suspend', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discordId: suspendId, duration: dur, reason: reason }) })
    .then(function(r){ return r.json(); }).then(function(d){ if(d.success){ closeSuspend(); location.reload(); } else { alert('Error'); } });
}

function doUnsuspend(id) {
  if (!confirm('Unsuspend?')) return;
  fetch('/admin/unsuspend', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discordId: id }) })
    .then(function(r){ return r.json(); }).then(function(d){ if(d.success) location.reload(); });
}

function adjustPts(id, current) {
  var amt = prompt('Current: '+current+' pts\\nEnter amount (+100 or -50):');
  if (!amt) return;
  var n = parseInt(amt);
  if (isNaN(n)) { alert('Invalid'); return; }
  var reason = prompt('Reason:') || 'Admin';
  fetch('/admin/adjust-points', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discordId: id, amount: n, reason: reason }) })
    .then(function(r){ return r.json(); }).then(function(d){ if(d.success){ alert('Done! New: '+d.newPoints+' pts'); location.reload(); } else { alert('Error: '+d.error); } });
}

function showWatch(streamer) {
  if (!streamer) { alert('No Twitch username'); return; }
  document.getElementById('watchTitle').textContent = '@'+streamer;
  document.getElementById('watchModal').classList.add('show');
  document.getElementById('watchList').innerHTML = 'Loading...';
  fetch('/admin/watch-stats/'+streamer).then(function(r){ return r.json(); }).then(function(d){
    if (!d.viewers || d.viewers.length === 0) { document.getElementById('watchList').innerHTML = '<p style="color:#4a5270;text-align:center">No data yet</p>'; return; }
    document.getElementById('watchList').innerHTML = d.viewers.map(function(v){
      var mins = v.totalMinutes || 0;
      var t = mins >= 60 ? Math.floor(mins/60)+'h '+(mins%60)+'min' : mins+' min';
      return '<div class="watch-row"><span>'+(v.discordUsername||v._id.slice(-6))+'</span><span style="color:#00d4c8">'+t+'</span></div>';
    }).join('');
  });
}
function closeWatch() { document.getElementById('watchModal').classList.remove('show'); }

render();
setTimeout(function(){ location.reload(); }, 30000);
</script>
</body></html>`);
  } catch(e) { res.status(500).send('Error: ' + e.message); }
});

module.exports = router;