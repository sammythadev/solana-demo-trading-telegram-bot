import { topupBalance } from '../../services/balanceService.js';
export default (bot) => {
  bot.command('topup', async (ctx) => {
    const parts = (ctx.message.text || '').split(' ').slice(1);
    const amt = parseFloat(parts[0]);
    if (isNaN(amt) || amt <= 0) return ctx.reply('Usage: /topup <amount>');
    try {
      const user = await topupBalance(ctx.state.user, amt);
      await ctx.reply(`Topup successful. New balance: ${user.balance_sol} SOL`);
    } catch (err) {
      console.error('topup error', err);
      await ctx.reply('Topup failed.');
    }
  });
};
