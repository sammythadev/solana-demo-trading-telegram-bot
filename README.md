
```markdown
# 💹 Telegram Solana Demo Trading Bot (Dexscreener + Adjustable Speed Edition)

> **Simulated Solana trading terminal inside Telegram.**  
> Uses Dexscreener API for live market data and customizable trade execution speeds to emulate real DEX latency.

---

## 🧭 Purpose

This Telegram bot allows users to **demo trade Solana tokens and Pump.fun coins** using a **virtual SOL balance**.  
All trades are simulated — no wallet connection or on-chain transactions are required.  

Data is fetched from **Dexscreener’s API**, and simulated execution speeds create the feel of a live trading environment.

---

## ⚙️ Core Features

| Feature | Description |
|----------|--------------|
| **User Registration** | `/start` registers new users and gives them 1.0 virtual SOL. |
| **Execution Speed Modes** | Users can set execution speed: Turbo / Fast / Normal / Slow. |
| **Token Lookup** | `/token <mint>` — shows live data from Dexscreener. |
| **Buy & Sell Simulation** | `/buy` and `/sell` commands simulate market orders. |
| **Portfolio Tracking** | `/portfolio` displays open positions, PnL, and value. |
| **Balance Management** | `/balance` and `/topup` commands manage demo SOL. |
| **Settings** | `/settings` lets users instantly change their execution speed. |
| **Dexscreener Caching** | Redis caches token data for 30–60s to improve performance. |

---

## 🧰 Tech Stack

| Component | Technology | Description |
|------------|-------------|--------------|
| **Bot Framework** | Node.js + Telegraf | Telegram command handling |
| **Database** | PostgreSQL + Sequelize | Persistent user and trade data |
| **Cache** | Redis | Dexscreener data caching |
| **API Data Source** | Dexscreener API | Market prices and liquidity info |
| **Deployment** | Docker / Render / Railway | Containerized app deployment |
| **Config** | dotenv | Environment management |

---

## 📂 Folder Structure

```

solana-demo-trading-bot/
│
├── src/
│   ├── bot/
│   │   ├── commands/
│   │   │   ├── start.js
│   │   │   ├── token.js
│   │   │   ├── buy.js
│   │   │   ├── sell.js
│   │   │   ├── portfolio.js
│   │   │   ├── balance.js
│   │   │   ├── topup.js
│   │   │   ├── settings.js
│   │   │   └── help.js
│   │   ├── middlewares/
│   │   │   └── userMiddleware.js
│   │   ├── utils/
│   │   │   ├── dexApi.js
│   │   │   ├── formatters.js
│   │   │   └── speedDelay.js
│   │   ├── bot.js
│   │   └── index.js
│   │
│   ├── db/
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Position.js
│   │   │   └── Transaction.js
│   │   ├── migrations/
│   │   └── index.js
│   │
│   ├── cache/
│   │   └── redisClient.js
│   │
│   ├── config/
│   │   ├── database.js
│   │   ├── redis.js
│   │   ├── env.js
│   │   └── constants.js
│   │
│   ├── services/
│   │   ├── tradeService.js
│   │   ├── portfolioService.js
│   │   ├── balanceService.js
│   │   └── userService.js
│   │
│   ├── utils/
│   │   └── logger.js
│   │
│   └── index.js
│
├── .env
├── package.json
├── README.md
├── .gitignore
└── docker-compose.yml

````

---

## 🧱 Folder & File Descriptions

### `/src/bot`
Main Telegram layer: commands, logic, and user interface.

