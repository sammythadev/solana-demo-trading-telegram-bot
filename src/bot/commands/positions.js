import { initDB } from '../../db/index.js';
import { fetchTokenData } from '../utils/dexApi.js';
import { parseDexData } from '../utils/tokenParser.js';
import { fmtUSD } from '../utils/formatters.js';

export default (bot) => {
  bot.command('positions', async (ctx) => {
    try {
      const { models } = await initDB();
      const positions = await models.Position.findAll({ where: { user_id: ctx.state.user.id } });
      if (!positions || positions.length === 0) return ctx.reply('No open positions.');

      const lines = [];
      for (const p of positions) {
        try {
          const data = await fetchTokenData(p.token_address);
          const parsed = parseDexData(data);
          const price = parsed.priceUsd || 0;
          const amount = parseFloat(p.amount_tokens) || 0;
          const valueUsd = amount * price;
          const costUsd = amount * (parseFloat(p.buy_price) || 0);
          const pnlUsd = valueUsd - costUsd;
          const rawPct = costUsd ? ((pnlUsd / costUsd) * 100) : 0;
          const pnlPct = (rawPct >= 0 ? '+' : '') + rawPct.toFixed(2);
          const pnlSign = pnlUsd >= 0 ? '+' : '-';
          const pnlEmoji = pnlUsd >= 0 ? '�' : '�';

          const entry = `🪙 ${parsed.name || parsed.symbol || 'Unknown'} (${parsed.symbol || p.symbol || '—'})\n` +
            `🔢 Amount: ${amount}\n` +
            `💰 Price: $${fmtUSD(price)}\n` +
            `💵 Value: $${fmtUSD(valueUsd)}\n` +
            `${pnlEmoji} PnL: ${pnlPct}% (${pnlSign}$${fmtUSD(Math.abs(pnlUsd))})`;

          lines.push(entry);
        } catch (err) {
          lines.push(`🪙 ${p.symbol || 'TKN'}\nPrice unavailable\nAmount: ${p.amount_tokens}`);
        }
      }

      // separate entries with a blank line for readability
      return ctx.reply(lines.join('\n\n'));
    } catch (err) {
      console.error('positions command error', err);
      return ctx.reply('Error retrieving positions.');
    }
  });
};
