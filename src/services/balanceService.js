import { initDB } from '../db/index.js';

export const getBalance = async (user) => {
  return { balance_sol: user.balance_sol, balance_usd: null };
};

export const topupBalance = async (user, amount) => {
  const { models } = await initDB();
  const u = await models.User.findByPk(user.id);
  u.balance_sol = parseFloat(u.balance_sol) + parseFloat(amount);
  await u.save();
  return u;
};
