export default (bot) => {
  bot.command('help', async (ctx) => {
    const helpText = [
      '/start - Register and show balance',
      '/token <mint> - Show token details',
      '/buy <mint> <sol> - Simulate buy',
      '/sell <mint> <percent> - Simulate sell',
      '/portfolio - View open positions',
      '/positions - view positions in clean view',
      '/balance - View SOL balance',
      '/topup <amount> - Add demo SOL',
      '/settings - Change execution speed'
    ].join('\n');
    await ctx.reply(helpText);
  });
};
