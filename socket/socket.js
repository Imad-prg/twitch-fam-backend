// backend/socket/socket.js

const {
Server
} = require(
'socket.io'
);

let io;

/* =========================
INIT SOCKET
========================= */

function initSocket(
server
){

io = new Server(server,{

cors:{

origin:'*',

methods:[
'GET',
'POST'
]

}

});

console.log(
'[TWITCH FAM] SOCKET SYSTEM INITIALIZED'
);

/* =========================
CONNECTION
========================= */

io.on(

'connection',

socket=>{

console.log(
'FRONTEND CONNECTED:',
socket.id
);

/* =========================
CLIENT READY
========================= */

socket.on(

'client:ready',

data=>{

console.log(
'CLIENT READY:',
data
);

socket.emit(

'notification:new',

{

title:
'TWITCH FAM',

desc:
'Realtime connection established'

}

);

}

/* =========================
QUEUE UPDATE
========================= */

);

socket.on(

'queue:update',

data=>{

io.emit(

'metrics:update',

{

live:
data.live || 0,

queue:
data.queue || 0,

ai:
data.ai || 0

}

);

}

/* =========================
ACTIVITY
========================= */

);

socket.on(

'activity:new',

data=>{

io.emit(

'activity:new',

{

title:
data.title,

desc:
data.desc

}

);

}

/* =========================
TERMINAL
========================= */

);

socket.on(

'terminal:event',

data=>{

io.emit(

'terminal:event',

{

tag:
data.tag,

message:
data.message,

color:
data.color || '#00ffff'

}

);

}

/* =========================
DISCONNECT
========================= */

);

socket.on(

'disconnect',

()=>{

console.log(
'CLIENT DISCONNECTED:',
socket.id
);

}

);

}

);

return io;

}

/* =========================
GET IO
========================= */

function getIO(){

return io;

}

/* =========================
EMIT NOTIFICATION
========================= */

function emitNotification(
title,
desc
){

if(!io) return;

io.emit(

'notification:new',

{

title,
desc

}

);

}

/* =========================
EMIT ACTIVITY
========================= */

function emitActivity(
title,
desc
){

if(!io) return;

io.emit(

'activity:new',

{

title,
desc

}

);

}

/* =========================
EMIT TERMINAL
========================= */

function emitTerminal(
tag,
message,
color='#00ffff'
){

if(!io) return;

io.emit(

'terminal:event',

{

tag,
message,
color

}

);

}

/* =========================
EMIT METRICS
========================= */

function emitMetrics(
metrics
){

if(!io) return;

io.emit(

'metrics:update',

metrics

);

}

/* =========================
EXPORT
========================= */

module.exports = {

initSocket,
getIO,
emitNotification,
emitActivity,
emitTerminal,
emitMetrics

};