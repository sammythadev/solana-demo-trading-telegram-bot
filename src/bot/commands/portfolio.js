import { initDB } from '../../db/index.js';
import { fetchTokenData } from '../utils/dexApi.js';
import { parseDexData } from '../utils/tokenParser.js';
import { fmtUSD } from '../utils/formatters.js';
import { Markup } from 'telegraf';
import { acquireLock, releaseLock } from '../../cache/redisClient.js';

const PAGE_SIZE = 5;

// per-message locks to ensure idempotent handling of pagination/callbacks
const messageLocks = new Map(); // key: chatId:messageId -> boolean

const lockKey = (chatId, messageId) => `${chatId}:${messageId}`;
const redisLockKey = (chatId, messageId) => `lock:portfolio:${chatId}:${messageId}`;

async function buildPage(user, page) {
  const { models } = await initDB();
  const positions = await models.Position.findAll({ where: { user_id: user.id } });
  if (!positions || positions.length === 0) return { text: 'No open positions.', keyboard: null };

  const totalPages = Math.max(1, Math.ceil(positions.length / PAGE_SIZE));
  const p = Math.max(0, Math.min(page, totalPages - 1));
  const start = p * PAGE_SIZE;
  const slice = positions.slice(start, start + PAGE_SIZE);

  const lines = [];
  const buttons = [];

  // Fetch token data in parallel for the page slice to reduce waiting on network
  const fetches = slice.map((pos) => fetchTokenData(pos.token_address).then((d) => ({ pos, data: d })).catch((err) => ({ pos, data: null })));
  const results = await Promise.all(fetches);

  for (const item of results) {
    const pos = item.pos;
    const data = item.data;
    if (!data) {
      lines.push(`🪙 ${pos.symbol || 'TKN'}\nPrice unavailable\nAmount: ${pos.amount_tokens}`);
      buttons.push([Markup.button.callback(`Sell ${pos.symbol || ''}`, `portfolio:sell:${pos.token_address}`)]);
      continue;
    }
    try {
      const parsed = parseDexData(data);
      const price = parsed.priceUsd || 0;
      const liquidity = parsed.liquidityUsd || null;
      const fdv = parsed.fdv || null;
      const change24 = parsed.change24h !== null ? parsed.change24h : null;
      const amount = parseFloat(pos.amount_tokens) || 0;
      const valueUsd = amount * price;
      const costUsd = amount * (parseFloat(pos.buy_price) || 0);
      const pnlUsd = valueUsd - costUsd;
      const rawPct = costUsd ? ((pnlUsd / costUsd) * 100) : 0;
      const pct = (rawPct >= 0 ? '+' : '') + rawPct.toFixed(2);
      const pnlSign = pnlUsd >= 0 ? '+' : '-';
      const pnlEmoji = pnlUsd >= 0 ? '🟢' : '🔴';

      const entry = `🪙 ${parsed.name || parsed.symbol || 'Unknown'} (${parsed.symbol || pos.symbol || '—'})\n` +
        `💰 Price: $${fmtUSD(price)}\n` +
        `💧 Liquidity: $${fmtUSD(liquidity)}\n` +
        `📊 MCAP: $${fmtUSD(fdv)}\n` +
        `📈 24h: ${change24 !== null ? change24 + '%' : 'N/A'}\n` +
        `🔢 Amount: ${amount}\n` +
        `💵 Value: $${fmtUSD(valueUsd)} — ${pnlEmoji} PnL: ${pct}% (${pnlSign}$${fmtUSD(Math.abs(pnlUsd))})`;

      lines.push(entry);
      buttons.push([Markup.button.callback(`Sell ${pos.symbol || ''}`, `portfolio:sell:${pos.token_address}`)]);
    } catch (err) {
      lines.push(`🪙 ${pos.symbol || 'TKN'}\nPrice unavailable\nAmount: ${pos.amount_tokens}`);
      buttons.push([Markup.button.callback(`Sell ${pos.symbol || ''}`, `portfolio:sell:${pos.token_address}`)]);
    }
  }

  // pagination controls
  const nav = [];
  if (p > 0) nav.push(Markup.button.callback('« Prev', `portfolio:page:${p - 1}`));
  if (p < totalPages - 1) nav.push(Markup.button.callback('Next »', `portfolio:page:${p + 1}`));

  const controlRow = [Markup.button.callback('🔁 Refresh', `portfolio:refresh:${p}`), Markup.button.callback('❌ Cancel', `portfolio:cancel:${p}`)];
  const keyboard = Markup.inlineKeyboard([...buttons, nav, controlRow]);
  const header = `Portfolio — page ${p + 1}/${totalPages}\n`;
  // separate entries with a blank line for readability
  return { text: header + lines.join('\n\n'), keyboard };
}

