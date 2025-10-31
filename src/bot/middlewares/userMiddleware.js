import { getOrCreateUser } from '../../services/userService.js';


export default async (ctx, next) => {
  try {
    const tgId = ctx.from && ctx.from.id;
    if (!tgId) return next();
    // Attach user to context (lazy-load)
    const user = await getOrCreateUser(tgId);
    ctx.state.user = user;
  } catch (err) {
    console.error('User middleware error', err);
  }
  return next();
};
