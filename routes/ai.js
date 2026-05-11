// backend/routes/ai.js

const express =
require('express');

const router =
express.Router();

const {
getAIMessage,
generateSafeChatMessage,
generateQueueMessage
} = require(
'../ai/gemini'
);

/* =========================
TEST AI
========================= */

router.get(

'/test',

async(req,res)=>{

try{

const response =
await getAIMessage(

'Generate one short Twitch chat message.'

);

return res.json({

success:true,

message:response

});

}catch(err){

console.log(
'AI TEST ERROR:',
err.message
);

return res.status(500).json({

success:false

});

}

}

/* =========================
GENERATE CHAT MESSAGE
========================= */

);

router.post(

'/chat',

async(req,res)=>{

try{

const {
streamer,
messages
} = req.body;

const response =
await generateSafeChatMessage(

streamer || 'twitch streamer',

messages || []

);

return res.json({

success:true,

message:response

});

}catch(err){

console.log(
'AI CHAT ERROR:',
err.message
);

return res.status(500).json({

success:false

});

}

}

/* =========================
QUEUE MESSAGE
========================= */

);

router.post(

'/queue',

async(req,res)=>{

try{

const {
streamer
} = req.body;

const response =
await generateQueueMessage(

streamer || 'streamer'

);

return res.json({

success:true,

message:response

});

}catch(err){

console.log(
'QUEUE AI ERROR:',
err.message
);

return res.status(500).json({

success:false

});

}

}

/* =========================
CUSTOM PROMPT
========================= */

);

router.post(

'/prompt',

async(req,res)=>{

try{

const {
prompt
} = req.body;

if(!prompt){

return res.status(400).json({

success:false,

message:
'Missing prompt'

});

}

const response =
await getAIMessage(
prompt
);

return res.json({

success:true,

response

});

}catch(err){

console.log(
'PROMPT AI ERROR:',
err.message
);

return res.status(500).json({

success:false

});

}

}

/* =========================
EXPORT
========================= */

);

module.exports =
router;