export default (bot) => {
  bot.command('portfolio', async (ctx) => {
    try {
      // send an immediate loading message so the user sees a quick response
      const loading = await ctx.reply('⏳ Loading portfolio...');
      const chatId = loading.chat.id || ctx.chat.id;
      const msgId = loading.message_id || loading.messageId || (loading.result && loading.result.message_id);
      const key = lockKey(chatId, msgId);
      const rkey = redisLockKey(chatId, msgId);

      // Try to acquire Redis lock first (cross-process); fallback to in-memory lock
      let token = null;
      try {
        token = await acquireLock(rkey, 30000);
      } catch (e) {
        // ignore redis lock failures
        token = null;
      }
      if (!token) {
        // fall back to in-memory lock
        if (messageLocks.has(key)) {
          try { await ctx.answerCbQuery('Still loading...'); } catch (e) {}
          return;
        }
        messageLocks.set(key, true);
      }

      try {
        const start = Date.now();
        const { text, keyboard } = await buildPage(ctx.state.user, 0);
        const dur = Date.now() - start;
        console.log(`buildPage duration: ${dur}ms for user ${ctx.state.user && ctx.state.user.id}`);
        // try to edit the loading message with the full page
        try {
          if (keyboard) await ctx.telegram.editMessageText(chatId, msgId, undefined, text, { reply_markup: keyboard.reply_markup });
          else await ctx.telegram.editMessageText(chatId, msgId, undefined, text);
        } catch (e) {
          // if edit fails (maybe message too old), delete loading and send a fresh message
          try { await ctx.deleteMessage(msgId); } catch (delErr) { /* ignore */ }
          await ctx.reply(text, keyboard);
        }
      } finally {
        // release locks
        if (token) {
          try { await releaseLock(rkey, token); } catch (e) { /* ignore */ }
        } else {
          messageLocks.delete(key);
        }
      }
    } catch (err) {
      console.error('portfolio error', err);
      await ctx.reply('Error retrieving portfolio.');
    }
  });

  // Refresh action
  bot.action(/portfolio:refresh:\d+/, async (ctx) => {
    const data = ctx.callbackQuery && ctx.callbackQuery.data;
    if (!data) return;
    const parts = data.split(':');
    const page = parseInt(parts[2], 10) || 0;
    const callbackMsg = ctx.callbackQuery && ctx.callbackQuery.message;
    const chatId = callbackMsg && callbackMsg.chat && callbackMsg.chat.id;
    const msgId = callbackMsg && (callbackMsg.message_id || callbackMsg.messageId);
    const key = lockKey(chatId, msgId);
    if (messageLocks.has(key)) {
      try { await ctx.answerCbQuery('Still loading...'); } catch (e) { }
      return;
    }
    messageLocks.set(key, true);
    try {
      await ctx.answerCbQuery().catch(() => {});
      const { text, keyboard } = await buildPage(ctx.state.user, page);
      try {
        if (keyboard) await ctx.telegram.editMessageText(chatId, msgId, undefined, text, { reply_markup: keyboard.reply_markup });
        else await ctx.telegram.editMessageText(chatId, msgId, undefined, text);
      } catch (e) {
        try { await ctx.deleteMessage(msgId); } catch (delErr) { }
        await ctx.reply(text, keyboard);
      }
    } catch (err) {
      console.error('portfolio refresh error', err);
      try { await ctx.answerCbQuery('Failed to refresh'); } catch (e) {}
    } finally {
      messageLocks.delete(key);
    }
  });

  // Cancel action - delete the original message
  bot.action(/portfolio:cancel:\d+/, async (ctx) => {
    try {
      const callbackMsg = ctx.callbackQuery && ctx.callbackQuery.message;
      const chatId = callbackMsg && callbackMsg.chat && callbackMsg.chat.id;
      const msgId = callbackMsg && (callbackMsg.message_id || callbackMsg.messageId);
      await ctx.answerCbQuery();
      try { await ctx.deleteMessage(msgId); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('portfolio cancel error', err);
    }
  });

  // pagination handler
  bot.action(/portfolio:page:\d+/, async (ctx) => {
    const data = ctx.callbackQuery && ctx.callbackQuery.data;
    if (!data) return;
    const parts = data.split(':');
    const page = parseInt(parts[2], 10) || 0;

    // identify the original message (the one with the inline keyboard)
    const callbackMsg = ctx.callbackQuery && ctx.callbackQuery.message;
    const chatId = callbackMsg && callbackMsg.chat && callbackMsg.chat.id;
    const msgId = callbackMsg && (callbackMsg.message_id || callbackMsg.messageId);
    const key = lockKey(chatId, msgId);

    // if already processing this message, quickly ack and return to avoid duplicate work
    if (messageLocks.has(key)) {
      try { await ctx.answerCbQuery('Still loading...'); } catch (e) { /* ignore */ }
      return;
    }

    // set lock and acknowledge callback quickly
    messageLocks.set(key, true);
    try {
      try {
        await ctx.answerCbQuery().catch((e) => {
          if (e && e.response && e.response.error_code === 400) return;
          throw e;
        });
      } catch (err) {
        console.warn('answerCbQuery warning', err && err.message ? err.message : err);
      }

      const { text, keyboard } = await buildPage(ctx.state.user, page);
      // edit the original message if possible, otherwise send new
      try {
        if (keyboard) await ctx.telegram.editMessageText(chatId, msgId, undefined, text, { reply_markup: keyboard.reply_markup });
        else await ctx.telegram.editMessageText(chatId, msgId, undefined, text);
      } catch (e) {
        // fallback to reply
        await ctx.reply(text, keyboard);
      }
    } catch (err) {
      console.error('portfolio pagination error', err);
      try { await ctx.answerCbQuery('Failed to load page'); } catch (e) { /* ignore */ }
    } finally {
      messageLocks.delete(key);
    }
  });

  // show sell options when Sell button is pressed
  bot.action(/portfolio:sell:.+/, async (ctx) => {
    try {
      const data = ctx.callbackQuery.data;
      const parts = data.split(':');
      const mint = parts[2];
      await ctx.answerCbQuery();
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('25%', `sell:${mint}:25`), Markup.button.callback('50%', `sell:${mint}:50`)],
        [Markup.button.callback('75%', `sell:${mint}:75`), Markup.button.callback('100%', `sell:${mint}:100`)],
        [Markup.button.callback('Custom', `sell:${mint}:custom`)]
      ]);
      await ctx.reply(`Sell options for ${mint}:`, keyboard);
    } catch (err) {
      console.error('portfolio sell action error', err);
    }
  });
};
