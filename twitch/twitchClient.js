// backend/twitch/twitchClient.js

const tmi =
require('tmi.js');

/* =========================
TWITCH CONFIG
========================= */

const twitchClient = new tmi.Client({

options:{

debug:false,

skipUpdatingEmotesets:true

},

connection:{

secure:true,

reconnect:true

},

identity:{

username:
process.env
.TWITCH_BOT_USERNAME,

password:
process.env
.TWITCH_OAUTH_TOKEN

},

channels:[

process.env
.TWITCH_CHANNEL

]

});

/* =========================
CONNECT
========================= */

async function connectTwitch(){

try{

await twitchClient.connect();

console.log(
'[TWITCH FAM] TWITCH IRC CONNECTED'
);

}catch(err){

console.log(
'TWITCH CONNECT ERROR:',
err.message
);

}

}

/* =========================
SEND MESSAGE
========================= */

async function sendMessage(
channel,
message
){

try{

if(!message){

return false;

}

await twitchClient.say(

channel,
message

);

console.log(
'TWITCH MESSAGE SENT:',
message
);

return true;

}catch(err){

console.log(
'TWITCH SEND ERROR:',
err.message
);

return false;

}

}

/* =========================
JOIN CHANNEL
========================= */

async function joinChannel(
channel
){

try{

await twitchClient.join(
channel
);

console.log(
'JOINED CHANNEL:',
channel
);

}catch(err){

console.log(
'JOIN CHANNEL ERROR:',
err.message
);

}

}

/* =========================
LEAVE CHANNEL
========================= */

async function leaveChannel(
channel
){

try{

await twitchClient.part(
channel
);

console.log(
'LEFT CHANNEL:',
channel
);

}catch(err){

console.log(
'LEAVE CHANNEL ERROR:',
err.message
);

}

}

/* =========================
EVENTS
========================= */

twitchClient.on(

'connected',

(
address,
port
)=>{

console.log(
'TWITCH CONNECTED:',
address,
port
);

}

);

twitchClient.on(

'message',

(
channel,
tags,
message,
self
)=>{

if(self) return;

console.log(

`[CHAT] ${tags.username}: ${message}`

);

}

);

twitchClient.on(

'disconnected',

reason=>{

console.log(
'TWITCH DISCONNECTED:',
reason
);

}

);

twitchClient.on(

'reconnect',

()=>{

console.log(
'TWITCH RECONNECTING'
);

}

);

/* =========================
EXPORT
========================= */

module.exports =

twitchClient;

module.exports.connectTwitch =
connectTwitch;

module.exports.sendMessage =
sendMessage;

module.exports.joinChannel =
joinChannel;

module.exports.leaveChannel =
leaveChannel;