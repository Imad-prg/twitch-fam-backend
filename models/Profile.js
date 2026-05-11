const mongoose =
require('mongoose');

const ProfileSchema =
new mongoose.Schema({

discordId:{
type:String,
required:true
},

discordUsername:{
type:String
},

twitchChannel:{
type:String
},

geminiKey:{
type:String
},

chatMood:{
type:String,
default:'friendly'
},

emojiMode:{
type:String,
default:'medium'
},

minDelay:{
type:Number,
default:20
},

maxDelay:{
type:Number,
default:70
},

createdAt:{
type:Date,
default:Date.now
}

});

module.exports =
mongoose.model(
'Profile',
ProfileSchema
);