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

// Watch session tracking (in memory)
const watchSessions = new Map(); // `${discordId}_${streamer}` -> startTime

const loginPage = (error = '') => `<!DOCTYPE html>
<html>
<head><title>TWITCH FAM — Admin</title><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#0e1021;display:flex;justify-content:center;align-items:center;height:100vh;font-family:'Segoe UI',sans-serif;}
.box{background:#151929;border:1px solid #1f2640;border-radius:16px;padding:40px;width:340px;}
.icon{font-size:40px;text-align:center;margin-bottom:16px;}
.logo{font-size:22px;font-weight:900;background:linear-gradient(90deg,#9146FF,#00d4c8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px;}
.sub{font-size:11px;color:#4a5270;margin-bottom:28px;letter-spacing:1px;text-transform:uppercase;}
label{font-size:10px;font-weight:700;color:#7a85a8;letter-spacing:0.8px;text-transform:uppercase;display:block;margin-bottom:5px;}
input{width:100%;background:#0d0f1e;border:1px solid #1f2640;border-radius:8px;padding:10px 12px;color:#dde3f5;font-size:13px;outline:none;margin-bottom:14px;font-family:inherit;}
input:focus{border-color:#9146FF;}
button{width:100%;background:#9146FF;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;}
button:hover{background:#7c3aed;}
.error{color:#f87171;font-size:12px;margin-bottom:12px;text-align:center;}
</style></head>
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
</body></html>`;

router.get('/login', (req, res) => res.send(loginPage()));
router.get('/', (req, res) => res.redirect('/admin/login'));

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

// Track watch session start
router.post('/watch-start', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { discordId, streamer, tabId } = req.body;
  if (!discordId || !streamer) return res.json({ success: false });
  // Use tabId to prevent double counting same tab
  const key = tabId ? `${discordId}_${streamer}_${tabId}` : `${discordId}_${streamer}`;
  if (!watchSessions.has(key)) {
    watchSessions.set(key, Date.now());
  }
  res.json({ success: true });
});

// Track watch session end + save minutes
router.post('/watch-end', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { discordId, discordUsername, streamer, tabId } = req.body;
  if (!discordId || !streamer) return res.json({ success: false });
  const key = tabId ? `${discordId}_${streamer}_${tabId}` : `${discordId}_${streamer}`;
  const start = watchSessions.get(key);
  if (!start) return res.json({ success: false, error: 'No session' });
  
  const minutes = Math.round((Date.now() - start) / 60000);
  watchSessions.delete(key);

  try {
    await Points.findOneAndUpdate(
      { discordId },
      { 
        $inc: { totalWatchMinutes: minutes },
        $set: { discordUsername: discordUsername || '', lastActive: new Date() }
      },
      { upsert: true }
    );
    await Activity.create({ discordId, discordUsername, action: 'watch_session', targetStreamer: streamer, watchMinutes: minutes, points: 0 });
    res.json({ success: true, minutes });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// Get watch stats for a specific streamer
router.get('/watch-stats/:streamer', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false });
  try {
    const stats = await Activity.aggregate([
      { $match: { action: 'watch_session', targetStreamer: req.params.streamer } },
      { $group: { _id: '$discordId', discordUsername: { $last: '$discordUsername' }, totalMinutes: { $sum: '$watchMinutes' } } },
      { $sort: { totalMinutes: -1 } }
    ]);
    res.json({ success: true, streamer: req.params.streamer, viewers: stats });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

// Suspend/Unsuspend
router.post('/suspend', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false });
  const { discordId, duration, reason } = req.body;
  try {
    let suspendedUntil = null;
    if (duration !== 'permanent') {
      suspendedUntil = new Date(Date.now() + parseInt(duration) * 3600000);
    }
    await Points.findOneAndUpdate({ discordId }, { $set: { suspended: true, suspendedUntil, suspendReason: reason || '' } }, { upsert: true });
    res.json({ success: true });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

router.post('/unsuspend', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false });
  const { discordId } = req.body;
  try {
    await Points.findOneAndUpdate({ discordId }, { $set: { suspended: false, suspendedUntil: null, suspendReason: '' } });
    res.json({ success: true });
  } catch(e) { res.json({ success: false, error: e.message }); }
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

// Award points
router.post('/award-points', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { discordId, discordUsername, twitchUsername, action, targetStreamer } = req.body;
  if (!discordId) return res.json({ success: false });
  try {
    const existing = await Points.findOne({ discordId });
    if (existing?.suspended) {
      if (!existing.suspendedUntil || new Date() < existing.suspendedUntil) return res.json({ success: false, suspended: true });
      await Points.findOneAndUpdate({ discordId }, { $set: { suspended: false, suspendedUntil: null } });
    }
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
  } catch(e) { res.json({ success: false, error: e.message }); }
});

