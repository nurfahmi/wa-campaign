# WA Campaign

WhatsApp Click-To-Earn Campaign Platform.

## Requirements

- Node.js 18+
- MySQL 5.7+ / MariaDB 10.3+

## Installation

```bash
# 1. Clone
git clone https://github.com/nurfahmi/wa-campaign.git
cd wa-campaign

# 2. Install dependencies
npm install

# 3. Copy and edit environment config
cp .env.example .env
# Edit .env with your database credentials, Google OAuth keys, etc.

# 4. Start the app
npm start
```

The database and all tables are **created automatically** on first run — no manual SQL needed.

## First-Time Setup (Superadmin)

When you start the app for the first time (empty database), a **one-time setup URL** is printed in the console:

```
═══════════════════════════════════════════════════
🛡️  FIRST-TIME SETUP — Create your superadmin:
   http://localhost:3000/setup/abc123...
   (This link can only be used ONCE)
═══════════════════════════════════════════════════
```

Open that URL in your browser to create the superadmin account. The link expires after use.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `BASE_URL` | Public URL of the app | `http://localhost:3000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `SESSION_SECRET` | Session encryption secret | `change-me` |
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASS` | MySQL password | _(empty)_ |
| `DB_NAME` | Database name | `wacampaign` |
| `DB_SOCKET` | MySQL socket path (optional) | — |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | — |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback | `http://localhost:3000/auth/google/callback` |
| `WA_API_BASE_URL` | WhatsApp API service URL | `http://localhost:8181` |
| `WA_API_KEY` | WhatsApp API key | — |

## Scripts

```bash
npm start   # Production start
npm run dev # Development with auto-reload
```
