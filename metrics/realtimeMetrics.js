// backend/metrics/realtimeMetrics.js

const {
getQueueStats
} = require(
'../queue/queueManager'
);

const {
getActiveLoops
} = require(
'../queue/autoChatLoop'
);

const {
emitMetrics,
emitActivity,
emitTerminal
} = require(
'../socket/socket'
);

/* =========================
WAIT
========================= */

function wait(ms){

return new Promise(
resolve=>{

setTimeout(
resolve,
ms
);

}
);

}

/* =========================
RANDOM VIEWERS
========================= */

function generateViewerCount(){

return Math.floor(

Math.random() * 500000

) + 10000;

}

/* =========================
START METRICS
========================= */

async function startRealtimeMetrics(){

console.log(
'[TWITCH FAM] REALTIME METRICS STARTED'
);

while(true){

try{

const queueStats =
getQueueStats();

const activeAI =
getActiveLoops();

/* =========================
METRICS
========================= */

const metrics = {

live:
queueStats.opened || 0,

queue:
queueStats.queued || 0,

ai:
activeAI.length || 0,

viewers:
generateViewerCount()

};

/* =========================
EMIT
========================= */

emitMetrics(
metrics
);

/* =========================
ACTIVITY
========================= */

const activities = [

'Twitch telemetry synchronized',
'Gemini AI response generated',
'Realtime stream metrics updated',
'Queue engine optimized',
'Stream latency recalibrated',
'Twitch activity analyzed',
'Chatbox detection active',
'Viewer analytics refreshed',
'AI engagement cycle completed'

];

const randomActivity =

activities[
Math.floor(
Math.random() *
activities.length
)
];

emitActivity(

'SYSTEM',

randomActivity

);

/* =========================
TERMINAL
========================= */

emitTerminal(

'[SYSTEM]',

randomActivity,

'#9146FF'

);

/* =========================
QUEUE STATUS
========================= */

emitTerminal(

'[QUEUE]',

`QUEUE=${queueStats.queued} OPENED=${queueStats.opened}`,

'#00ff88'

);

/* =========================
AI STATUS
========================= */

emitTerminal(

'[AI]',

`${activeAI.length} AI chat loops active`,

'#06b6d4'

);

/* =========================
WAIT
========================= */

await wait(7000);

}catch(err){

console.log(
'REALTIME METRICS ERROR:',
err.message
);

await wait(10000);

}

}

}

/* =========================
EXPORT
========================= */

module.exports = {

startRealtimeMetrics

};