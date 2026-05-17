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

router.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>TWITCH FAM Admin</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0e1021;display:flex;justify-content:center;align-items:center;height:100vh;font-family:'Segoe UI',sans-serif;color:#dde3f5}.box{background:#151929;border:1px solid #1f2640;border-radius:16px;padding:40px;width:320px}.logo{font-size:22px;font-weight:900;background:linear-gradient(90deg,#9146FF,#00d4c8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px;text-align:center}.sub{font-size:11px;color:#4a5270;margin-bottom:24px;text-align:center;letter-spacing:1px}label{display:block;font-size:10px;font-weight:700;color:#7a85a8;letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px}input{width:100%;background:#0d0f1e;border:1px solid #1f2640;border-radius:8px;padding:10px;color:#dde3f5;font-size:13px;outline:none;margin-bottom:12px}input:focus{border-color:#9146FF}button{width:100%;background:#9146FF;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer}button:hover{background:#7c3aed}</style></head><body><div class="box"><div class="logo">TWITCH FAM</div><div class="sub">ADMIN DASHBOARD</div><form method="POST" action="/admin/login"><label>Username</label><input type="text" name="username" autocomplete="off"><label>Password</label><input type="password" name="password"><button>Login</button></form></div></body></html>`);
});

router.get('/', (req, res) => res.redirect('/admin/login'));

router.post('/login', (req, res) => {
  if (req.body.username === ADMIN_USER && req.body.password === ADMIN_PASS) {
    req.session.adminAuth = true;
    res.redirect('/admin/dashboard');
  } else {
    res.send(`<!DOCTYPE html><html><head><title>TWITCH FAM Admin</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0e1021;display:flex;justify-content:center;align-items:center;height:100vh;font-family:'Segoe UI',sans-serif;color:#dde3f5}.box{background:#151929;border:1px solid #1f2640;border-radius:16px;padding:40px;width:320px}.logo{font-size:22px;font-weight:900;background:linear-gradient(90deg,#9146FF,#00d4c8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px;text-align:center}.sub{font-size:11px;color:#4a5270;margin-bottom:24px;text-align:center;letter-spacing:1px}.err{color:#f87171;font-size:12px;margin-bottom:12px;text-align:center}label{display:block;font-size:10px;font-weight:700;color:#7a85a8;letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px}input{width:100%;background:#0d0f1e;border:1px solid #1f2640;border-radius:8px;padding:10px;color:#dde3f5;font-size:13px;outline:none;margin-bottom:12px}input:focus{border-color:#9146FF}button{width:100%;background:#9146FF;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer}button:hover{background:#7c3aed}</style></head><body><div class="box"><div class="logo">TWITCH FAM</div><div class="sub">ADMIN DASHBOARD</div><div class="err">Invalid credentials</div><form method="POST" action="/admin/login"><label>Username</label><input type="text" name="username" autocomplete="off"><label>Password</label><input type="password" name="password"><button>Login</button></form></div></body></html>`);
  }
});

router.get('/logout', (req, res) => {
  req.session.adminAuth = false;
  res.redirect('/admin/login');
});

