import { initDB } from '../db/index.js';
import { getSolUsd } from './tradeService.js';

export const getBalance = async (user) => {
  try {
    const solUsd = await getSolUsd();
    const usd = (parseFloat(user.balance_sol) || 0) * solUsd;
    return { balance_sol: user.balance_sol, balance_usd: usd };
  } catch (err) {
    console.error('getBalance error', err);
    return { balance_sol: user.balance_sol, balance_usd: null };
  }
};

export const topupBalance = async (user, amount) => {
  const { models } = await initDB();
  const u = await models.User.findByPk(user.id);
  u.balance_sol = parseFloat(u.balance_sol) + parseFloat(amount);
  await u.save();
  return u;
};
