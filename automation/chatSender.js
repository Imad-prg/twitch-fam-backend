// backend/automation/chatSender.js

const {
getAIMessage
} = require(
'../ai/gemini'
);

/* =========================
TWITCH CHAT SELECTORS
========================= */

const CHAT_INPUT_SELECTOR =

'textarea[data-a-target="chat-input"]';

const SEND_BUTTON_SELECTOR =

'button[data-a-target="chat-send-button"]';

const CHAT_MESSAGE_SELECTOR =

'.chat-line__message';

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
RANDOM DELAY
========================= */

function randomDelay(
min,
max
){

return Math.floor(

Math.random() *

(max - min + 1)

) + min;

}

/* =========================
DETECT CHATBOX
========================= */

async function detectChatbox(
page
){

try{

await page.waitForSelector(

CHAT_INPUT_SELECTOR,

{

timeout:20000

}

);

console.log(
'CHATBOX DETECTED'
);

return true;

}catch(err){

console.log(
'CHATBOX NOT FOUND'
);

return false;

}

}

/* =========================
GET CHAT MESSAGES
========================= */

async function getRecentMessages(
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

.slice(-10)

.map(
el=>el.innerText
)

.filter(Boolean);

},

CHAT_MESSAGE_SELECTOR

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
SEND CHAT MESSAGE
========================= */

async function sendChatMessage(
page,
message
){

try{

const found =
await detectChatbox(
page
);

if(!found){

return false;

}

/* =========================
FOCUS CHAT
========================= */

await page.click(
CHAT_INPUT_SELECTOR
);

await wait(1000);

/* =========================
CLEAR INPUT
========================= */

await page.keyboard.down(
'Control'
);

await page.keyboard.press(
'A'
);

await page.keyboard.up(
'Control'
);

await page.keyboard.press(
'Backspace'
);

/* =========================
TYPE MESSAGE
========================= */

await page.type(

CHAT_INPUT_SELECTOR,

message,

{

delay:
randomDelay(
40,
120
)

}

);

/* =========================
RANDOM WAIT
========================= */

await wait(

randomDelay(
1000,
2500
)

);

/* =========================
SEND
========================= */

try{

await page.click(
SEND_BUTTON_SELECTOR
);

}catch(err){

await page.keyboard.press(
'Enter'
);

}

console.log(
'CHAT MESSAGE SENT:',
message
);

return true;

}catch(err){

console.log(
'SEND CHAT ERROR:',
err.message
);

return false;

}

}

/* =========================
GENERATE AI MESSAGE
========================= */

async function generateAIReply(
page,
streamer
){

try{

const recentMessages =
await getRecentMessages(
page
);

const prompt = `

You are a Twitch viewer.

Generate ONE short Twitch chat message.

Rules:
- natural
- short
- human
- no spam
- no cringe
- max 12 words
- use occasional emotes
- react to stream energy

Streamer:
${streamer}

Recent chat:
${recentMessages.join('\n')}

`;

const response =
await getAIMessage(
prompt
);

if(!response){

return null;

}

return response
.trim()
.replace(/"/g,'');

}catch(err){

console.log(
'AI GENERATION ERROR:',
err.message
);

return null;

}

}

/* =========================
AUTO CHAT LOOP
========================= */

async function startChatLoop(
page,
streamer
){

try{

console.log(
'CHAT LOOP STARTED:',
streamer
);

while(true){

/* =========================
RANDOM DELAY
========================= */

const delay =

randomDelay(
45000,
120000
);

console.log(
'WAITING:',
delay
);

await wait(delay);

/* =========================
GENERATE MESSAGE
========================= */

const message =
await generateAIReply(

page,
streamer

);

if(!message){

continue;

}

/* =========================
SEND MESSAGE
========================= */

await sendChatMessage(

page,
message

);

}

}catch(err){

console.log(
'CHAT LOOP ERROR:',
err.message
);

}

}

/* =========================
EXPORT
========================= */

module.exports = {

detectChatbox,
sendChatMessage,
getRecentMessages,
generateAIReply,
startChatLoop

};