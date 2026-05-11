// backend/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const session = require('express-session');
const passport = require('./auth/discord');
const connectDB = require('./database/mongodb');
const statsRoute = require('./routes/stats');
const authRoute = require('./routes/auth');
const profileRoute = require('./routes/profile');
const aiRoute = require('./routes/ai');
const liveRoute = require('./routes/live');
const { initSocket } = require('./socket/socket');
const twitchClient = require('./twitch/twitchClient');
const { startAutoChatLoop } = require('./queue/autoChatLoop');
const { startRealtimeMetrics } = require('./metrics/realtimeMetrics');
const { processQueue } = require('./queue/queueManager');
const { log } = require('./logs/logger');

const app = express();
const server = http.createServer(app);

// DB
connectDB();

// CORS — allow extension and Railway
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for Railway HTTPS
app.set('trust proxy', 1);

// SESSION
app.use(session({
  secret: process.env.SESSION_SECRET || 'twitchfamsecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// PASSPORT
app.use(passport.initialize());
app.use(passport.session());

// STATIC
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

// ROUTES
app.use('/stats', statsRoute);
app.use('/auth', authRoute);
app.use('/profile', profileRoute);
app.use('/ai', aiRoute);
app.use('/live', liveRoute);

// ROOT
app.get('/', (req, res) => {
  res.json({ project: 'TWITCH FAM', status: 'online' });
});

// HEALTH
app.get('/health', (req, res) => {
  res.json({ success: true, uptime: process.uptime() });
});

// SOCKET
const io = initSocket(server);
io.on('connection', (socket) => {
  log('Frontend connected');
  socket.emit('notification:new', { title: 'TWITCH FAM', desc: 'Connected' });

  const metricsLoop = setInterval(() => {
    socket.emit('metrics:update', {
      live: Math.floor(Math.random() * 8) + 4,
      queue: Math.floor(Math.random() * 80) + 20,
      ai: Math.floor(Math.random() * 100)
    });
  }, 7000);

  socket.on('disconnect', () => { clearInterval(metricsLoop); });
});

// TWITCH
const twitchEnabled = process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && process.env.TWITCH_CHANNEL;
if (twitchEnabled) {
  twitchClient.connect().then(() => { log('TWITCH CHAT CONNECTED'); startAutoChatLoop(); }).catch(e => console.log('TWITCH:', e.message));
}

// START
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  log('Backend running');
  startRealtimeMetrics();
  processQueue();
  console.log(`TWITCH FAM BACKEND STARTED ON PORT ${PORT}`);
});
