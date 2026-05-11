const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({

    username: String,

    twitchId: String,

    avatar: String,

    discordId: String,

    aiEnabled: {
        type: Boolean,
        default: false
    },

    queueEnabled: {
        type: Boolean,
        default: false
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports =
    mongoose.model(
        'User',
        UserSchema
    );