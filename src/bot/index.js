import bot from './bot.js';
export const initBot = async () => {
  // start the Telegraf bot
  try {
    // drop pending updates to avoid conflicts if another instance previously polled
    await bot.launch({
      polling: { drop_pending_updates: true }
    });
    console.log('Telegraf launched');
  } catch (err) {
    // If a 409 conflict occurs (another getUpdates running), log and exit gracefully
    console.error('Telegraf launch error', err && err.response ? err.response.description || err : err);
    throw err;
  }
  // graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};
