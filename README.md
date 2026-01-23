Pacificast is a mobile-first perpetual trading UI built with Next.js and the Farcaster miniapp wallet flow. It includes live pairs, trading, positions, and a limit-order monitor.

## Features
- Trading pairs and market prices
- Market/limit order flow (signed with Farcaster wallet)
- Positions + orders views
- Limit order monitoring via cron
- Swap + send modals with rate and gas fee estimates
- Farcaster miniapp verification via `/.well-known/farcaster.json`

## Local Setup
1) Install dependencies
```bash
npm install
```

2) Create `.env`
```
DATABASE_URL=...
CRON_SECRET=...
BUILDER_CODE=PACIFICAST
```

3) Run the dev server
```bash
npm run dev
```

Open `http://localhost:3000`.

## Deployment
Deploy on Vercel (recommended):
1) Import the repo
2) Set env vars in Vercel:
   - `DATABASE_URL`
   - `CRON_SECRET`
   - `BUILDER_CODE`
3) Deploy

## Farcaster Verification
Warpcast requires a `/.well-known/farcaster.json` file to verify your domain.

Make sure this file exists at:
```
public/.well-known/farcaster.json
```

Required fields:
- `accountAssociation` (provided by Farcaster)
- `frame.version`
- `frame.name`
- `frame.iconUrl`
- `frame.homeUrl`

After deploy, verify it loads:
```
https://<your-domain>/.well-known/farcaster.json
```

## Cron (Limit Orders)
Limit orders are checked via `GET /api/cron/check-limits`.

For Vercel Hobby, cron is limited to once per day. This repo includes a GitHub Action to ping the endpoint every 5 minutes instead.

Configure GitHub Action secrets:
- `CRON_URL` = `https://<your-domain>/api/cron/check-limits`
- `CRON_SECRET` = your secret value

## Notes
- Env vars are not committed; configure them in your host dashboard.
- Rates come from CoinGecko and may be rate-limited during high traffic.
