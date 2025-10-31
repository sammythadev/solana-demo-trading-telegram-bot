import { executeBuy } from '../../services/tradeService.js';
import { fetchTokenData } from '../utils/dexApi.js';
import { Markup } from 'telegraf';

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
  bot.action(/buy:.+/, async (ctx) => {
    try {
      const data = ctx.callbackQuery && ctx.callbackQuery.data;
      if (!data) return ctx.answerCbQuery();
      await ctx.answerCbQuery();
      const parts = data.split(':');
      const mint = parts[1];
      const amt = parts[2];
      if (!mint) return ctx.reply('Invalid mint in callback.');
      if (amt === 'custom') {
        return ctx.reply(`To buy, reply with:\n/buy ${mint} <sol_amount>`);
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
};
