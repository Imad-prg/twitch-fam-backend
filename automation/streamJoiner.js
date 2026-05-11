// backend/automation/streamJoiner.js

const puppeteer =
require('puppeteer-core');

const {
analyzeChat
} = require(
'./chatDetector'
);

/* =========================
BROWSER
========================= */

let browser;

/* =========================
OPENED PAGES
========================= */

const openedPages =
[];

/* =========================
CHROME PATH
========================= */

const CHROME_PATH =

'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/* =========================
START BROWSER
========================= */

async function startBrowser(){

try{

browser =
await puppeteer.launch({

headless:false,

executablePath:
CHROME_PATH,

defaultViewport:null,

args:[

'--start-maximized',

'--disable-web-security',

'--disable-features=site-per-process',

'--no-sandbox',

'--disable-setuid-sandbox',

'--mute-audio'

]

});

console.log(
'BROWSER STARTED'
);

}catch(err){

console.log(
'BROWSER START ERROR:',
err.message
);

}

}

/* =========================
JOIN STREAM
========================= */

async function joinStream(
streamer
){

if(!browser){

console.log(
'BROWSER NOT READY'
);

return null;

}

let page;

try{

/* =========================
NEW PAGE
========================= */

page =
await browser.newPage();

/* =========================
VIEWPORT
========================= */

await page.setViewport({

width:1280,
height:720

});

/* =========================
USER AGENT
========================= */

await page.setUserAgent(

'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'

);

/* =========================
NAVIGATE
========================= */

await page.goto(

`https://www.twitch.tv/${streamer}`,

{

waitUntil:'domcontentloaded',

timeout:60000

}

);

console.log(
'JOINED STREAM:',
streamer
);

/* =========================
WAIT PAGE
========================= */

await wait(6000);

/* =========================
MUTE
========================= */

try{

await page.keyboard.press(
'm'
);

}catch(err){}

/* =========================
ANALYZE CHAT
========================= */

const chatAnalysis =
await analyzeChat(
page
);

console.log(
'CHAT ANALYSIS:',
chatAnalysis
);

/* =========================
OFFLINE
========================= */

if(
chatAnalysis.offline
){

console.log(
'STREAM OFFLINE:',
streamer
);

await page.close();

return null;

}

/* =========================
SAVE PAGE
========================= */

openedPages.push({

streamer,
page,
joinedAt:
Date.now()

});

console.log(
'STREAM OPENED:',
streamer
);

return page;

}catch(err){

console.log(

'JOIN STREAM ERROR:',
streamer,
err.message

);

if(page){

try{

await page.close();

}catch(e){}

}

return null;

}

}

/* =========================
CLOSE STREAM
========================= */

async function closeStream(
streamer
){

try{

const index =

openedPages.findIndex(
p=>p.streamer === streamer
);

if(index === -1){

return false;

}

await openedPages[index]
.page.close();

openedPages.splice(
index,
1
);

console.log(
'STREAM CLOSED:',
streamer
);

return true;

}catch(err){

console.log(
'CLOSE STREAM ERROR:',
err.message
);

return false;

}

}

/* =========================
GET OPENED STREAMS
========================= */

function getOpenedStreams(){

return openedPages;

}

/* =========================
CLOSE BROWSER
========================= */

async function closeBrowser(){

try{

if(browser){

await browser.close();

console.log(
'BROWSER CLOSED'
);

}

}catch(err){

console.log(err);

}

}

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
EXPORT
========================= */

module.exports = {

startBrowser,
joinStream,
closeStream,
closeBrowser,
getOpenedStreams

};  