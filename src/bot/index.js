import bot from './bot.js';
export const initBot = async () => {
  // start the Telegraf bot
  await bot.launch();
  console.log('Telegraf launched');
  // graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};
