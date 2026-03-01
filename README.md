# Splitwise Clone

A full-featured expense splitting web application built with React + Node.js, inspired by Splitwise.

## Features

- **Auth**: Email/password + Google OAuth, JWT with refresh tokens, forgot/reset password
- **Friends**: Send/accept/decline friend requests, view net balances, unfriend
- **Groups**: Create trip/home/couple groups, manage members, simplify debts
- **Expenses**: Add expenses with equal/exact/percent/shares splits, multi-currency, receipt upload, recurring
- **Balances**: Per-friend and per-group balances, debt simplification algorithm
- **Settle Up**: Record cash or online payments, partial settlements
- **Activity Feed**: Real-time-style activity log per user and per group
- **Notifications**: In-app bell + email notifications via Nodemailer
- **Reports**: Spending charts by category (pie) and over time (line) with Recharts
- **Multi-currency**: 100+ currencies via ExchangeRate-API

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, React Router v6, React Query, Axios, Recharts |
| Backend | Node.js, Express, Prisma ORM, PostgreSQL |
| Auth | JWT (access + refresh), Google OAuth 2.0 via Passport.js |
| Validation | Zod |
| Email | Nodemailer |

## Setup

### 1. Prerequisites

- Node.js 18+
- PostgreSQL (running locally or on a cloud service)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the backend

Copy the example env file and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/splitwise"
JWT_SECRET="change-this-to-a-long-random-string"
JWT_REFRESH_SECRET="change-this-too"

# Optional: Google OAuth (leave as placeholder to skip)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3001/api/auth/google/callback"

# Optional: Email (leave as placeholder to skip)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Optional: Live exchange rates (falls back to hardcoded rates)
EXCHANGE_RATE_API_KEY="your-key-from-exchangerate-api.com"
```

### 4. Create the database and run migrations

```bash
# Make sure PostgreSQL is running and the database exists
createdb splitwise   # or create it via pgAdmin

# Run migrations
npm run db:migrate --workspace=backend
```

### 5. Start the development servers

```bash
npm run dev
```

This starts:
- Backend on http://localhost:3001
- Frontend on http://localhost:5173

## Project Structure

```
splitwise/
├── backend/
│   ├── src/
│   │   ├── routes/          # Express route handlers
│   │   ├── services/        # Business logic (balance calc, splits, currency)
│   │   ├── middlewares/     # Auth, upload, rate limiter, error handler
│   │   └── utils/           # Prisma client, JWT helpers, email
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── uploads/             # Uploaded files (avatars, receipts)
└── frontend/
    └── src/
        ├── pages/           # Dashboard, Friends, Groups, Activity, Reports, Account
        ├── components/      # Layout, Modal, Avatar, AddExpenseModal, SettleUpModal
        ├── context/         # AuthContext
        └── api/             # Axios client with JWT interceptors
```

## Optional: Google OAuth Setup

1. Go to https://console.cloud.google.com
2. Create a new project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Web application)
4. Add `http://localhost:3001/api/auth/google/callback` as authorized redirect URI
5. Copy Client ID and Secret to your `.env`

## Optional: Email Notifications

1. Use Gmail with an App Password (enable 2FA → App passwords)
2. Set `SMTP_USER` and `SMTP_PASS` in `.env`

## Optional: Live Currency Rates

1. Sign up free at https://www.exchangerate-api.com
2. Get your API key and set `EXCHANGE_RATE_API_KEY` in `.env`
