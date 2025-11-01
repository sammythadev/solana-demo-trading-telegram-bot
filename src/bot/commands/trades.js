import { initDB } from '../../db/index.js';
import { fmtUSD } from '../utils/formatters.js';

export default (bot) => {
  // /trades [sold]
  bot.command('trades', async (ctx) => {
    try {
      const text = (ctx.message && ctx.message.text) ? ctx.message.text.trim() : '';
      const args = text.split(' ').slice(1);
  const filter = args[0] ? args[0].toLowerCase() : null; // 'sold' to show only sells
  // default behavior: show only sold trades. Use `trades all` to see everything or `trades buys` to see buys only.
      const { models } = await initDB();
      const where = { user_id: ctx.state.user.id };
      if (!filter) {
        // default: only sold trades
        where.type = 'sell';
      } else if (filter === 'sold' || filter === 'sells' || filter === 'sell') {
        where.type = 'sell';
      } else if (filter === 'buy' || filter === 'buys' || filter === 'b') {
        where.type = 'buy';
      } else if (filter === 'all' || filter === 'a') {
        // no type filter
      } else {
        // unknown filter - respond with usage hint
        return ctx.reply('Usage: /trades [sold|buys|all] — default is sold');
      }

      const txs = await models.Transaction.findAll({ where, order: [['created_at', 'DESC']], limit: 100 });
      if (!txs || txs.length === 0) return ctx.reply('No trades found.');

      const lines = txs.map(t => {
        const when = t.created_at ? new Date(t.created_at).toLocaleString() : '';
        if (t.type === 'buy') {
          const emoji = '🟢';
          return `${emoji} BUY — ${t.token_symbol || ''}\n` +
            `🪙 Amount: ${t.token_amount ? Number(t.token_amount).toFixed(6) : '-'} tokens\n` +
            `💰 Price: $${fmtUSD(t.price_usd || 0)} — Total: $${fmtUSD(t.total_usd || 0)}\n` +
            `🔁 ${when}`;
        }
        if (t.type === 'sell') {
          const emoji = '🔴';
          return `${emoji} SELL — ${t.token_symbol || ''}\n` +
            `🪙 Sold: ${t.token_amount ? Number(t.token_amount).toFixed(6) : '-'} tokens\n` +
            `💰 Price: $${fmtUSD(t.price_usd || 0)} — Proceeds: $${fmtUSD(t.total_usd || 0)}\n` +
            `📈 PnL: $${fmtUSD(t.pnl_usd || 0)}\n` +
            `🔁 ${when}`;
        }
        const emoji = '➕';
        return `${emoji} ${t.type.toUpperCase()} — $${fmtUSD(t.sol_amount || 0)} — ${when}`;
      });

      // send in chunks to avoid long messages
      const chunkSize = 10;
      for (let i = 0; i < lines.length; i += chunkSize) {
        await ctx.reply(lines.slice(i, i + chunkSize).join('\n\n'));
      }
    } catch (err) {
      console.error('trades command error', err);
      await ctx.reply('Error retrieving trades.');
    }
  });
};
