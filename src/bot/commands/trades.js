import { initDB } from '../../db/index.js';
import { fmtUSD } from '../utils/formatters.js';
import { Markup } from 'telegraf';
import { Op, fn, col, literal } from 'sequelize';

export default (bot) => {
  // /trades [sold|buys|all] - paginated display
  bot.command('trades', async (ctx) => {
    try {
      const text = (ctx.message && ctx.message.text) ? ctx.message.text.trim() : '';
      const args = text.split(' ').slice(1);
      let filter = args[0] ? args[0].toLowerCase() : null; // 'sold' to show only sells
      if (!filter) filter = 'sell';
      if (!['sell','sold','sells','buy','buys','b','all','a'].includes(filter)) {
        return ctx.reply('Usage: /trades [sold|buys|all] — default is sold');
      }

      const normalizedFilter = (filter === 'all' || filter === 'a') ? 'all' : (['buy','buys','b'].includes(filter) ? 'buy' : 'sell');
      const page = 0;
      await sendTradesPage(ctx, normalizedFilter, page);
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
      const normalizedFilter = (filter === 'all' || filter === 'a') ? 'all' : (['buy','buys','b'].includes(filter) ? 'buy' : 'sell');
      // re-render page 0 for refresh
      await sendTradesPage(ctx, normalizedFilter, 0, chatId, msgId);
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

  // Pagination handler for trades pages
  bot.action(/trades:page:.+/, async (ctx) => {
    try {
      const data = ctx.callbackQuery && ctx.callbackQuery.data;
      if (!data) return;
      const parts = data.split(':');
      // expected format: trades:page:<filter>:<page>
      const filter = parts[2] || 'sell';
      const page = parseInt(parts[3], 10) || 0;
      const callbackMsg = ctx.callbackQuery && ctx.callbackQuery.message;
      const chatId = callbackMsg && callbackMsg.chat && callbackMsg.chat.id;
      const msgId = callbackMsg && (callbackMsg.message_id || callbackMsg.messageId);
      await ctx.answerCbQuery().catch(() => {});
      const normalizedFilter = (filter === 'all' || filter === 'a') ? 'all' : (['buy','buys','b'].includes(filter) ? 'buy' : 'sell');
      await sendTradesPage(ctx, normalizedFilter, page, chatId, msgId);
    } catch (err) {
      console.error('trades pagination error', err);
      try { await ctx.answerCbQuery('Failed to load page'); } catch (e) {}
    }
  });
};

// Helper: render and send (or edit) a trades page. If chatId/msgId provided
// attempt to edit message; otherwise send a fresh reply.
async function sendTradesPage(ctx, filter, page = 0, editChatId = null, editMsgId = null) {
  const PAGE_SIZE = 10;
  const { models } = await initDB();
  const where = { user_id: ctx.state.user.id };
  if (filter === 'sell') where.type = 'sell';
  else if (filter === 'buy') where.type = 'buy';

  // Paginated fetch
  const offset = Math.max(0, page) * PAGE_SIZE;
  const { count, rows: txs } = await models.Transaction.findAndCountAll({ where, order: [['created_at', 'DESC']], limit: PAGE_SIZE, offset });

  if (!txs || txs.length === 0) {
    try { if (editChatId && editMsgId) await ctx.editMessageText('No trades found.'); else await ctx.reply('No trades found.'); } catch (e) { await ctx.reply('No trades found.'); }
    return;
  }

  // Compute aggregate stats over the same filter (use aggregated query for efficiency)
  const sequelize = models.Transaction.sequelize;
  const stats = await models.Transaction.findAll({
    where,
    attributes: [
      [fn('COALESCE', fn('SUM', col('pnl_usd')), 0), 'sumPnl'],
      [fn('COALESCE', fn('SUM', col('total_usd')), 0), 'sumTotal'],
      [fn('SUM', literal("CASE WHEN pnl_usd > 0 THEN 1 ELSE 0 END")), 'wins'],
      [fn('SUM', literal("CASE WHEN pnl_usd < 0 THEN 1 ELSE 0 END")), 'losses']
    ],
    raw: true
  });

  const sumPnl = parseFloat(stats[0].sumPnl) || 0;
  const sumTotal = parseFloat(stats[0].sumTotal) || 0; // proceeds sum
  const wins = parseInt(stats[0].wins, 10) || 0;
  const losses = parseInt(stats[0].losses, 10) || 0;
  const totalTrades = count || 0;
  const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100) : 0;
  // Estimate profit % relative to total cost = total proceeds - total pnl
  const totalCost = Math.max(0, sumTotal - sumPnl);
  const profitPct = totalCost > 0 ? (sumPnl / totalCost) * 100 : 0;

  const header = `Trades — ${totalTrades} total — PnL: $${fmtUSD(sumPnl)} (${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%) — Wins: ${wins} / Losses: ${losses} (Win rate ${winRate.toFixed(1)}%)\n\n`;

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

  const out = header + lines.join('\n\n');

  // pagination controls
  const totalPages = Math.max(1, Math.ceil(totalTrades / PAGE_SIZE));
  const p = Math.max(0, Math.min(page, totalPages - 1));
  const nav = [];
  if (p > 0) nav.push(Markup.button.callback('« Prev', `trades:page:${filter}:${p - 1}`));
  if (p < totalPages - 1) nav.push(Markup.button.callback('Next »', `trades:page:${filter}:${p + 1}`));
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback('🔁 Refresh', `trades:refresh:${filter}`), Markup.button.callback('❌ Cancel', `trades:cancel`)], nav]);

  try {
    if (editChatId && editMsgId) await ctx.telegram.editMessageText(editChatId, editMsgId, undefined, out, { reply_markup: keyboard.reply_markup });
    else await ctx.reply(out, keyboard);
  } catch (e) {
    // fallback to reply if edit fails
    await ctx.reply(out, keyboard);
  }
}
