// backend/database/mongodb.js

const mongoose =
require('mongoose');

/* =========================
CONNECT DATABASE
========================= */

async function connectDB(){

try{

await mongoose.connect(

process.env.MONGO_URI,

{

serverSelectionTimeoutMS:
5000

}

);

console.log(
'MongoDB connected'
);

}catch(err){

console.log(
'MONGODB ERROR:',
err.message
);

}

}

/* =========================
MONGOOSE EVENTS
========================= */

mongoose.connection.on(

'connected',

()=>{

console.log(
'[MONGODB] CONNECTION OPEN'
);

}

);

mongoose.connection.on(

'error',

err=>{

console.log(
'[MONGODB ERROR]',
err.message
);

}

);

mongoose.connection.on(

'disconnected',

()=>{

console.log(
'[MONGODB] DISCONNECTED'
);

}

);

/* =========================
EXPORT
========================= */

module.exports =
connectDB;