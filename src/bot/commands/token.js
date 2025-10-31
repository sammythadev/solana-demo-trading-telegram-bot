import { fetchTokenData } from '../utils/dexApi.js';
import { parseDexData } from '../utils/tokenParser.js';
import { fmtUSD } from '../utils/formatters.js';
export default (bot) => {
  bot.command('token', async (ctx) => {
    const text = ctx.message.text || '';
    const args = text.split(' ').slice(1);
    if (!args[0]) return ctx.reply('Usage: /token <mint_address>');
    const mint = args[0].trim();
    try {
      const data = await fetchTokenData(mint);
      if (!data) return ctx.reply('Token not found on Dexscreener.');
      const parsed = parseDexData(data);
  const out = `🪙 ${parsed.name || parsed.symbol || 'Unknown'} (${parsed.symbol || '—'})\n💰 Price: $${fmtUSD(parsed.priceUsd)}\n💧 Liquidity: $${fmtUSD(parsed.liquidityUsd)}\n📊 FDV: $${fmtUSD(parsed.fdv)}mcap\n📈 24h: ${parsed.change24h !== null ? parsed.change24h + '%' : 'N/A'}\n🔗 ${parsed.url || ''}`;
      await ctx.reply(out);
    } catch (err) {
      console.error('token command error', err);
      await ctx.reply('Error fetching token data.');
    }
  });
};
