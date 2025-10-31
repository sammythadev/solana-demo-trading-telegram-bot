import { initDB } from '../../db/index.js';
import { fetchTokenData } from '../utils/dexApi.js';
import { parseDexData } from '../utils/tokenParser.js';
import { fmtUSD } from '../utils/formatters.js';
import { Markup } from 'telegraf';

const PAGE_SIZE = 5;

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
  for (const pos of slice) {
    try {
      const data = await fetchTokenData(pos.token_address);
      const parsed = parseDexData(data);
      const price = parsed.priceUsd || 0;
      const liquidity = parsed.liquidityUsd || null;
      const fdv = parsed.fdv || null;
      const change24 = parsed.change24h !== null ? parsed.change24h : null;
      const amount = parseFloat(pos.amount_tokens) || 0;
      const valueUsd = amount * price;
      const costUsd = amount * (parseFloat(pos.buy_price) || 0);
      const pnlUsd = valueUsd - costUsd;
      const pct = costUsd ? ((pnlUsd / costUsd) * 100).toFixed(2) : '0.00';

      const entry = `🪙 ${parsed.name || parsed.symbol || 'Unknown'} (${parsed.symbol || pos.symbol || '—'})\n` +
        `💰 Price: $${fmtUSD(price)}\n` +
        `💧 Liquidity: $${fmtUSD(liquidity)}\n` +
        `📊 FDV: $${fmtUSD(fdv)}mcap\n` +
        `📈 24h: ${change24 !== null ? change24 + '%' : 'N/A'}\n` +
        `🔢 Amount: ${amount}\n` +
        `💵 Value: $${fmtUSD(valueUsd)} — PnL: ${pct}% ($${fmtUSD(pnlUsd)})`;

      lines.push(entry);
    } catch (err) {
      lines.push(`🪙 ${pos.symbol || 'TKN'}\nPrice unavailable\nAmount: ${pos.amount_tokens}`);
    }
    // add a Sell button per position (one button row per position)
    buttons.push([Markup.button.callback(`Sell ${pos.symbol || ''}`, `portfolio:sell:${pos.token_address}`)]);
  }

  // pagination controls
  const nav = [];
  if (p > 0) nav.push(Markup.button.callback('« Prev', `portfolio:page:${p - 1}`));
  if (p < totalPages - 1) nav.push(Markup.button.callback('Next »', `portfolio:page:${p + 1}`));

  const keyboard = Markup.inlineKeyboard([...buttons, nav]);
  const header = `Portfolio — page ${p + 1}/${totalPages}\n`;
  // separate entries with a blank line for readability
  return { text: header + lines.join('\n\n'), keyboard };
}

export default (bot) => {
  bot.command('portfolio', async (ctx) => {
    try {
      const { text, keyboard } = await buildPage(ctx.state.user, 0);
      if (keyboard) await ctx.reply(text, keyboard);
      else await ctx.reply(text);
    } catch (err) {
      console.error('portfolio error', err);
      await ctx.reply('Error retrieving portfolio.');
    }
  });

  // pagination handler
  bot.action(/portfolio:page:\d+/, async (ctx) => {
    try {
      const data = ctx.callbackQuery.data;
      const parts = data.split(':');
      const page = parseInt(parts[2], 10) || 0;
      await ctx.answerCbQuery();
      const { text, keyboard } = await buildPage(ctx.state.user, page);
      // edit the original message if possible, otherwise send new
      try {
        await ctx.editMessageText(text, { reply_markup: keyboard ? keyboard.reply_markup : undefined });
      } catch (e) {
        // fallback to reply
        await ctx.reply(text, keyboard);
      }
    } catch (err) {
      console.error('portfolio pagination error', err);
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
