# ACC Intelligence — Setup Guide

This is the internal company intelligence platform for The Acceleration Company (ACC). It connects to Airtable as your database and uses AI to let you ask plain-English questions about your company data.

---

## What you need before starting

1. **Node.js** — Download and install from [nodejs.org](https://nodejs.org) (LTS version)
2. **Your Airtable credentials** (see below)
3. **Your Clerk credentials** (for login management)
4. **Your Anthropic API key** (for the AI chatbot)

---

## Step 1 — Get your API keys

### Airtable
1. Go to [airtable.com](https://airtable.com) and log in
2. Open your base (the spreadsheet that holds your company data)
3. Your **Base ID** is in the URL: `airtable.com/`**`appXXXXXXXXXXXX`**`/...`
4. For your **API Key**: click your profile picture → Account → API → Create a personal access token
   - Scopes: `data.records:read`, `data.records:write`, **`schema.bases:read`**
   - Access: grant the token **only** the one base above — nothing here reads any other base
   - `schema.bases:read` is required, not optional. The app reads the table
     schema to work out which fields are writable before every create and
     edit. Without it the failure is quiet and confusing rather than a clean
     error: adding or editing a company shows "Failed to load form fields"
     and then "No editable fields found", while the Hot List toggle and
     delete keep working because neither reads the schema.
   - Do **not** add `schema.bases:write`. Nothing in this app creates or
     modifies tables or fields, so granting it only widens what a leaked
     token could do.
5. Note the exact **Table Name** (e.g., `Companies`) — it must match exactly, including capitalisation

### Clerk (login system)
1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) and create an app
2. Choose "Email + Password" as the sign-in method
3. Copy the **Publishable Key** and **Secret Key** from API Keys

### Anthropic (AI chatbot)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key under API Keys

---

## Step 2 — Configure your environment

1. In the project folder, duplicate `.env.example` and rename the copy to **`.env.local`**
2. Open `.env.local` and fill in each value:

```
AIRTABLE_API_KEY=your_personal_access_token_here
AIRTABLE_BASE_ID=appXXXXXXXXXXXX
AIRTABLE_TABLE_NAME=Companies

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

ANTHROPIC_API_KEY=sk-ant-...
```

> **Important:** Never share or commit `.env.local` — it contains secret keys.

---

## Step 3 — Install and run

Open Terminal, navigate to the project folder, then run:

```bash
# Install dependencies (only needed the first time)
npm install

# Start the development server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Step 4 — Add users

Because this is an invite-only platform, **new users cannot sign up themselves**. You must create accounts manually:

1. Go to your Clerk dashboard
2. Click **Users** → **Create user**
3. Set their email and a temporary password
4. Share the login URL (`yourdomain.com/sign-in`) with them

---

## Deploying to Vercel

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → Import project → select your repo
3. In Vercel's project settings, add all your environment variables (same as `.env.local`)
4. Deploy — Vercel builds and hosts it automatically

---

## How the app works

```
User → Next.js App
          │
          ├─ Reads/writes data → Airtable (your source of truth)
          │
          └─ AI questions only → Claude API (reads Airtable data, answers in English)
```

- **Airtable** stores everything. Every add, edit, delete goes directly there.
- **Claude** only powers the chatbot. It sees a snapshot of your data per question and never stores anything.
- **Clerk** handles login, password resets, and 2FA automatically.

---

## Features

| Feature | How to access |
|---------|--------------|
| Ask AI questions | Home screen chat bar or the floating chat button (bottom right) |
| Browse companies | Left sidebar or Companies page |
| Add a company | "Add Company" button or `/companies/new` |
| Edit a company | Company profile → Edit button |
| Add/remove from Hot List | Flame button on any company card, or the button on the company profile — the record stays on the target list |
| Delete a company | Company profile → Delete button (permanent — removes it from Airtable entirely) |
| Compare companies | Click "Compare" on cards, then "Compare Now" |

---

## Troubleshooting

**"Failed to fetch companies"** — Check your `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, and `AIRTABLE_TABLE_NAME` are all correct.

**Login page won't load** — Check your Clerk publishable key starts with `pk_test_` or `pk_live_`.

**AI chatbot gives no response** — Check your `ANTHROPIC_API_KEY` is valid and has credits.

**Form shows no fields** — Your Airtable table needs at least one existing record. Add a record manually in Airtable, then the form will detect the fields automatically.
