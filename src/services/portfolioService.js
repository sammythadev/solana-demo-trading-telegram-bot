import { initDB } from '../db/index.js';
import { fetchTokenData } from '../bot/utils/dexApi.js';

export const getPortfolioSummary = async (user) => {
  const { models } = await initDB();
  const positions = await models.Position.findAll({ where: { user_id: user.id }});
  if (!positions || positions.length === 0) return 'No open positions.';
  let lines = [];
  let totalUsd = 0;
  for (const p of positions) {
    try {
      const data = await fetchTokenData(p.token_address);
      const price = data.priceUsd || (data.pairs && data.pairs[0] && data.pairs[0].priceUsd) || 0;
      const valueUsd = p.amount_tokens * price;
      const costUsd = p.amount_tokens * p.buy_price;
      const pnlUsd = valueUsd - costUsd;
      totalUsd += valueUsd;
      const emoji = pnlUsd >= 0 ? '📈' : '📉';
      lines.push(`${emoji} ${p.symbol}: ${((pnlUsd/costUsd)*100).toFixed(2)}% ($${pnlUsd.toFixed(2)})`);
    } catch (err) {
      lines.push(`${p.symbol}: price unavailable`);
    }
  }
  lines.push(`\nTotal portfolio value: $${totalUsd.toFixed(2)}`);
  return lines.join('\n');
};
