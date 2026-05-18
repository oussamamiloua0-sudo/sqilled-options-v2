# sqilled Options

Options strategy backtesting tool. Simulate covered calls, cash-secured puts, wheel strategy, and more on SPY, QQQ, IWM, and AAPL using real historical options data going back 8+ years.

## Stack

- **Frontend** — Next.js 15, Tailwind CSS, Recharts, Clerk auth
- **Backend** — FastAPI (Python), hosted on DigitalOcean
- **Database** — DigitalOcean Managed MySQL, ~10M+ option EOD rows
- **Hosting** — Vercel

## Run Locally

**Prerequisites:** Node.js, a running backend (see backend repo)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file and fill in your keys:
   ```bash
   cp .env.example .env.local
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host URL |
| `DROPLET_API_URL` | Backend API URL (default: http://147.182.205.5:8000) |

## Backend

See [Ivol_Pipeline_Git](https://github.com/oussamamiloua0-sudo/Ivol_Pipeline_Git) for the FastAPI backend and data pipeline.