// Adjust points manually
router.post('/adjust-points', async (req, res) => {
  if (!req.session?.adminAuth) return res.json({ success: false, error: 'Unauthorized' });
  const { discordId, amount, reason } = req.body;
  if (!discordId || amount === undefined) return res.json({ success: false });
  try {
    const pts = parseInt(amount);
    const user = await Points.findOneAndUpdate(
      { discordId },
      { $inc: { points: pts } },
      { new: true }
    );
    await Activity.create({ discordId, action: pts > 0 ? 'admin_add' : 'admin_remove', targetStreamer: reason || 'Admin adjustment', points: pts });
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
    const users = await Profile.find({ twitchAttached: true });
    const leaderboard = await Points.find().sort({ points: -1 });
    const recentActivity = await Activity.find().sort({ timestamp: -1 }).limit(50);
    await Points.updateMany({ suspended: true, suspendedUntil: { $lt: new Date() } }, { $set: { suspended: false, suspendedUntil: null } });

    res.send(`<!DOCTYPE html>
<html>
<head>
<title>TWITCH FAM — Admin</title>
<meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#0e1021;color:#dde3f5;font-family:'Segoe UI',sans-serif;}
.header{background:#151929;padding:20px 30px;border-bottom:1px solid #1f2640;display:flex;align-items:center;justify-content:space-between;}
.logo{font-size:22px;font-weight:900;background:linear-gradient(90deg,#9146FF,#00d4c8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.sub{font-size:11px;color:#4a5270;letter-spacing:1px;text-transform:uppercase;margin-top:4px;}
.logout-btn{background:transparent;border:1px solid #1f2640;color:#7a85a8;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none;}
.logout-btn:hover{border-color:#9146FF;color:#dde3f5;}
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
.dot{width:8px;height:8px;border-radius:50%;background:#23d18b;display:inline-block;margin-right:6px;}
.time{font-size:11px;color:#4a5270;}
.btn-sm{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:none;font-family:inherit;margin-left:4px;}
.btn-suspend{background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.3);}
.btn-unsuspend{background:rgba(35,209,139,0.15);color:#23d18b;border:1px solid rgba(35,209,139,0.3);}
.btn-watch{background:rgba(145,70,255,0.15);color:#9146FF;border:1px solid rgba(145,70,255,0.3);}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:1000;justify-content:center;align-items:center;}
.modal.show{display:flex;}
.modal-box{background:#151929;border:1px solid #1f2640;border-radius:14px;padding:30px;width:420px;max-height:80vh;overflow-y:auto;}
.modal-box h3{font-size:16px;font-weight:700;margin-bottom:16px;}
.modal-box label{font-size:10px;font-weight:700;color:#7a85a8;text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:5px;}
.modal-box select,.modal-box input{width:100%;background:#0d0f1e;border:1px solid #1f2640;border-radius:8px;padding:9px 12px;color:#dde3f5;font-size:13px;outline:none;margin-bottom:14px;font-family:inherit;}
.modal-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;}
.btn-cancel{background:transparent;color:#7a85a8;border:1px solid #1f2640;padding:10px;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:600;}
.btn-confirm{background:#f87171;color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:700;}
.watch-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(31,38,64,0.5);}
.watch-name{font-size:13px;color:#dde3f5;}
.watch-time{font-size:13px;color:#00d4c8;font-weight:700;}
</style>
</head>
<body>

<!-- SUSPEND MODAL -->
<div class="modal" id="suspendModal">
  <div class="modal-box">
    <h3 style="color:#f87171">🚫 Suspend User</h3>
    <input type="hidden" id="suspendDiscordId">
    <label>Duration</label>
    <select id="suspendDuration">
      <option value="1">1 hour</option>
      <option value="6">6 hours</option>
      <option value="12">12 hours</option>
      <option value="24" selected>24 hours</option>
      <option value="48">2 days</option>
      <option value="72">3 days</option>
      <option value="168">1 week</option>
      <option value="permanent">Permanent</option>
    </select>
    <label>Reason (optional)</label>
    <input type="text" id="suspendReason" placeholder="e.g. Spam, abuse...">
    <div class="modal-row">
      <button class="btn-cancel" onclick="closeSuspendModal()">Cancel</button>
      <button class="btn-confirm" onclick="confirmSuspend()">Suspend</button>
    </div>
  </div>
</div>

<!-- WATCH STATS MODAL -->
<div class="modal" id="watchModal">
  <div class="modal-box">
    <h3 style="color:#9146FF">👁️ Watch Stats — <span id="watchStreamerName"></span></h3>
    <p style="font-size:12px;color:#4a5270;margin-bottom:16px">Who watched this streamer and for how long</p>
    <div id="watchList">Loading...</div>
    <div style="margin-top:16px">
      <button class="btn-cancel" style="width:100%" onclick="closeWatchModal()">Close</button>
    </div>
  </div>
</div>

<div class="header">
  <div><div class="logo">TWITCH FAM</div><div class="sub">Admin Dashboard</div></div>
  <a href="/admin/logout" class="logout-btn">Logout</a>
</div>

<div class="stat-grid">
  <div class="stat"><div class="stat-val">${users.length}</div><div class="stat-lbl">Registered Users</div></div>
  <div class="stat"><div class="stat-val">${leaderboard.reduce((a,u)=>a+u.points,0).toLocaleString()}</div><div class="stat-lbl">Total Points</div></div>
  <div class="stat"><div class="stat-val">${leaderboard.reduce((a,u)=>a+u.totalChats,0).toLocaleString()}</div><div class="stat-lbl">Total Chats</div></div>
  <div class="stat"><div class="stat-val">${Math.round(leaderboard.reduce((a,u)=>a+(u.totalWatchMinutes||0),0)/60)}h</div><div class="stat-lbl">Total Watch Time</div></div>
</div>

<div class="content">
  <div class="card">
    <h2>👥 Registered Users (${users.length})</h2>
    <table>
      <tr><th>#</th><th>Discord</th><th>Twitch</th><th>Watch</th><th>Status</th><th>Actions</th></tr>
      ${users.map((u, i) => {
        const pts = leaderboard.find(p => p.discordId === u.discordId);
        const isSuspended = pts?.suspended;
        const watchMins = pts?.totalWatchMinutes || 0;
        const watchStr = watchMins >= 60 ? `${Math.floor(watchMins/60)}h${watchMins%60}m` : `${watchMins}m`;
        const until = pts?.suspendedUntil;
        return `<tr>
          <td>${i+1}</td>
          <td><span class="badge badge-discord">${u.discordId?.slice(-6)||'?'}</span></td>
          <td><span class="badge badge-twitch">@${u.twitchUsername||'?'}</span></td>
          <td><span style="color:#00d4c8;font-size:12px">⏱ ${watchStr}</span></td>
          <td>${isSuspended
            ? `<span class="badge badge-suspended">🚫 ${until ? new Date(until).toLocaleDateString() : '∞'}</span>`
            : `<span class="badge badge-active">✅ Active</span>`
          }</td>
          <td>
            <button class="btn-sm btn-watch" data-s="${u.twitchUsername||''}" onclick="showWatchStats(this.dataset.s)">👁️</button>
            ${isSuspended
              ? `<button class="btn-sm btn-unsuspend" data-id="${u.discordId}" onclick="unsuspend(this.dataset.id)">↩️</button>`
              : `<button class="btn-sm btn-suspend" data-id="${u.discordId}" onclick="openSuspendModal(this.dataset.id)">🚫</button>`
            }
          </td>
        </tr>`;
      }).join('')}
    </table>
  </div>

  <div class="card">
    <h2>🏆 Leaderboard</h2>
    <table>
      <tr><th>Rank</th><th>User</th><th>Points</th><th>Chats</th><th>Watch</th></tr>
      ${leaderboard.length === 0 ? '<tr><td colspan="5" style="color:#4a5270;text-align:center;padding:20px">No points yet</td></tr>' :
        leaderboard.map((u,i) => {
          const watchMins = u.totalWatchMinutes || 0;
          const watchStr = watchMins >= 60 ? `${Math.floor(watchMins/60)}h${watchMins%60}m` : `${watchMins}m`;
          return `<tr>
            <td class="rank">#${i+1}</td>
            <td>${u.discordUsername||u.discordId?.slice(-6)||'?'} ${u.twitchUsername?`<span class="badge badge-twitch">@${u.twitchUsername}</span>`:''}</td>
            <td>
              <span class="badge badge-pts">${u.points.toLocaleString()} pts</span>
              <button class="btn-sm" style="background:rgba(35,209,139,0.15);color:#23d18b;border:1px solid rgba(35,209,139,0.3)" data-id="${u.discordId}" data-pts="${u.points}" onclick="adjustPoints(this.dataset.id,this.dataset.id.slice(-6),this.dataset.pts)">✏️</button>
            </td>
            <td>${u.totalChats}</td>
            <td><span style="color:#00d4c8;font-size:12px">⏱ ${watchStr}</span></td>
          </tr>`;
        }).join('')}
    </table>
  </div>

  <div class="card full">
    <h2>📊 Recent Activity</h2>
    <table>
      <tr><th>Time</th><th>User</th><th>Action</th><th>Target</th><th>Points</th></tr>
      ${recentActivity.length === 0 ? '<tr><td colspan="5" style="color:#4a5270;text-align:center;padding:20px">No activity yet</td></tr>' :
        recentActivity.map(a => `<tr>
          <td class="time">${new Date(a.timestamp).toLocaleTimeString()}</td>
          <td>${a.discordUsername||a.discordId?.slice(-6)||'?'}</td>
          <td>${a.action==='chat_sent'?'💬 Chat':a.action==='stream_opened'?'🟢 Opened':a.action==='watch_session'?('⏱ Watched '+a.watchMinutes+'min'):a.action==='stream_supported'?'⭐ Supported':('❓ '+a.action)}</td>
          <td>${a.targetStreamer?`<span class="badge badge-twitch">@${a.targetStreamer}</span>`:'-'}</td>
          <td>${a.points>0?`<span class="badge badge-pts">+${a.points} pts</span>`:'-'}</td>
        </tr>`).join('')}
    </table>
  </div>
</div>

<script>
// Adjust Points Modal
function adjustPoints(discordId, username, currentPts) {
  const amount = prompt('Adjust points for ' + (username || discordId) + '\nCurrent: ' + currentPts + ' pts\n\nEnter amount (use - to remove, e.g. -50 or +100):');
  if (!amount) return;
  const num = parseInt(amount);
  if (isNaN(num)) { alert('Invalid number'); return; }
  const reason = prompt('Reason (optional):') || 'Manual adjustment';
  fetch('/admin/adjust-points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discordId, amount: num, reason })
  }).then(r => r.json()).then(d => {
    if (d.success) { alert('Done! New balance: ' + d.newPoints + ' pts'); location.reload(); }
    else alert('Error: ' + d.error);
  });
}

function openSuspendModal(discordId) {
  document.getElementById('suspendDiscordId').value = discordId;
  document.getElementById('suspendReason').value = '';
  document.getElementById('suspendModal').classList.add('show');
}
function closeSuspendModal() { document.getElementById('suspendModal').classList.remove('show'); }

async function confirmSuspend() {
  const discordId = document.getElementById('suspendDiscordId').value;
  const duration = document.getElementById('suspendDuration').value;
  const reason = document.getElementById('suspendReason').value;
  const r = await fetch('/admin/suspend', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discordId, duration, reason }) });
  const d = await r.json();
  if (d.success) { closeSuspendModal(); location.reload(); }
  else alert('Error: ' + d.error);
}

async function unsuspend(discordId) {
  if (!confirm('Unsuspend this user?')) return;
  const r = await fetch('/admin/unsuspend', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ discordId }) });
  const d = await r.json();
  if (d.success) location.reload();
}

async function showWatchStats(streamer) {
  if (!streamer) { alert('No Twitch username for this user'); return; }
  document.getElementById('watchStreamerName').textContent = '@' + streamer;
  document.getElementById('watchModal').classList.add('show');
  document.getElementById('watchList').innerHTML = 'Loading...';
  
  const r = await fetch('/admin/watch-stats/' + streamer);
  const d = await r.json();
  
  if (!d.viewers || d.viewers.length === 0) {
    document.getElementById('watchList').innerHTML = '<p style="color:#4a5270;text-align:center;padding:20px">No watch data yet</p>';
    return;
  }
  
  document.getElementById('watchList').innerHTML = d.viewers.map(function(v) {
    var mins = v.totalMinutes || 0;
    var timeStr = mins >= 60 ? Math.floor(mins/60) + 'h ' + (mins%60) + 'min' : mins + ' min';
    var name = v.discordUsername || (v._id ? v._id.slice(-6) : '?');
    return '<div class="watch-row"><span class="watch-name">' + name + '</span><span class="watch-time">\u23F1 ' + timeStr + '</span></div>';
  }).join('');
}

function closeWatchModal() { document.getElementById('watchModal').classList.remove('show'); }

setTimeout(() => location.reload(), 30000);
</script>
</body></html>`);
  } catch(e) { res.status(500).send('Error: ' + e.message); }
});

module.exports = router;