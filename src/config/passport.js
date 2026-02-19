const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('./env');
const UserService = require('../services/UserService');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

if (config.google.clientID) {
  passport.use(new GoogleStrategy({
    clientID: config.google.clientID,
    clientSecret: config.google.clientSecret,
    callbackURL: config.google.callbackURL,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await UserService.findOrCreateFromGoogle(profile);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }));
} else {
  console.warn('⚠️  Google OAuth not configured — set GOOGLE_CLIENT_ID in .env');
}

module.exports = passport;