| Path | Description |
|------|--------------|
| **commands/** | Individual Telegram command files (`/start`, `/buy`, etc.). |
| **middlewares/** | Middleware like user registration checks. |
| **utils/** | Helper functions for Dexscreener calls, delays, and formatting. |
| **bot.js** | Initializes the Telegraf bot and command handlers. |
| **index.js** | Bootstraps the bot and starts polling. |

---

### `/src/db`
Database layer for PostgreSQL.

| Path | Description |
|------|--------------|
| **models/** | Sequelize models (`User`, `Position`, `Transaction`). |
| **migrations/** | Database migrations (auto-generated). |
| **index.js** | Initializes Sequelize connection and model sync. |

---

### `/src/cache`
Redis caching layer.

| File | Description |
|------|--------------|
| **redisClient.js** | Redis setup and simple get/set methods with TTL. |

---

### `/src/config`
App configuration files.

| File | Description |
|------|--------------|
| **database.js** | Database config for Sequelize. |
| **redis.js** | Redis connection config. |
| **env.js** | Loads environment variables. |
| **constants.js** | Defines constants like speed delay ranges. |

---

### `/src/services`
Business logic layer — separated from bot commands for cleaner structure.

| File | Description |
|------|--------------|
| **tradeService.js** | Core buy/sell logic, price fetches, and delay simulation. |
| **portfolioService.js** | Calculates real-time PnL and holdings. |
| **balanceService.js** | Handles user balances and top-ups. |
| **userService.js** | Registers new users, updates speed settings, etc. |

---

### `/src/utils`
General-purpose utilities.

| File | Description |
|------|--------------|
| **logger.js** | Central logging utility (optional: use Winston or console). |

---

### `/src/index.js`
Application entry point — initializes environment, DB, cache, and starts the bot.

---

## ⚙️ Environment Setup

### `.env` Example

```bash
BOT_TOKEN=your_telegram_bot_token
DATABASE_URL=postgres://user:pass@localhost:5432/solana_demo_bot
REDIS_URL=redis://localhost:6379
DEXSCREENER_BASE_URL=https://api.dexscreener.com/latest/dex/tokens
DEFAULT_SOL=1.0
````

---

## 🐳 Docker Setup

Run the full stack locally using Docker Compose.

```yaml
version: '3.9'
services:
  bot:
    build: .
    command: npm start
    env_file: .env
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
  postgres:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: solana_demo_bot
    ports:
      - "5432:5432"
  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

---

## 🧩 Commands Reference
## Axel — Telegram Simulated Solana Trading Bot

This repository contains a Telegram bot that simulates trading on Solana-based tokens using live market data from Dexscreener. Trades are simulated using an internal virtual SOL balance — no wallets are connected and no on-chain transactions occur.

Key features:
- Simulated buy/sell using live token prices from Dexscreener (SOL/USD fetched live).
- Positions and transaction history stored via Sequelize (Postgres compatible).
- Redis caching for Dexscreener responses to reduce API calls and improve performance.
- Execution speed modes (Turbo / Fast / Normal / Slow). Gas fees are applied internally per-mode and deducted automatically from the SOL balance.
- Inline / interactive flows: quick-buy buttons, custom-buy capture, portfolio pagination, and compact positions view.

Developer contact: @realkazper (message for support)

---

## Quick start (Windows / PowerShell)

1. Install dependencies (this project uses pnpm in package.json but npm/yarn also work):

```powershell
# install using pnpm (recommended if you use pnpm)
pnpm install

# or npm
npm install
```

2. Create a `.env` file in the repo root (example values):

```text
BOT_TOKEN=your_telegram_bot_token
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgres://user:pass@localhost:5432/axel_db   # optional if you want persistence
DEXSCREENER_BASE_URL=https://api.dexscreener.com/latest/dex/tokens
```

3. Start Redis (required). You can run Redis locally or via Docker Compose. The repository's `docker-compose.yml` currently starts the bot and Redis only; if you need Postgres locally, run it separately or extend the compose file.

```powershell
# using docker-compose (starts bot + redis as configured in the repository)
docker-compose up -d

# Or run redis locally (example using docker)
docker run -d --name local-redis -p 6379:6379 redis:7
```

4. Start the bot:

```powershell
# development with auto-reload (nodemon)
pnpm run dev

# or run directly
pnpm start
```

5. In Telegram, open your bot and use `/start` to register.

---

## Commands (overview)

- /start — Register the user and seed demo SOL balance
- /help — Show commands and contact (developer: @realkazper)
- /token <mint> — Lookup token details (price, liquidity, FDV, 24h)
- /buy <mint> <sol> — Simulate a buy of the token using the given SOL amount (gas is deducted automatically per user speed mode)
- /sell <mint|symbol> <percent> — Simulate selling a percent of a position (supports inline percent buttons)
- /portfolio — Paginated view of open positions (5 per page)
- /positions — Compact positions view (symbol — amount — value — PnL%)
- /trades [all|buys|sells] — View transaction history (defaults to sold trades)
- /balance — Show SOL balance
- /topup <amount> — Add demo SOL to your balance
- /settings — Select execution speed (Turbo, Fast, Normal, Slow); fees are applied automatically and not shown explicitly in the UI

---

## Notes and important operational details

- Live pricing: SOL/USD and token prices are fetched from Dexscreener. WSOL mint is used to compute SOL price where applicable.
- Caching: Dexscreener token responses are cached in Redis (short TTL) to reduce API load.
- Gas/fees: Gas USD amounts per speed mode are defined internally (in `src/config/constants.js`) and converted to SOL at runtime using the live SOL/USD price. The UI does not show the fee amount — it's deducted silently from the user's SOL balance on each trade.
- Database: The app uses Sequelize models for persistence. For production, use proper migrations — runtime `sync({ alter: true })` is not recommended for Postgres enums and was reverted due to enum-cast errors. If you need DB persistence locally, run Postgres and set `DATABASE_URL`.
- Pending interactive state: custom-buy waiting state is stored in-memory; to survive restarts consider moving that state to Redis (recommended enhancement).

---

## Troubleshooting

- If you see startup errors related to enum migrations (Postgres): ensure your schema matches the models or run explicit migrations rather than `sync({ alter: true })`.
- If token fields (liquidity/FDV/24h) show `N/A`, Dexscreener returned a different shape — check logs or re-fetch; caching may be in effect.

---

## Development notes

- Code lives under `src/` — commands in `src/bot/commands`, services in `src/services`, and DB models in `src/db/models`.
- Add unit tests and a small integration test harness to validate `tradeService` and SOL price fetch (todo: automated tests).

---

Developer contact: https://t.me/realkazper
