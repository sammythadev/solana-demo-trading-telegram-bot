import { initDB } from '../db/index.js';
let dbCache = null;

const getDB = async () => {
  if (dbCache) return dbCache;
  dbCache = await initDB();
  return dbCache;
};

export const createOrGetUser = async (telegram_id) => {
  const { models } = await getDB();
  let user = await models.User.findOne({ where: { telegram_id }});
  if (!user) {
    user = await models.User.create({ telegram_id });
  }
  return user;
};

export const getOrCreateUser = createOrGetUser;

export const updateSpeed = async (user, mode) => {
  const { models } = await getDB();
  user.speed_mode = mode;
  await user.save();
  return user;
};