// ── DATA API ──
router.get('/data', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false });
  try {
    const { Profile } = require('./profile');
    const profiles = await Profile.find({ twitchAttached: true });
    const leaderboard = await Points.find().sort({ points: -1 });
    const activity = await Activity.find().sort({ timestamp: -1 }).limit(50);
    await Points.updateMany({ suspended: true, suspendedUntil: { $lt: new Date() } }, { $set: { suspended: false, suspendedUntil: null } });

    let apiKeys = [];
    try { const { ApiKey } = require('./apikeys'); apiKeys = await ApiKey.find().sort({ createdAt: -1 }); } catch(e) {}

    res.json({
      success: true,
      apiKeys: apiKeys.map(function(k) { return { discordId: String(k.discordId||''), discordUsername: String(k.discordUsername||''), apiKey: String(k.apiKey||''), active: Boolean(k.active), lastUsed: k.lastUsed }; }),
      profiles: profiles.map(function(u) { return { discordId: String(u.discordId||''), twitchUsername: String(u.twitchUsername||''), displayName: String(u.displayName||''), moodTags: u.moodTags||[], langTags: u.langTags||[], gameTags: u.gameTags||[], minSec: u.minSec||20, maxSec: u.maxSec||70, chatSpeed: String(u.chatSpeed||'slow') }; }),
      leaderboard: leaderboard.map(function(u) { return { discordId: String(u.discordId||''), discordUsername: String(u.discordUsername||''), twitchUsername: String(u.twitchUsername||''), points: Number(u.points||0), totalChats: Number(u.totalChats||0), totalWatchMinutes: Number(u.totalWatchMinutes||0), suspended: Boolean(u.suspended) }; }),
      activity: activity.map(function(a) { return { discordId: String(a.discordId||''), discordUsername: String(a.discordUsername||''), action: String(a.action||''), targetStreamer: String(a.targetStreamer||''), points: Number(a.points||0), watchMinutes: Number(a.watchMinutes||0), timestamp: a.timestamp }; })
    });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

router.get('/dashboard', async (req, res) => {
  if (!req.session?.adminAuth) return res.redirect('/admin/login');
  try {
    const { Profile } = require('./profile');
    const users = await Profile.find({ twitchAttached: true });
    const leaderboard = await Points.find().sort({ points: -1 });
    const recentActivity = await Activity.find().sort({ timestamp: -1 }).limit(50);
    await Points.updateMany({ suspended: true, suspendedUntil: { $lt: new Date() } }, { $set: { suspended: false, suspendedUntil: null } });

    let apiKeys = [];
    try { const { ApiKey } = require('./apikeys'); apiKeys = await ApiKey.find().sort({ createdAt: -1 }); } catch(e) {}

    res.send(`<!DOCTYPE html>
<html>
<head>
<title>TWITCH FAM - Admin</title>
<meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0e1021;color:#dde3f5;font-family:'Segoe UI',sans-serif;font-size:13px}
.hdr{background:#151929;padding:16px 24px;border-bottom:1px solid #1f2640;display:flex;align-items:center;justify-content:space-between}
.logo{font-size:20px;font-weight:900;background:linear-gradient(90deg,#9146FF,#00d4c8);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logout{background:transparent;border:1px solid #1f2640;color:#7a85a8;padding:6px 14px;border-radius:7px;font-size:12px;cursor:pointer;text-decoration:none}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px 24px}
.stat{background:#151929;border:1px solid #1f2640;border-radius:10px;padding:14px;text-align:center}
.stat-val{font-size:26px;font-weight:900;color:#9146FF}
.stat-lbl{font-size:10px;color:#4a5270;margin-top:3px;text-transform:uppercase;letter-spacing:.5px}
.grid{padding:0 24px 40px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
.card{background:#151929;border:1px solid #1f2640;border-radius:12px;padding:18px}
.card h2{font-size:14px;font-weight:700;color:#9146FF;margin-bottom:14px}
.full{grid-column:1/-1}
table{width:100%;border-collapse:collapse}
th{font-size:9px;font-weight:700;color:#4a5270;text-transform:uppercase;letter-spacing:.7px;padding:7px 6px;text-align:left;border-bottom:1px solid #1f2640}
td{padding:9px 6px;border-bottom:1px solid rgba(31,38,64,0.4);vertical-align:middle}
.badge{display:inline-block;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:600}
.pt{background:rgba(145,70,255,.15);color:#9146FF;border:1px solid rgba(145,70,255,.3)}
.pp{background:rgba(0,212,200,.15);color:#00d4c8;border:1px solid rgba(0,212,200,.3)}
.ps{background:rgba(248,113,113,.15);color:#f87171;border:1px solid rgba(248,113,113,.3)}
.pa{background:rgba(35,209,139,.15);color:#23d18b;border:1px solid rgba(35,209,139,.3)}
.rank{font-weight:900;color:#fbbf24}
.ts{font-size:10px;color:#4a5270}
.btn{padding:3px 9px;border-radius:5px;font-size:10px;font-weight:600;cursor:pointer;border:1px solid;font-family:inherit;margin-left:3px;background:transparent}
.bv{color:#9146FF;border-color:rgba(145,70,255,.4)}
.bs{color:#f87171;border-color:rgba(248,113,113,.4)}
.bu{color:#23d18b;border-color:rgba(35,209,139,.4)}
.be{color:#00d4c8;border-color:rgba(0,212,200,.4)}
.bk{color:#fbbf24;border-color:rgba(251,191,36,.4)}
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;align-items:center;justify-content:center}
.overlay.on{display:flex}
.modal{background:#151929;border:1px solid #1f2640;border-radius:14px;padding:28px;width:420px;max-height:80vh;overflow-y:auto}
.modal h3{font-size:15px;font-weight:700;margin-bottom:14px}
select,input[type=text]{width:100%;background:#0d0f1e;border:1px solid #1f2640;border-radius:7px;padding:9px;color:#dde3f5;font-size:12px;outline:none;margin-bottom:12px;font-family:inherit}
.mrow{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.bcn{background:transparent;color:#7a85a8;border:1px solid #1f2640;padding:9px;border-radius:7px;cursor:pointer;font-family:inherit;width:100%}
.bco{background:#f87171;color:#fff;border:none;padding:9px;border-radius:7px;cursor:pointer;font-family:inherit;font-weight:700;width:100%}
.loading{color:#4a5270;text-align:center;padding:20px}
code{font-size:10px;color:#00d4c8;background:#0d0f1e;padding:2px 6px;border-radius:4px;word-break:break-all}
.newkey{display:flex;gap:8px;margin-bottom:14px}
.newkey input{flex:1;margin:0;padding:8px;font-size:12px}
.newkey button{white-space:nowrap;padding:8px 14px;border-radius:7px;border:1px solid rgba(251,191,36,.4);color:#fbbf24;background:transparent;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600}
.newkey button:hover{background:rgba(251,191,36,.1)}
</style>
</head>
<body>

<div class="overlay" id="suspModal">
  <div class="modal">
    <h3 style="color:#f87171">Suspend User</h3>
    <select id="suspDur">
      <option value="1">1 hour</option><option value="6">6 hours</option>
      <option value="12">12 hours</option><option value="24" selected>24 hours</option>
      <option value="48">2 days</option><option value="72">3 days</option>
      <option value="168">1 week</option><option value="permanent">Permanent</option>
    </select>
    <input type="text" id="suspReason" placeholder="Reason (optional)">
    <div class="mrow">
      <button class="bcn" onclick="closeModal()">Cancel</button>
      <button class="bco" onclick="doSuspend()">Suspend</button>
    </div>
  </div>
</div>

<div class="overlay" id="watchModal">
  <div class="modal">
    <h3 style="color:#9146FF">Watch Stats — <span id="watchTitle"></span></h3>
    <div id="watchList" style="margin:12px 0;max-height:300px;overflow-y:auto"></div>
    <button class="bcn" onclick="closeWatch()" style="width:100%">Close</button>
  </div>
</div>

<div class="hdr">
  <div class="logo">TWITCH FAM</div>
  <a href="/admin/logout" class="logout">Logout</a>
</div>

<div class="stats">
  <div class="stat"><div class="stat-val">${users.length}</div><div class="stat-lbl">Users</div></div>
  <div class="stat"><div class="stat-val">${leaderboard.reduce(function(a,u){return a+u.points;},0).toLocaleString()}</div><div class="stat-lbl">Total Points</div></div>
  <div class="stat"><div class="stat-val">${leaderboard.reduce(function(a,u){return a+u.totalChats;},0).toLocaleString()}</div><div class="stat-lbl">Total Chats</div></div>
  <div class="stat"><div class="stat-val">${Math.round(leaderboard.reduce(function(a,u){return a+(u.totalWatchMinutes||0);},0)/60)}h</div><div class="stat-lbl">Watch Time</div></div>
</div>

<div class="grid" id="content"></div>

<script>
var suspId = '';

function closeModal() { document.getElementById('suspModal').classList.remove('on'); }
function closeWatch() { document.getElementById('watchModal').classList.remove('on'); }

function openSuspend(id) {
  suspId = id;
  document.getElementById('suspReason').value = '';
  document.getElementById('suspModal').classList.add('on');
}

function doSuspend() {
  fetch('/admin/suspend', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ discordId: suspId, duration: document.getElementById('suspDur').value, reason: document.getElementById('suspReason').value })
  }).then(function(r){ return r.json(); }).then(function(d){
    if (d.success) { closeModal(); location.reload(); }
    else alert('Error');
  });
}

function doUnsuspend(id) {
  if (!confirm('Unsuspend?')) return;
  fetch('/admin/unsuspend', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discordId: id }) })
    .then(function(r){ return r.json(); }).then(function(d){ if (d.success) location.reload(); });
}

function editPts(id, current) {
  var amt = prompt('Current: ' + current + ' pts\nAmount (+100 or -50):');
  if (!amt) return;
  var n = parseInt(amt);
  if (isNaN(n)) { alert('Invalid'); return; }
  var reason = prompt('Reason:') || 'Admin';
  fetch('/admin/adjust-points', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discordId: id, amount: n, reason: reason }) })
    .then(function(r){ return r.json(); }).then(function(d){
      if (d.success) { alert('Done! New: ' + d.newPoints + ' pts'); location.reload(); }
      else alert('Error: ' + (d.error||''));
    });
}

function viewWatch(streamer) {
  document.getElementById('watchTitle').textContent = '@' + streamer;
  document.getElementById('watchList').innerHTML = '<div class="loading">Loading...</div>';
  document.getElementById('watchModal').classList.add('on');
  fetch('/admin/watch-stats/' + streamer).then(function(r){ return r.json(); }).then(function(d){
    if (!d.viewers || !d.viewers.length) { document.getElementById('watchList').innerHTML = '<div class="loading">No watch data yet</div>'; return; }
    document.getElementById('watchList').innerHTML = d.viewers.map(function(v){
      var mins = v.totalMinutes || 0;
      var t = mins >= 60 ? Math.floor(mins/60) + 'h ' + (mins%60) + 'min' : mins + 'min';
      return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(31,38,64,.4)"><span>' + (v.discordUsername||v._id.slice(-6)) + '</span><span style="color:#00d4c8">' + t + '</span></div>';
    }).join('');
  });
}

function genKey(id, name) {
  if (!confirm('Generate API key for ' + (name||id) + '?')) return;
  fetch('/apikeys/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discordId: id, discordUsername: name }) })
    .then(function(r){ return r.json(); }).then(function(d){
      if (d.success) { alert('API Key:\n\n' + d.apiKey + '\n\nSend to user.'); location.reload(); }
      else alert('Error: ' + d.error);
    });
}

function revokeKey(id) {
  if (!confirm('Revoke this key?')) return;
  fetch('/apikeys/revoke', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discordId: id }) })
    .then(function(r){ return r.json(); }).then(function(d){ if (d.success) location.reload(); });
}

function createKey() {
  var id = document.getElementById('newKeyId').value.trim();
  var name = document.getElementById('newKeyName').value.trim();
  if (!id || id.length < 17) { alert('Enter a valid Discord ID (17-19 digits)'); return; }
  fetch('/apikeys/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discordId: id, discordUsername: name }) })
    .then(function(r){ return r.json(); }).then(function(d){
      if (d.success) { alert('Key created:\n\n' + d.apiKey); location.reload(); }
      else alert('Error: ' + d.error);
    });
}

function fmt(m) { if (!m) return '0m'; return m >= 60 ? Math.floor(m/60)+'h'+(m%60)+'m' : m+'m'; }
</script>

<script>
(function() {
  function fmt(m) { if (!m) return '0m'; return m >= 60 ? Math.floor(m/60)+'h'+(m%60)+'m' : m+'m'; }

  var DATA = ${JSON.stringify({
    users: users.map(function(u) {
      var pts = leaderboard.find(function(p){return p.discordId===u.discordId;});
      return {
        discordId: String(u.discordId||''),
        twitchUsername: String(u.twitchUsername||''),
        displayName: String(u.displayName||''),
        moodTags: u.moodTags||[],
        langTags: u.langTags||[],
        gameTags: u.gameTags||[],
        minSec: u.minSec||20,
        maxSec: u.maxSec||70,
        suspended: !!(pts&&pts.suspended),
        watchMinutes: pts ? (pts.totalWatchMinutes||0) : 0,
        points: pts ? (pts.points||0) : 0
      };
    }),
    leaderboard: leaderboard.map(function(u){return{discordId:String(u.discordId||''),discordUsername:String(u.discordUsername||''),twitchUsername:String(u.twitchUsername||''),points:Number(u.points||0),totalChats:Number(u.totalChats||0),totalWatchMinutes:Number(u.totalWatchMinutes||0),suspended:Boolean(u.suspended)};}),
    activity: recentActivity.map(function(a){return{discordId:String(a.discordId||''),discordUsername:String(a.discordUsername||''),action:String(a.action||''),targetStreamer:String(a.targetStreamer||''),points:Number(a.points||0),watchMinutes:Number(a.watchMinutes||0),timestamp:a.timestamp};}),
    apiKeys: apiKeys.map(function(k){return{discordId:String(k.discordId||''),discordUsername:String(k.discordUsername||''),apiKey:String(k.apiKey||''),active:Boolean(k.active),lastUsed:k.lastUsed};})
  })};

  var html = '';

  // Users table
  html += '<div class="card full"><h2>Users (' + DATA.users.length + ')</h2><table><tr><th>#</th><th>Twitch</th><th>Name</th><th>Mood</th><th>Lang</th><th>Game</th><th>Speed</th><th>Watch</th><th>Status</th><th>Actions</th></tr>';
  DATA.users.forEach(function(u, i) {
    var mood = (u.moodTags||[]).join(', ') || '-';
    var lang = (u.langTags||[]).join(', ') || '-';
    var game = (u.gameTags||[]).join(', ') || '-';
    var speed = u.minSec + 's-' + u.maxSec + 's';
    var w = fmt(u.watchMinutes);
    html += '<tr><td>' + (i+1) + '</td><td><span class="badge pt">@' + u.twitchUsername + '</span></td><td style="color:#fbbf24;font-weight:700">' + (u.displayName||'-') + '</td>';
    html += '<td style="font-size:11px;color:#9146FF">' + mood + '</td><td style="font-size:11px;color:#00d4c8">' + lang + '</td><td style="font-size:11px;color:#23d18b">' + game + '</td>';
    html += '<td style="font-size:11px;color:#4a5270">' + speed + '</td><td style="color:#00d4c8">' + w + '</td>';
    html += '<td>' + (u.suspended ? '<span class="badge ps">Suspended</span>' : '<span class="badge pa">Active</span>') + '</td><td>';
    html += '<button class="btn bv" data-s="' + u.twitchUsername + '" onclick="viewWatch(this.dataset.s)">Watch</button>';
    html += u.suspended
      ? '<button class="btn bu" data-id="' + u.discordId + '" onclick="doUnsuspend(this.dataset.id)">Unsuspend</button>'
      : '<button class="btn bs" data-id="' + u.discordId + '" onclick="openSuspend(this.dataset.id)">Suspend</button>';
    html += '<button class="btn bk" data-id="' + u.discordId + '" data-name="' + u.twitchUsername + '" onclick="genKey(this.dataset.id,this.dataset.name)">Key</button>';
    html += '</td></tr>';
  });
  html += '</table></div>';

  // Leaderboard
  html += '<div class="card"><h2>Leaderboard</h2><table><tr><th>Rank</th><th>User</th><th>Points</th><th>Chats</th><th>Watch</th></tr>';
  if (!DATA.leaderboard.length) html += '<tr><td colspan="5" style="color:#4a5270;text-align:center;padding:16px">No points yet</td></tr>';
  DATA.leaderboard.forEach(function(u, i) {
    html += '<tr><td class="rank">#' + (i+1) + '</td><td>' + (u.discordUsername||u.discordId.slice(-6)) + (u.twitchUsername ? ' <span class="badge pt">@' + u.twitchUsername + '</span>' : '') + '</td>';
    html += '<td><span class="badge pp">' + u.points.toLocaleString() + ' pts</span> <button class="btn be" data-id="' + u.discordId + '" data-pts="' + u.points + '" onclick="editPts(this.dataset.id,this.dataset.pts)">Edit</button></td>';
    html += '<td>' + u.totalChats + '</td><td style="color:#00d4c8">' + fmt(u.totalWatchMinutes) + '</td></tr>';
  });
  html += '</table></div>';

  // API Keys
  html += '<div class="card"><h2>API Keys (' + DATA.apiKeys.length + ')</h2>';
  html += '<div class="newkey"><input type="text" id="newKeyId" placeholder="Discord ID (17-19 digits)"><input type="text" id="newKeyName" placeholder="Username (optional)"><button onclick="createKey()">+ Create Key</button></div>';
  html += '<table><tr><th>User</th><th>Key</th><th>Status</th><th>Last Used</th><th>Actions</th></tr>';
  if (!DATA.apiKeys.length) html += '<tr><td colspan="5" style="color:#4a5270;text-align:center;padding:16px">No keys yet</td></tr>';
  DATA.apiKeys.forEach(function(k) {
    var lu = k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : 'Never';
    html += '<tr><td>' + (k.discordUsername||k.discordId.slice(-6)) + '</td><td><code>' + k.apiKey + '</code></td>';
    html += '<td>' + (k.active ? '<span class="badge pa">Active</span>' : '<span class="badge ps">Revoked</span>') + '</td><td class="ts">' + lu + '</td><td>';
    html += k.active ? '<button class="btn bs" data-id="' + k.discordId + '" onclick="revokeKey(this.dataset.id)">Revoke</button>' : '';
    html += '<button class="btn bk" data-id="' + k.discordId + '" data-name="' + k.discordUsername + '" onclick="genKey(this.dataset.id,this.dataset.name)">Regen</button></td></tr>';
  });
  html += '</table></div>';

  // Activity
  html += '<div class="card full"><h2>Recent Activity</h2><table><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Pts</th></tr>';
  if (!DATA.activity.length) html += '<tr><td colspan="5" style="color:#4a5270;text-align:center;padding:16px">No activity</td></tr>';
  DATA.activity.forEach(function(a) {
    var acts = {chat_sent:'Chat',stream_opened:'Opened',watch_session:'Watch '+a.watchMinutes+'min',stream_supported:'Supported',admin_add:'Admin +',admin_remove:'Admin -'};
    html += '<tr><td class="ts">' + new Date(a.timestamp).toLocaleTimeString() + '</td><td>' + (a.discordUsername||a.discordId.slice(-6)) + '</td>';
    html += '<td>' + (acts[a.action]||a.action) + '</td><td>' + (a.targetStreamer ? '<span class="badge pt">@' + a.targetStreamer + '</span>' : '-') + '</td>';
    html += '<td>' + (a.points>0?'<span class="badge pp">+'+a.points+'</span>':a.points<0?'<span class="badge ps">'+a.points+'</span>':'-') + '</td></tr>';
  });
  html += '</table></div>';

  document.getElementById('content').innerHTML = html;
})();
</script>

</body>
</html>`);
  } catch(e) { res.status(500).send('Error: ' + e.message); }
});

// ── WATCH TRACKING ──
router.post('/watch-start', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { discordId, streamer, tabId } = req.body;
  if (!discordId || !streamer) return res.json({ success: false });
  const key = tabId ? discordId+'_'+streamer+'_'+tabId : discordId+'_'+streamer;
  if (!watchSessions.has(key)) watchSessions.set(key, Date.now());
  res.json({ success: true });
});

router.post('/watch-end', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { discordId, discordUsername, streamer, tabId } = req.body;
  if (!discordId || !streamer) return res.json({ success: false });
  const key = tabId ? discordId+'_'+streamer+'_'+tabId : discordId+'_'+streamer;
  const start = watchSessions.get(key);
  if (!start) return res.json({ success: false });
  const minutes = Math.round((Date.now() - start) / 60000);
  watchSessions.delete(key);
  try {
    await Points.findOneAndUpdate({ discordId }, { $inc: { totalWatchMinutes: minutes }, $set: { discordUsername: discordUsername||'', lastActive: new Date() } }, { upsert: true });
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

// ── SUSPEND ──
router.post('/suspend', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false });
  const { discordId, duration, reason } = req.body;
  try {
    const suspendedUntil = duration !== 'permanent' ? new Date(Date.now() + parseInt(duration) * 3600000) : null;
    await Points.findOneAndUpdate({ discordId }, { $set: { suspended: true, suspendedUntil, suspendReason: reason||'' } }, { upsert: true });
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

// ── POINTS ──
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
    await Activity.create({ discordId, action: pts > 0 ? 'admin_add' : 'admin_remove', targetStreamer: reason||'Admin', points: pts });
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

module.exports = router;