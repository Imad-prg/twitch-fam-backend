// backend/automation/chatDetector.js

/* =========================
TWITCH SELECTORS
========================= */

const selectors = {

chatInput:
'textarea[data-a-target="chat-input"]',

sendButton:
'button[data-a-target="chat-send-button"]',

chatMessages:
'.chat-line__message',

viewerCard:
'.viewer-card-layer',

followButton:
'[data-a-target="follow-button"]',

subscribeButton:
'[data-a-target="subscribe-button"]',

streamTitle:
'[data-a-target="stream-title"]',

offlineScreen:
'.channel-root__offline-channel-container',

matureOverlay:
'[data-a-target="player-overlay-mature-accept"]',

chatRoom:
'.chat-room',

slowMode:
'.chat-input__buttons-container',

emoteButton:
'[data-a-target="emote-picker-button"]'

};

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
BYPASS MATURE WARNING
========================= */

async function bypassMatureWarning(
page
){

try{

const matureButton =
await page.$(
selectors.matureOverlay
);

if(matureButton){

await matureButton.click();

console.log(
'MATURE WARNING ACCEPTED'
);

await wait(3000);

}

}catch(err){

console.log(
'MATURE WARNING ERROR:',
err.message
);

}

}

/* =========================
DETECT OFFLINE
========================= */

async function isOffline(
page
){

try{

const offline =
await page.$(
selectors.offlineScreen
);

return !!offline;

}catch(err){

return false;

}

}

/* =========================
DETECT CHAT
========================= */

async function detectChat(
page
){

try{

await page.waitForSelector(

selectors.chatInput,

{

timeout:25000

}

);

console.log(
'TWITCH CHAT DETECTED'
);

return true;

}catch(err){

console.log(
'CHAT NOT FOUND'
);

return false;

}

}

/* =========================
GET STREAM TITLE
========================= */

async function getStreamTitle(
page
){

try{

const title =
await page.$eval(

selectors.streamTitle,

el=>el.innerText

);

return title;

}catch(err){

return 'Unknown Stream';

}

}

/* =========================
GET RECENT CHAT
========================= */

async function getRecentChatMessages(
page
){

try{

const messages =
await page.evaluate(

(selector)=>{

const elements =

document.querySelectorAll(
selector
);

return Array.from(elements)

.slice(-15)

.map(
el=>el.innerText
)

.filter(Boolean);

},

selectors.chatMessages

);

return messages;

}catch(err){

console.log(
'CHAT READ ERROR:',
err.message
);

return [];

}

}

/* =========================
CHAT INFOS
========================= */

async function getChatInfos(
page
){

try{

const infos =
await page.evaluate(()=>{

return {

slowMode:

document.body.innerText
.toLowerCase()
.includes('slow mode'),

followersOnly:

document.body.innerText
.toLowerCase()
.includes('followers-only'),

subscribersOnly:

document.body.innerText
.toLowerCase()
.includes('subscribers-only')

};

});

return infos;

}catch(err){

return {

slowMode:false,
followersOnly:false,
subscribersOnly:false

};

}

}

/* =========================
OPEN EMOTES
========================= */

async function openEmotePicker(
page
){

try{

const button =
await page.$(
selectors.emoteButton
);

if(button){

await button.click();

console.log(
'EMOTE PICKER OPENED'
);

return true;

}

return false;

}catch(err){

console.log(
'EMOTE PICKER ERROR:',
err.message
);

return false;

}

}

/* =========================
FULL CHAT DETECTION
========================= */

async function analyzeChat(
page
){

try{

await bypassMatureWarning(
page
);

const offline =
await isOffline(
page
);

if(offline){

console.log(
'STREAM OFFLINE'
);

return {

success:false,
offline:true

};

}

const chatDetected =
await detectChat(
page
);

if(!chatDetected){

return {

success:false,
chat:false

};

}

const title =
await getStreamTitle(
page
);

const recentMessages =
await getRecentChatMessages(
page
);

const infos =
await getChatInfos(
page
);

return {

success:true,

title,

recentMessages,

infos

};

}catch(err){

console.log(
'CHAT ANALYZE ERROR:',
err.message
);

return {

success:false

};

}

}

/* =========================
EXPORT
========================= */

module.exports = {

selectors,
detectChat,
isOffline,
analyzeChat,
getRecentChatMessages,
getChatInfos,
openEmotePicker,
bypassMatureWarning

};