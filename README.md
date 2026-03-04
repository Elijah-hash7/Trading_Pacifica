# Pacificast

> A mobile-first perpetual trading UI built as a Farcaster miniapp — with live market pairs, limit orders, position tracking, and automated order monitoring via cron.

Live inside the Farcaster ecosystem. Trades are signed with the Farcaster wallet. No external wallet connection needed.

🔗 [Live Demo](https://trading-pacificast.vercel.app/)) · [View Repo](https://github.com/Elijah-hash7/Trading_Pacifica)

---

## What This Actually Does

Pacificast is a perpetual trading interface that runs natively inside Farcaster as a miniapp. Users can view live trading pairs, place market and limit orders signed with their Farcaster wallet, monitor open positions, and have limit orders automatically executed when price conditions are met.

The limit order monitoring runs on a cron job — since Vercel Hobby limits cron to once per day, a GitHub Action pings the endpoint every 5 minutes instead. That's a real infrastructure workaround for a real platform limitation.

---

## Technical Highlights

**Farcaster Miniapp Integration** — Full miniapp setup including domain verification via `/.well-known/farcaster.json`, wallet signing flow, and Warpcast-compatible frame metadata. Not just "connected to Farcaster" — built to run inside it natively.

**Limit Order Monitor via GitHub Actions** — Vercel Hobby cron runs once per day. To get 5-minute limit order checks, a GitHub Action workflow hits `GET /api/cron/check-limits` on schedule with a `CRON_SECRET` header for auth. Creative infrastructure solution to a real constraint.

**Live Market Data** — Trading pairs and prices pulled from CoinGecko API in real time. Rate limiting handled gracefully for high-traffic scenarios.

**Order Flow** — Market and limit orders built with full signed transaction flow using the Farcaster wallet. Includes swap and send modals with live rate and gas fee estimates before confirmation.

**Position & Order Tracking** — Persistent positions and order state stored in a database, viewable per user with open/closed filtering.

---

## Architecture

```
Farcaster Client (Warpcast)
        ↓
Next.js App (miniapp frame)
        ↓              ↓
Database          CoinGecko API
        ↑
GitHub Action (cron) → /api/cron/check-limits
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js |
| Blockchain | Farcaster miniapp, wallet signing |
| Market Data | CoinGecko API |
| Database | Prisma + DATABASE_URL |
| Deployment | Vercel |
| Cron | GitHub Actions (5-min interval) |

---

## Quick Start

```bash
npm install
```

Create `.env`:
```env
DATABASE_URL=...
CRON_SECRET=...
BUILDER_CODE=PACIFICAST
```

```bash
npm run dev
```

Open `http://localhost:3000`

---

## Deployment

Deploy on Vercel:
1. Import the repo
2. Set environment variables: `DATABASE_URL`, `CRON_SECRET`, `BUILDER_CODE`
3. Deploy

Production: [https://trading-pacificast.vercel.app/](https://trading-pacificast.vercel.app/))

---

## Farcaster Verification

Domain verification file lives at `public/.well-known/farcaster.json`:

```json
{
  "accountAssociation": "...",
  "frame": {
    "version": "...",
    "name": "Pacificast",
    "iconUrl": "...",
    "homeUrl": "..."
  }
}
```

Verify after deploy:
```
https://trading-pacificast.vercel.app/.well-known/farcaster.json
```

---

## Limit Order Cron (GitHub Actions)

Since Vercel Hobby only supports daily cron, limit order checks run via GitHub Action every 5 minutes:

```yaml
# .github/workflows/cron-check-limits.yml
# Hits GET /api/cron/check-limits with CRON_SECRET every 5 minutes
```

Required GitHub secret: `CRON_SECRET`

---

## What I Learned Building This

- How Farcaster miniapps work end-to-end — frame metadata, domain verification, wallet signing
- Working around platform cron limitations with GitHub Actions
- Building real trading UI with live price feeds and gas estimation
- Structuring Next.js apps for both UI and API routes cleanly
