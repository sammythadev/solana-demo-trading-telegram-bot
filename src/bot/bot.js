import { Telegraf, Markup } from 'telegraf';
import { ENV } from '../config/env.js';
import userMiddleware from './middlewares/userMiddleware.js';
import startCommand from './commands/start.js';
import helpCommand from './commands/help.js';
import tokenCommand from './commands/token.js';
import buyCommand from './commands/buy.js';
import sellCommand from './commands/sell.js';
import portfolioCommand from './commands/portfolio.js';
import positionsCommand from './commands/positions.js';
import balanceCommand from './commands/balance.js';
import topupCommand from './commands/topup.js';
import settingsCommand from './commands/settings.js';
import { fetchTokenData } from './utils/dexApi.js';
import { parseDexData } from './utils/tokenParser.js';
import { fmtUSD } from './utils/formatters.js';

const BOT_TOKEN = ENV.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN not set in environment');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// middleware
bot.use(userMiddleware);

// register commands
startCommand(bot);
helpCommand(bot);
tokenCommand(bot);
buyCommand(bot);
sellCommand(bot);
portfolioCommand(bot);
positionsCommand(bot);
balanceCommand(bot);
topupCommand(bot);
settingsCommand(bot);

// set bot commands for Telegram UI
bot.telegram.setMyCommands([
  { command: 'start', description: 'Register and show balance' },
  { command: 'token', description: 'Show token details' },
  { command: 'buy', description: 'Simulate buy' },
  { command: 'sell', description: 'Simulate sell' },
  { command: 'portfolio', description: 'View open positions' },
  { command: 'balance', description: 'View SOL balance' },
  { command: 'topup', description: 'Add demo SOL' },
  { command: 'settings', description: 'Change execution speed' },
  { command: 'help', description: 'Show help' }
]);

export default bot;

// plain-text token address handler: users can paste a token mint/address and get token info + quick buy buttons
bot.on('text', async (ctx) => {
  const text = (ctx.message && ctx.message.text) ? ctx.message.text.trim() : '';
  if (!text) return;
  // ignore commands and messages that look like sentences
  if (text.startsWith('/') || text.includes(' ')) return;
  // simple Base58-ish address detection (32-44 chars, base58 charset)
  const isAddr = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text);
  if (!isAddr) return;

  const mint = text;
    try {
      const data = await fetchTokenData(mint);
      if (!data) return; // silently ignore if not found
      const parsed = parseDexData(data);
  const out = `🪙 ${parsed.name || parsed.symbol || 'Unknown'} (${parsed.symbol || '—'})\n💰 Price: $${fmtUSD(parsed.priceUsd)}\n💧 Liquidity: $${fmtUSD(parsed.liquidityUsd)}\n📊 FDV: $${fmtUSD(parsed.fdv)}mcap\n📈 24h: ${parsed.change24h !== null ? parsed.change24h + '%' : 'N/A'}\n🔗 ${parsed.url || ''}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('Buy 0.1 SOL', `buy:${mint}:0.1`),
          Markup.button.callback('Buy 0.5 SOL', `buy:${mint}:0.5`)
        ],
        [
          Markup.button.callback('Buy 1 SOL', `buy:${mint}:1`),
          Markup.button.callback('Custom amount', `buy:${mint}:custom`)
        ]
      ]);

      await ctx.reply(out, keyboard);
    } catch (err) {
      console.error('plaintext token handler error', err);
      // don't spam users on failure
    }
});
