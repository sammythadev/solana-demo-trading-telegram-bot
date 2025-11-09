
```markdown
# Axel — Telegram Solana demo trading bot

This is a Telegram bot for simulating spot trades on Solana tokens. It uses live market data from Dexscreener and a virtual SOL balance — no wallets or on-chain transactions are involved.

Key capabilities
- Lookup tokens and view price, liquidity and FDV.
- Simulated buy/sell using SOL with optional quick buttons.
- Portfolio view with PnL and pagination.
- Transaction history (trades) with PnL and percentage.
- Execution speed modes (Turbo/Fast/Normal/Slow). Gas is charged internally per mode and deducted from the virtual SOL balance.
- Redis caching and in-memory caches for performance.

Developer contact: https://t.me/realkazper

---

## Quick start (Windows / PowerShell)

# Axel — Telegram Solana demo trading bot

This repository contains a Telegram bot that simulates spot trading for Solana tokens. It uses live market data from Dexscreener and keeps users on a virtual SOL balance (no on-chain transactions).

Highlights of recent changes (Nov 9, 2025)
- Trades view is now paginated (10 trades per page) with Prev/Next, Refresh and Cancel controls.
- Trades header shows total trades, total PnL (USD), estimated profit % and win/loss counts + win rate.
- Portfolio now uses DB-level pagination (reduced memory & latency) and batch token fetches.
- Buy and Sell UIs include inline quick-action buttons and an explicit ❌ Cancel button to dismiss the inline message.
- Token fetching improved with a short in-memory LRU cache, Redis fallback, request coalescing and keep-alive HTTP connections.
- DB connection pooling and a lightweight `pg` pool helper were added. `Sequelize` is configured with explicit pool settings.

Quick start (Windows / PowerShell)

1. Install dependencies:

```powershell
pnpm install
# or npm install
```

2. Create a `.env` file at the project root with at least:

```text
BOT_TOKEN=your_telegram_bot_token
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgres://user:pass@localhost:5432/axel_db
DEXSCREENER_BASE_URL=https://api.dexscreener.com/latest/dex/tokens
NODE_ENV=development
```

3. Start Redis and Postgres (local or docker-compose):

```powershell
# start Redis (quick)
docker run -d --name local-redis -p 6379:6379 redis:7
# or use docker-compose up -d
```

4. Start the bot in dev mode:

```powershell
pnpm run dev
# or pnpm start
```

Commands (user-facing)
- /start — register and seed a demo SOL balance
- /help — list commands and developer contact
- /token <mint> — show token details
- /buy <mint> — show quick buy buttons (Buy 0.1/0.5/1, Custom, Cancel)
- /buy <mint> <sol> — execute a simulated buy
- /sell <mint|symbol> — show quick sell buttons (25/50/75/100, Custom, Cancel)
- /sell <mint|symbol> <percent> — execute a simulated sell
- /portfolio — paginated positions (5 per page)
- /positions — compact positions list
- /trades [sold|buys|all] — transaction history (paginated, 10 per page)
- /balance — show SOL and USD estimate
- /topup <amount> — add demo SOL
- /settings — choose execution speed mode

Operational notes & tuning
- Token price and metadata are cached in-process (LRU) and in Redis with short TTLs to reduce Dexscreener requests.
- Dex API calls use an HTTP agent with keepAlive and a bounded concurrency limiter to reduce latency and avoid spikes.
- Sequelize is configured with explicit pool settings (see `src/config/database.js`). There's also a lightweight `pg` pool helper in `src/db/pgPool.js` for fast raw queries.
- Redis: configure `maxmemory` & `maxmemory-policy` (e.g. `volatile-lru`) in production to avoid OOM and enable predictable eviction.

Development notes
- The codebase uses ES modules. If you add native dependencies, ensure ESM compatibility.
- For production, avoid relying on `sequelize.sync()` for migrations; use proper migrations instead.

Where to start improving performance further
- Add Prometheus metrics for pg pool counts, Redis hit/miss, and external API latencies.
- Cache final rendered portfolio pages (short TTL) and serve stale-while-revalidate.
- Move the hottest read paths to `pgPool.query()` for lower ORM overhead.

Developer
- Contact: @realkazper (Telegram)

---
