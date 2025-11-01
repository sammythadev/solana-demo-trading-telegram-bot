import { executeBuy } from '../../services/tradeService.js';
import { fetchTokenData } from '../utils/dexApi.js';
import { Markup } from 'telegraf';
import { parseDexData } from '../utils/tokenParser.js';
import { fmtUSD } from '../utils/formatters.js';

// pending custom buy requests: userId -> mint
const pendingCustomBuys = new Map();

export default (bot) => {
  bot.command('buy', async (ctx) => {
    const parts = (ctx.message.text || '').split(' ').slice(1);

    // If user provided only a mint, show token info and quick buy options
    if (parts.length === 1) {
      const mint = parts[0].trim();
      if (!mint) return ctx.reply('Usage: /buy <mint> or /buy <mint> <sol_amount>');
      try {
        const data = await fetchTokenData(mint);
        if (!data) return ctx.reply('Token not found on Dexscreener.');
        const parsed = parseDexData(data);
        const out = `🪙 ${parsed.name || parsed.symbol || 'Unknown'} (${parsed.symbol || '—'})\n💰 Price: $${fmtUSD(parsed.priceUsd)}\n💧 Liquidity: $${fmtUSD(parsed.liquidityUsd)}\n\nTo buy, reply with:\n/buy ${mint} <sol_amount>\n\nQuick options:\n/buy ${mint} 0.1\n/buy ${mint} 0.5\n/buy ${mint} 1`;
        return ctx.reply(out);
      } catch (err) {
        console.error('buy command (show) error', err);
        return ctx.reply('Error fetching token data.');
      }
    }

    // If user provided mint and amount, attempt to execute
    if (parts.length >= 2) {
      const [mint, solStr] = parts;
      const solAmount = parseFloat(solStr);
      if (isNaN(solAmount) || solAmount <= 0) return ctx.reply('Invalid SOL amount.');
      try {
        const res = await executeBuy(ctx.state.user, mint, solAmount);
        await ctx.reply(res);
      } catch (err) {
        console.error('buy command execute error', err);
        await ctx.reply('Buy failed: ' + (err.message || 'unknown error'));
      }
      return;
    }

    // No args
    return ctx.reply('Usage: /buy <mint> or /buy <mint> <sol_amount>');
  });

  // Inline callback handlers for quick-buy buttons (callback_data format: buy:<mint>:<amount|custom>)
  // anchor handler to avoid accidental matches
  bot.action(/^buy:.+/, async (ctx) => {
    try {
      const data = ctx.callbackQuery && ctx.callbackQuery.data;
      if (!data) return ctx.answerCbQuery();
      await ctx.answerCbQuery();
      const parts = data.split(':');
      const mint = parts[1];
      const amt = parts[2];
      if (!mint) return ctx.reply('Invalid mint in callback.');
      if (amt === 'custom') {
        // record pending buy and prompt the user to send amount
        pendingCustomBuys.set(ctx.from.id, mint);
        return ctx.reply(`Enter the amount of SOL to spend on this token (e.g. 0.5). To cancel, reply with 'cancel'.\nToken: ${mint}`);
      }
      const solAmount = parseFloat(amt);
      if (isNaN(solAmount) || solAmount <= 0) return ctx.reply('Invalid SOL amount.');
      try {
        const res = await executeBuy(ctx.state.user, mint, solAmount);
        await ctx.reply(res);
      } catch (err) {
        console.error('buy action execute error', err);
        await ctx.reply('Buy failed: ' + (err.message || 'unknown error'));
      }
    } catch (err) {
      console.error('buy action error', err);
    }
  });

  // Capture user's next text when they have a pending custom buy
  // Use next to allow other handlers to run when we are not handling the message
  bot.on('text', async (ctx, next) => {
    try {
      const userId = ctx.from && ctx.from.id;
      if (!userId) return;
      if (!pendingCustomBuys.has(userId)) return next(); // not waiting for custom amount
      const mint = pendingCustomBuys.get(userId);
      const text = (ctx.message && ctx.message.text) ? ctx.message.text.trim() : '';
      if (!text) return;
      if (text.toLowerCase() === 'cancel') {
        pendingCustomBuys.delete(userId);
        return ctx.reply('Custom buy cancelled.');
      }
      const solAmount = parseFloat(text);
      if (isNaN(solAmount) || solAmount <= 0) {
        return ctx.reply('Invalid SOL amount. Please send a number like 0.1 or 1. To cancel, reply with "cancel".');
      }
      // perform buy
      try {
        const res = await executeBuy(ctx.state.user, mint, solAmount);
        await ctx.reply(res);
      } catch (err) {
        console.error('custom buy execute error', err);
        await ctx.reply('Buy failed: ' + (err.message || 'unknown error'));
      } finally {
        pendingCustomBuys.delete(userId);
      }
    } catch (err) {
      console.error('pending custom buy handler error', err);
    }
  });
};
