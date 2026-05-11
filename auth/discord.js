// backend/auth/discord.js

const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;

/* =========================
DISCORD STRATEGY
========================= */

passport.use(new DiscordStrategy(
  {
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'guilds', 'guilds.members.read']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('DISCORD LOGIN:', profile.username);

      const GUILD_ID = process.env.DISCORD_GUILD_ID;
      const REQUIRED_ROLE = process.env.DISCORD_REQUIRED_ROLE || 'whitelisted';

      /* =========================
      GUILD CHECK
      ========================= */

      if (GUILD_ID) {
        // Fetch member info from guild
        const memberRes = await fetch(
          `https://discord.com/api/v10/users/@me/guilds/${GUILD_ID}/member`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );

        if (!memberRes.ok) {
          console.log('DISCORD: User not in required guild');
          return done(null, false, { message: 'not_in_guild' });
        }

        const memberData = await memberRes.json();

        /* =========================
        ROLE CHECK
        ========================= */

        const ROLE_ID = process.env.DISCORD_ROLE_ID;

        if (ROLE_ID) {
          const hasRole = memberData.roles && memberData.roles.includes(ROLE_ID);
          if (!hasRole) {
            console.log('DISCORD: User missing required role:', REQUIRED_ROLE);
            return done(null, false, { message: 'missing_role' });
          }
        }

        profile.guildMember = memberData;
      }

      profile.accessToken = accessToken;
      return done(null, profile);

    } catch (err) {
      console.error('DISCORD AUTH ERROR:', err.message);
      return done(err);
    }
  }
));

/* =========================
SERIALIZE
========================= */

passport.serializeUser((user, done) => {
  done(null, user);
});

/* =========================
DESERIALIZE
========================= */

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

/* =========================
EXPORT
========================= */

module.exports = passport;
