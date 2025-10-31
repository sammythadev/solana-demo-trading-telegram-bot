import { executeSell } from '../../services/tradeService.js';
import { initDB } from '../../db/index.js';
import { fetchTokenData } from '../utils/dexApi.js';
import { Markup } from 'telegraf';

export default (bot) => {
  bot.command('sell', async (ctx) => {
    const parts = (ctx.message.text || '').split(' ').slice(1);
    if (parts.length === 0) return ctx.reply('Usage: /sell <mint|ticker> or /sell <mint|ticker> <percent>');

    const input = parts[0].trim();

    // initialize DB to look up positions when given a ticker
    const db = await initDB();
    const { models } = db;

    // helper to resolve input (ticker or mint) to a mint address and position
    const resolveToPosition = async (val) => {
      // try exact token_address match first
      let pos = await models.Position.findOne({ where: { user_id: ctx.state.user.id, token_address: val } });
      if (pos) return pos;
      // try matching by symbol (case-insensitive) among user's positions
      const positions = await models.Position.findAll({ where: { user_id: ctx.state.user.id } });
      const lower = val.toLowerCase();
      pos = positions.find(p => (p.symbol || '').toLowerCase() === lower);
      return pos || null;
    };

    // If user provided only the token (mint or ticker), show token info and inline percent buttons
    if (parts.length === 1) {
      try {
        // try to resolve mint from user's positions by ticker
        const pos = await resolveToPosition(input);
        let mint = input;
        if (pos) mint = pos.token_address;

        const data = await fetchTokenData(mint);
        if (!data) return ctx.reply('Token not found on Dexscreener.');
        const base = data.pairs && data.pairs[0] && data.pairs[0].baseToken ? data.pairs[0].baseToken : data.baseToken || {};
        const price = base.priceUsd || data.priceUsd || 'N/A';
        const liquidity = (data.liquidity && data.liquidity.usd) || 'N/A';
        const out = `🪙 ${base.name || base.symbol || 'Unknown'} (${base.symbol || '—'})\n💰 Price: $${price}\n💧 Liquidity: ${liquidity}\n\nChoose percent to sell:`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('25%', `sell:${mint}:25`), Markup.button.callback('50%', `sell:${mint}:50`)],
          [Markup.button.callback('75%', `sell:${mint}:75`), Markup.button.callback('100%', `sell:${mint}:100`)],
          [Markup.button.callback('Custom', `sell:${mint}:custom`)]
        ]);

        return ctx.reply(out, keyboard);
      } catch (err) {
        console.error('sell command (show) error', err);
        return ctx.reply('Error fetching token or position.');
      }
    }

    // If user provided token and percent, resolve token and execute
    if (parts.length >= 2) {
      const pctStr = parts[1];
      const percent = parseFloat(pctStr);
      if (isNaN(percent) || percent <= 0 || percent > 100) return ctx.reply('Percent must be 1-100.');
      try {
        // resolve input to position/mint
        const pos = await resolveToPosition(input);
        const mint = pos ? pos.token_address : input;
        const res = await executeSell(ctx.state.user, mint, percent);
        await ctx.reply(res);
      } catch (err) {
        console.error('sell command execute error', err);
        await ctx.reply('Sell failed: ' + (err.message || 'unknown error'));
      }
      return;
    }
  });

  // Inline callback handlers for quick-sell buttons (callback_data format: sell:<mint>:<percent|custom>)
  bot.action(/sell:.+/, async (ctx) => {
    try {
      const data = ctx.callbackQuery && ctx.callbackQuery.data;
      if (!data) return ctx.answerCbQuery();
      await ctx.answerCbQuery();
      const parts = data.split(':');
      const mint = parts[1];
      const amt = parts[2];
      if (!mint) return ctx.reply('Invalid mint in callback.');
      if (amt === 'custom') {
        return ctx.reply(`To sell, reply with:\n/sell ${mint} <percent>`);
      }
      const percent = parseFloat(amt);
      if (isNaN(percent) || percent <= 0 || percent > 100) return ctx.reply('Invalid percent.');
      try {
        const res = await executeSell(ctx.state.user, mint, percent);
        await ctx.reply(res);
      } catch (err) {
        console.error('sell action execute error', err);
        await ctx.reply('Sell failed: ' + (err.message || 'unknown error'));
      }
    } catch (err) {
      console.error('sell action error', err);
    }
  });
};
