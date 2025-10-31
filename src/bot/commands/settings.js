import { updateSpeed } from '../../services/userService.js';
export default (bot) => {
  bot.command('settings', async (ctx) => {
    const parts = (ctx.message.text || '').split(' ').slice(1);
    if (!parts[0]) {
      return ctx.reply(`Current speed: ${ctx.state.user.speed_mode}\nChange with /settings <turbo|fast|normal|slow>`);
    }
    const mode = parts[0].toLowerCase();
    if (!['turbo','fast','normal','slow'].includes(mode)) return ctx.reply('Invalid mode. Use turbo|fast|normal|slow');
    try {
      const user = await updateSpeed(ctx.state.user, mode);
      await ctx.reply(`Speed updated to ${user.speed_mode}`);
    } catch (err) {
      console.error('settings error', err);
      await ctx.reply('Failed to update settings.');
    }
  });
};
