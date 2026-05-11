// backend/queue/queueManager.js

const {
joinStream,
closeStream,
getOpenedStreams
} = require(
'../automation/streamJoiner'
);

/* =========================
QUEUE
========================= */

let queue = [];

let liveStreamersList = [];

let processing = false;

/* =========================
SETTINGS
========================= */

const SETTINGS = {

maxOpenedTabs:6,

delayBetweenJoins:8000,

autoCloseOffline:true

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
ADD TO QUEUE
========================= */

function addToQueue(
streamer
){

if(!streamer) return;

/* =========================
ALREADY QUEUED
========================= */

if(
queue.includes(streamer)
){

return;

}

/* =========================
ALREADY OPENED
========================= */

const opened =
getOpenedStreams();

const alreadyOpened =

opened.find(
s=>s.streamer === streamer
);

if(alreadyOpened){

return;

}

queue.push(streamer);

console.log(
'ADDED TO QUEUE:',
streamer
);

sendQueueUpdate();

}

/* =========================
REMOVE FROM QUEUE
========================= */

function removeFromQueue(
streamer
){

queue = queue.filter(
s=>s !== streamer
);

sendQueueUpdate();

}

/* =========================
CLEAR QUEUE
========================= */

function clearQueue(){

queue = [];

sendQueueUpdate();

}

/* =========================
PROCESS QUEUE
========================= */

async function processQueue(){

if(processing){

return;

}

processing = true;

console.log(
'QUEUE PROCESS STARTED'
);

while(true){

try{

/* =========================
NOTHING TO PROCESS
========================= */

if(queue.length <= 0){

await wait(4000);

continue;

}

/* =========================
OPENED STREAMS
========================= */

const opened =
getOpenedStreams();

/* =========================
LIMIT
========================= */

if(

opened.length >=
SETTINGS.maxOpenedTabs

){

console.log(
'MAX OPENED STREAMS REACHED'
);

await wait(10000);

continue;

}

/* =========================
NEXT STREAM
========================= */

const streamer =
queue.shift();

if(!streamer){

await wait(3000);

continue;

}

console.log(
'PROCESSING:',
streamer
);

/* =========================
JOIN STREAM
========================= */

const page =
await joinStream(
streamer
);

/* =========================
SUCCESS
========================= */

if(page){

console.log(
'STREAM SUCCESS:',
streamer
);

}else{

console.log(
'STREAM FAILED:',
streamer
);

}

/* =========================
UPDATE
========================= */

sendQueueUpdate();

/* =========================
DELAY
========================= */

await wait(
SETTINGS.delayBetweenJoins
);

}catch(err){

console.log(
'QUEUE PROCESS ERROR:',
err.message
);

await wait(10000);

}

}

}

/* =========================
AUTO CLEAN
========================= */

async function autoCleanOfflineStreams(){

while(true){

try{

const opened =
getOpenedStreams();

for(const stream of opened){

if(!stream) continue;

const page =
stream.page;

const streamer =
stream.streamer;

try{

const title =
await page.title();

if(

title
.toLowerCase()
.includes('offline')

){

console.log(
'OFFLINE DETECTED:',
streamer
);

await closeStream(
streamer
);

}

}catch(err){

console.log(
'AUTO CLEAN ERROR:',
err.message
);

}

}

/* =========================
WAIT
========================= */

await wait(30000);

}catch(err){

console.log(
'AUTO CLEAN LOOP ERROR:',
err.message
);

await wait(30000);

}

}

}

/* =========================
QUEUE STATS
========================= */

function getQueueStats(){

return {

queued:
queue.length,

opened:
getOpenedStreams().length,

processing

};

}

/* =========================
GETTERS
========================= */

function getQueue(){

return queue;

}

function getOpenedTabs(){

return getOpenedStreams();

}

/* =========================
QUEUE UPDATE
========================= */

function sendQueueUpdate(){

const stats =
getQueueStats();

console.log({

queue:
stats.queued,

opened:
stats.opened,

processing:
stats.processing

});

}

/* =========================
EXPORT
========================= */

function setLiveStreamers(list){ liveStreamersList = list || []; }

module.exports = {

addToQueue,
removeFromQueue,
clearQueue,
processQueue,
autoCleanOfflineStreams,
getQueue,
getOpenedTabs,
getQueueStats

};