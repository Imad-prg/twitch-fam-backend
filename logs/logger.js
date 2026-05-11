// backend/logs/logger.js

const fs =
require('fs');

const path =
require('path');

/* =========================
LOG DIRECTORY
========================= */

const LOG_DIR =

path.join(
__dirname,
'storage'
);

/* =========================
CREATE LOG DIR
========================= */

if(
!fs.existsSync(LOG_DIR)
){

fs.mkdirSync(LOG_DIR,{

recursive:true

});

}

/* =========================
LOG FILE
========================= */

const LOG_FILE =

path.join(
LOG_DIR,
'twitchfam.log'
);

/* =========================
TIME
========================= */

function getTime(){

return new Date()
.toLocaleTimeString();

}

/* =========================
WRITE FILE
========================= */

function writeFile(
line
){

try{

fs.appendFileSync(

LOG_FILE,

line + '\n'

);

}catch(err){

console.log(
'LOG FILE ERROR:',
err.message
);

}

}

/* =========================
BASE LOG
========================= */

function log(
message
){

const line =

`[${getTime()}] ${message}`;

console.log(
line
);

writeFile(
line
);

}

/* =========================
INFO
========================= */

function info(
message
){

log(
`[INFO] ${message}`
);

}

/* =========================
WARN
========================= */

function warn(
message
){

log(
`[WARN] ${message}`
);

}

/* =========================
ERROR
========================= */

function error(
message
){

log(
`[ERROR] ${message}`
);

}

/* =========================
SYSTEM
========================= */

function system(
message
){

log(
`[SYSTEM] ${message}`
);

}

/* =========================
QUEUE
========================= */

function queue(
message
){

log(
`[QUEUE] ${message}`
);

}

/* =========================
AI
========================= */

function ai(
message
){

log(
`[AI] ${message}`
);

}

/* =========================
TWITCH
========================= */

function twitch(
message
){

log(
`[TWITCH] ${message}`
);

}

/* =========================
EXPORT
========================= */

module.exports = {

log,
info,
warn,
error,
system,
queue,
ai,
twitch

};