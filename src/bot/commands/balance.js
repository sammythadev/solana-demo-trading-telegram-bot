import { getBalance } from '../../services/balanceService.js';
export default (bot) => {
  bot.command('balance', async (ctx) => {
    try {
      const b = await getBalance(ctx.state.user);
      await ctx.reply(`💰 Balance: ${b.balance_sol} SOL ($${b.balance_usd || 'N/A'})`);
    } catch (err) {
      console.error('balance error', err);
      await ctx.reply('Error retrieving balance.');
    }
  });
};
