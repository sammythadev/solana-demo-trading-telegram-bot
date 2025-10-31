export default (bot) => {
  bot.command('start', async (ctx) => {
    const tgId = ctx.from.id;
    // userService handles creation
    const { createOrGetUser } = await import('../../services/userService.js');
    const user = await createOrGetUser(tgId);
    await ctx.reply(`Welcome! Your demo account has ${user.balance_sol} SOL. Use /help to see commands.`);
  });
};
