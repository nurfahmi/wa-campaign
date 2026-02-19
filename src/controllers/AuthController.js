const passport = require('passport');
const UserService = require('../services/UserService');

class AuthController {
  loginPage(req, res) {
    if (req.isAuthenticated()) {
      return res.redirect(req.user.role === 'user' ? '/home' : '/admin');
    }
    res.render('user/login', { title: 'Login', user: null, devMode: process.env.NODE_ENV !== 'production' });
  }

  googleAuth(req, res, next) {
    const { ref } = req.query;
    const state = ref ? Buffer.from(JSON.stringify({ ref })).toString('base64') : undefined;
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state,
    })(req, res, next);
  }

  googleCallback(req, res, next) {
    passport.authenticate('google', { failureRedirect: '/login' })(req, res, async () => {
      try {
        // Process referral if state has ref
        if (req.query.state) {
          try {
            const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
            if (state.ref) {
              await UserService.processReferral(req.user.id, state.ref);
            }
          } catch (e) { /* ignore bad state */ }
        }

        if (req.user.role === 'user') {
          return res.redirect('/home');
        }
        return res.redirect('/admin');
      } catch (err) {
        next(err);
      }
    });
  }

  logout(req, res) {
    req.logout(() => {
      req.session.destroy(() => {
        res.redirect('/login');
      });
    });
  }
}

module.exports = new AuthController();
