// backend/queue/autoChatLoop.js

const {
getOpenedTabs
} = require(
'./queueManager'
);

const {
startChatLoop
} = require(
'../automation/chatSender'
);

const activeLoops =
new Map();

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
START AUTO CHAT LOOP
========================= */

async function startAutoChatLoop(){

console.log(
'[TWITCH FAM] TWITCH FAM AI LOOP STARTED'
);

while(true){

try{

const openedTabs =
getOpenedTabs();

/* =========================
NO TABS
========================= */

if(

!openedTabs ||
!openedTabs.length

){

await wait(5000);

continue;

}

/* =========================
START CHAT LOOPS
========================= */

for(const tab of openedTabs){

if(!tab) continue;

const streamer =
tab.streamer;

const page =
tab.page;

if(
!streamer ||
!page
){

continue;

}

/* =========================
ALREADY RUNNING
========================= */

if(
activeLoops.has(streamer)
){

continue;

}

console.log(
'STARTING AI CHAT:',
streamer
);

activeLoops.set(
streamer,
true
);

/* =========================
ASYNC LOOP
========================= */

(async()=>{

try{

await startChatLoop(

page,
streamer

);

}catch(err){

console.log(
'CHAT LOOP FAILED:',
err.message
);

}finally{

activeLoops.delete(
streamer
);

}

})();

}

/* =========================
LOOP DELAY
========================= */

await wait(10000);

}catch(err){

console.log(
'AUTO CHAT LOOP ERROR:',
err.message
);

await wait(10000);

}

}

}

/* =========================
GET ACTIVE LOOPS
========================= */

function getActiveLoops(){

return Array.from(
activeLoops.keys()
);

}

/* =========================
EXPORT
========================= */

module.exports = {

startAutoChatLoop,
getActiveLoops

};