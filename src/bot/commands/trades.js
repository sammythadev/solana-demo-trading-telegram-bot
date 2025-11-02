import { initDB } from '../../db/index.js';
import { fmtUSD } from '../utils/formatters.js';
import { Markup } from 'telegraf';

export default (bot) => {
  // /trades [sold]
  bot.command('trades', async (ctx) => {
    try {
      const text = (ctx.message && ctx.message.text) ? ctx.message.text.trim() : '';
      const args = text.split(' ').slice(1);
      let filter = args[0] ? args[0].toLowerCase() : null; // 'sold' to show only sells
      // default behavior: show only sold trades. Use `trades all` to see everything or `trades buys` to see buys only.
      if (!filter) filter = 'sell';
      if (!['sell','sold','sells','buy','buys','b','all','a'].includes(filter)) {
        return ctx.reply('Usage: /trades [sold|buys|all] — default is sold');
      }

      const { models } = await initDB();
      const where = { user_id: ctx.state.user.id };
      if (filter === 'sell' || filter === 'sold' || filter === 'sells') where.type = 'sell';
      else if (filter === 'buy' || filter === 'buys' || filter === 'b') where.type = 'buy';
      // 'all' -> no type filter

      const txs = await models.Transaction.findAll({ where, order: [['created_at', 'DESC']], limit: 100 });
      if (!txs || txs.length === 0) return ctx.reply('No trades found.');

      const lines = txs.map(t => {
        const when = t.created_at ? new Date(t.created_at).toLocaleString() : '';
        if (t.type === 'buy') {
          const emoji = '🟢';
          return `${emoji} BUY — ${t.token_symbol || ''}\n` +
            `🪙 Amount: ${t.token_amount ? Number(t.token_amount).toFixed(6) : '-'} tokens\n` +
            `💰 Price: $${fmtUSD(t.price_usd || 0)} — Total: $${fmtUSD(t.total_usd || 0)}\n` +
            `${when}`;
        }
        if (t.type === 'sell') {
          const pnl = parseFloat(t.pnl_usd) || 0;
          const proceeds = parseFloat(t.total_usd) || 0;
          const cost = proceeds - pnl; // cost basis
          let pct = null;
          if (cost && Number.isFinite(cost) && cost !== 0) {
            pct = (pnl / cost) * 100;
          }
          const emoji = pnl >= 0 ? '🟢' : '🔴';
          const pctText = pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : 'N/A';
          return `${emoji} SELL — ${t.token_symbol || ''}\n` +
            `🪙 Sold: ${t.token_amount ? Number(t.token_amount).toFixed(6) : '-'} tokens\n` +
            `💰 Price: $${fmtUSD(t.price_usd || 0)} — Proceeds: $${fmtUSD(proceeds)}\n` +
            `📈 PnL: $${fmtUSD(pnl)} (${pctText})\n` +
            `${when}`;
        }
        const emoji = '➕';
        return `${emoji} ${t.type.toUpperCase()} — $${fmtUSD(t.sol_amount || 0)} — ${when}`;
      });

      const out = lines.join('\n\n');
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔁 Refresh', `trades:refresh:${filter}`), Markup.button.callback('❌ Cancel', `trades:cancel`)]
      ]);

      // send as a single message with refresh/cancel
      const sent = await ctx.reply(out, keyboard);
    } catch (err) {
      console.error('trades command error', err);
      await ctx.reply('Error retrieving trades.');
    }
  });

  // Refresh trades inline
  bot.action(/trades:refresh:.+/, async (ctx) => {
    try {
      const data = ctx.callbackQuery && ctx.callbackQuery.data;
      if (!data) return;
      const parts = data.split(':');
      const filter = parts[2] || 'sell';
      const callbackMsg = ctx.callbackQuery && ctx.callbackQuery.message;
      const chatId = callbackMsg && callbackMsg.chat && callbackMsg.chat.id;
      const msgId = callbackMsg && (callbackMsg.message_id || callbackMsg.messageId);
      await ctx.answerCbQuery().catch(() => {});

      // re-run the command logic quickly
      const { models } = await initDB();
      const where = { user_id: ctx.state.user.id };
      if (filter === 'sell' || filter === 'sold' || filter === 'sells') where.type = 'sell';
      else if (filter === 'buy' || filter === 'buys' || filter === 'b') where.type = 'buy';
      const txs = await models.Transaction.findAll({ where, order: [['created_at', 'DESC']], limit: 100 });
      if (!txs || txs.length === 0) {
        try { await ctx.editMessageText('No trades found.'); } catch (e) { await ctx.reply('No trades found.'); }
        return;
      }
      const lines = txs.map(t => {
        const when = t.created_at ? new Date(t.created_at).toLocaleString() : '';
        if (t.type === 'buy') {
          const emoji = '🟢';
          return `${emoji} BUY — ${t.token_symbol || ''}\n` +
            `🪙 Amount: ${t.token_amount ? Number(t.token_amount).toFixed(6) : '-'} tokens\n` +
            `💰 Price: $${fmtUSD(t.price_usd || 0)} — Total: $${fmtUSD(t.total_usd || 0)}\n` +
            `${when}`;
        }
        if (t.type === 'sell') {
          const pnl = parseFloat(t.pnl_usd) || 0;
          const proceeds = parseFloat(t.total_usd) || 0;
          const cost = proceeds - pnl;
          let pct = null;
          if (cost && Number.isFinite(cost) && cost !== 0) pct = (pnl / cost) * 100;
          const emoji = pnl >= 0 ? '�' : '�🔴';
          const pctText = pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : 'N/A';
          return `${emoji} SELL — ${t.token_symbol || ''}\n` +
            `🪙 Sold: ${t.token_amount ? Number(t.token_amount).toFixed(6) : '-'} tokens\n` +
            `💰 Price: $${fmtUSD(t.price_usd || 0)} — Proceeds: $${fmtUSD(proceeds)}\n` +
            `📈 PnL: $${fmtUSD(pnl)} (${pctText})\n` +
            `${when}`;
        }
        const emoji = '➕';
        return `${emoji} ${t.type.toUpperCase()} — $${fmtUSD(t.sol_amount || 0)} — ${when}`;
      });
      const out = lines.join('\n\n');
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔁 Refresh', `trades:refresh:${filter}`), Markup.button.callback('❌ Cancel', `trades:cancel`)]
      ]);
      try {
        await ctx.telegram.editMessageText(chatId, msgId, undefined, out, { reply_markup: keyboard.reply_markup });
      } catch (e) {
        await ctx.reply(out, keyboard);
      }
    } catch (err) {
      console.error('trades refresh error', err);
      try { await ctx.answerCbQuery('Failed to refresh'); } catch (e) {}
    }
  });

  // Cancel trades view
  bot.action('trades:cancel', async (ctx) => {
    try {
      const callbackMsg = ctx.callbackQuery && ctx.callbackQuery.message;
      const chatId = callbackMsg && callbackMsg.chat && callbackMsg.chat.id;
      const msgId = callbackMsg && (callbackMsg.message_id || callbackMsg.messageId);
      await ctx.answerCbQuery().catch(() => {});
      try { await ctx.deleteMessage(msgId); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('trades cancel error', err);
    }
  });
};
