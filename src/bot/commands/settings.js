import { updateSpeed } from '../../services/userService.js';
import { Markup } from 'telegraf';

export default (bot) => {
  bot.command('settings', async (ctx) => {
    const current = ctx.state.user && ctx.state.user.speed_mode ? ctx.state.user.speed_mode : 'normal';
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(`Turbo ${current === 'turbo' ? '✅' : ''}`, `settings:set:turbo`), Markup.button.callback(`Fast ${current === 'fast' ? '✅' : ''}`, `settings:set:fast`)],
      [Markup.button.callback(`Normal ${current === 'normal' ? '✅' : ''}`, `settings:set:normal`), Markup.button.callback(`Slow ${current === 'slow' ? '✅' : ''}`, `settings:set:slow`)],
    ]);

  const out = `⚙️ Execution speed settings\n\nCurrent: ${current}\n\nChoose your preferred execution speed (internal gas fees are applied automatically).`;
    return ctx.reply(out, keyboard);
  });

  bot.action(/^settings:set:.+/, async (ctx) => {
    try {
      const data = ctx.callbackQuery && ctx.callbackQuery.data;
      if (!data) return ctx.answerCbQuery();
      await ctx.answerCbQuery();
      const parts = data.split(':');
      if (parts.length < 3) return ctx.reply('Invalid callback');
      const mode = parts[2];
      if (!['turbo','fast','normal','slow'].includes(mode)) return ctx.reply('Invalid mode');
      const user = await updateSpeed(ctx.state.user, mode);
      return ctx.reply(`Speed updated to ${user.speed_mode}`);
    } catch (err) {
      console.error('settings action error', err);
      return ctx.reply('Failed to update settings.');
    }
  });
};
