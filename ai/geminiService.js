// backend/ai/gemini.js

const {
GoogleGenerativeAI
} = require(
'@google/generative-ai'
);

/* =========================
CONFIG
========================= */

const GEMINI_API_KEY =
process.env.GEMINI_API_KEY;

/* =========================
INIT GEMINI
========================= */

const genAI =
new GoogleGenerativeAI(
GEMINI_API_KEY
);

/* =========================
MODEL
========================= */

const model =
genAI.getGenerativeModel({

model:'gemini-1.5-flash'

});

/* =========================
GENERATE AI MESSAGE
========================= */

async function getAIMessage(
prompt
){

try{

if(!GEMINI_API_KEY){

console.log(
'GEMINI API KEY MISSING'
);

return null;

}

const result =
await model.generateContent(
prompt
);

const response =
await result.response;

const text =
response.text();

if(!text){

return null;

}

return cleanMessage(
text
);

}catch(err){

console.log(
'GEMINI ERROR:',
err.message
);

return null;

}

}

/* =========================
CLEAN MESSAGE
========================= */

function cleanMessage(
message
){

if(!message) return '';

return message

.replace(/"/g,'')
.replace(/\n/g,' ')
.replace(/\s+/g,' ')
.trim()

.slice(0,120);

}

/* =========================
SAFE CHAT MESSAGE
========================= */

async function generateSafeChatMessage(
streamer,
recentMessages = []
){

try{

const prompt = `

You are a REAL Twitch viewer chatting naturally.

Generate ONE Twitch chat message.

STRICT RULES:
- max 10 words
- no cringe
- no spam
- no bot behavior
- natural human Twitch message
- occasional emotes allowed
- lowercase preferred
- NEVER mention AI
- NEVER repeat same structure

Streamer:
${streamer}

Recent Chat:
${recentMessages.join('\n')}

`;

const response =
await getAIMessage(
prompt
);

if(!response){

return null;

}

return response;

}catch(err){

console.log(
'SAFE MESSAGE ERROR:',
err.message
);

return null;

}

}

/* =========================
QUEUE AI MESSAGE
========================= */

async function generateQueueMessage(
streamer
){

try{

const prompt = `

Generate ONE Twitch viewer message
for streamer "${streamer}".

Style:
- short
- hype
- human
- twitch style
- realistic

`;

return await getAIMessage(
prompt
);

}catch(err){

console.log(err);

return null;

}

}

/* =========================
EXPORT
========================= */

module.exports = {

getAIMessage,
generateSafeChatMessage,
generateQueueMessage

};