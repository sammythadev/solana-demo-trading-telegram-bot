import { getBalance } from '../../services/balanceService.js';
export default (bot) => {
  bot.command('balance', async (ctx) => {
    try {
      const b = await getBalance(ctx.state.user);
      const usdText = b.balance_usd !== null && typeof b.balance_usd !== 'undefined' ? `$${Number(b.balance_usd).toFixed(2)}` : 'N/A';
      await ctx.reply(`💰 Balance: ${b.balance_sol} SOL (${usdText})`);
    } catch (err) {
      console.error('balance error', err);
      await ctx.reply('Error retrieving balance.');
    }
  });
};
