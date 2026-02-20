const express = require('express');
const session = require('express-session');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const config = require('./src/config/env');
const passport = require('./src/config/passport');
const errorHandler = require('./src/middlewares/errorHandler');
const { initDatabase } = require('./src/config/database');

// Routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const adminRoutes = require('./src/routes/admin');
const webhookRoutes = require('./src/routes/webhook');
const setupRoutes = require('./src/routes/setup');
const { generateSetupToken } = require('./src/routes/setup');

const app = express();

// Trust proxy (Cloudflare Tunnel / reverse proxy)
app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(morgan('short'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session
app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24h
  },
}));

// Flash messages
app.use(flash());

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Make flash available to all views
app.use((req, res, next) => {
  res.locals.flash = {
    success: req.flash('success')[0],
    error: req.flash('error')[0],
  };
  next();
});

// Inject currency + formatMoney helper into all views (cached)
const SystemSetting = require('./src/models/SystemSetting');
let _ccache = { symbol: '$', decimals: 2, expiresAt: 0 };
app.use(async (req, res, next) => {
  try {
    if (Date.now() > _ccache.expiresAt) {
      _ccache.symbol = await SystemSetting.get('currency_symbol', '$') || '$';
      _ccache.decimals = parseInt(await SystemSetting.get('currency_decimals', '2')) || 0;
      _ccache.expiresAt = Date.now() + 5 * 60 * 1000;
    }
  } catch (e) { /* keep defaults */ }
  const sym = _ccache.symbol;
  const dec = _ccache.decimals;
  res.locals.currency = sym;
  res.locals.formatMoney = (amount) => {
    const num = parseFloat(amount || 0);
    const parts = num.toFixed(dec).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, dec === 0 ? '.' : ',');
    return sym + parts.join(dec === 0 ? '' : '.');
  };
  next();
});

// Routes
app.use('/', setupRoutes);
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/admin', adminRoutes);
app.use('/webhook', webhookRoutes);

// Root redirect
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect(req.user.role === 'user' ? '/home' : '/admin');
  }
  res.redirect('/login');
});

// 404
app.use((req, res, next) => {
  res.status(404).render('user/error', {
    title: 'Not Found',
    message: 'Page not found',
    statusCode: 404,
    user: req.user || null,
  });
});

// Central error handler
app.use(errorHandler);

// Start server — init DB first, then listen
const PORT = config.port;

async function start() {
  try {
    await initDatabase();

    app.listen(PORT, async () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Admin: http://localhost:${PORT}/admin`);

      // Generate one-time setup URL if no users exist
      const setupUrl = await generateSetupToken(config.baseUrl);
      if (setupUrl) {
        console.log('');
        console.log('═══════════════════════════════════════════════════');
        console.log('🛡️  FIRST-TIME SETUP — Create your superadmin:');
        console.log(`   ${setupUrl}`);
        console.log('   (This link can only be used ONCE)');
        console.log('═══════════════════════════════════════════════════');
        console.log('');
      }
    });
  } catch (err) {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
