
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

1. Install dependencies:

```powershell
pnpm install
# or npm install
```

2. Create a `.env` file at the project root and set these variables at minimum:

```text
BOT_TOKEN=your_telegram_bot_token
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgres://user:pass@localhost:5432/axel_db   # optional
DEXSCREENER_BASE_URL=https://api.dexscreener.com/latest/dex/tokens
```

3. Start Redis (via Docker or locally):

```powershell
docker run -d --name local-redis -p 6379:6379 redis:7
# or docker-compose up -d (the repo includes a compose file)
```

4. Run the bot:

```powershell
pnpm run dev   # use nodemon for development
# or pnpm start
```

5. Open the bot in Telegram and send `/start`.

---

## Commands

- /start — register and seed a demo SOL balance
- /help — list commands and developer contact
- /token <mint> — show token details
- /buy <mint> <sol> — simulate buy (quick buttons available)
- /sell <mint|symbol> <percent> — simulate sell
- /portfolio — paginated positions (5 per page)
- /positions — compact positions list
- /trades [all|buys|sells] — transaction history (defaults to sold trades)
- /balance — show SOL and USD estimate
- /topup <amount> — add demo SOL
- /settings — choose execution speed mode

---

## Notes

- Live prices come from Dexscreener. The app caches token data in Redis and uses short in-memory caches to improve responsiveness.
- Gas amounts are configured in `src/config/constants.js` and converted to SOL at runtime. The UI does not display gas values; they are deducted automatically.
- The app uses Sequelize for persistence. For production, use proper migrations instead of runtime `sync({ alter: true })`.

---

## Project layout (important files)

- `src/bot/` — Telegram commands and middleware
- `src/services/` — trade logic, portfolio and balance services
- `src/db/` — Sequelize models and DB init
- `src/cache/redisClient.js` — Redis helpers
- `src/bot/utils/` — Dexscreener helpers and formatters

---

