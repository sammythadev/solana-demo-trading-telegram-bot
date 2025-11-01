import { fetchTokenData } from '../bot/utils/dexApi.js';
import { applySpeedDelay } from '../bot/utils/speedDelay.js';
import { initDB } from '../db/index.js';
import { GAS_USD } from '../config/constants.js';

// Use wrapped SOL mint to fetch SOL/USD from Dexscreener
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

async function getSolUsd() {
  try {
    const data = await fetchTokenData(WSOL_MINT);
    // Dexscreener token response may include priceUsd or pairs[].priceUsd
    const price = data && (data.priceUsd || (data.pairs && data.pairs[0] && data.pairs[0].priceUsd));
    if (!price) throw new Error('SOL price not found in Dexscreener response');
    const n = parseFloat(price);
    if (Number.isFinite(n) && n > 0) return n;
    throw new Error('Invalid SOL price from Dexscreener');
  } catch (err) {
    console.error('getSolUsd error:', err.message || err);
    // fallback to a conservative default if Dexscreener fails
    return 188.88;
  }
}

export const executeBuy = async (user, mint, solAmount) => {
  const db = await initDB();
  const { models } = db;
  const data = await fetchTokenData(mint);
  if (!data) throw new Error('Token not available');
  // simplistic price extraction
  const tokenPriceUsd = (data.priceUsd || (data.pairs && data.pairs[0] && data.pairs[0].priceUsd)) || null;
  if (!tokenPriceUsd) throw new Error('Token price unavailable');
  const solUsd = await getSolUsd();
  // calculate gas fee in SOL based on user's speed mode
  const mode = (user && user.speed_mode) || 'normal';
  const gasUsd = GAS_USD[mode] || GAS_USD.normal;
  const gasSol = gasUsd / solUsd;
  const tokensReceived = (solAmount * solUsd) / tokenPriceUsd;
  // deduct balance
  const userModel = await models.User.findByPk(user.id);
  if (parseFloat(userModel.balance_sol) < (solAmount + gasSol)) throw new Error('Insufficient SOL to cover amount + gas');
  userModel.balance_sol = parseFloat(userModel.balance_sol) - solAmount - gasSol;
  await userModel.save();
  // create position
  // If the user already has a position for this token, update it instead of inserting a duplicate
  let pos = await models.Position.findOne({ where: { user_id: user.id, token_address: mint } });
  const symbol = data.pairs && data.pairs[0] && data.pairs[0].baseToken ? data.pairs[0].baseToken.symbol : 'TKN';
  if (pos) {
    const existingTokens = parseFloat(pos.amount_tokens) || 0;
    const existingBuyPrice = parseFloat(pos.buy_price) || 0;
    const totalTokens = existingTokens + tokensReceived;
    // weighted average buy price
    const weightedBuyPrice = totalTokens > 0 ? ((existingBuyPrice * existingTokens) + (parseFloat(tokenPriceUsd) * tokensReceived)) / totalTokens : parseFloat(tokenPriceUsd);
    pos.amount_tokens = totalTokens;
    pos.buy_price = weightedBuyPrice;
    pos.sol_spent = (parseFloat(pos.sol_spent) || 0) + solAmount;
    // ensure symbol exists
    if (!pos.symbol) pos.symbol = symbol;
    await pos.save();
  } else {
    pos = await models.Position.create({
      user_id: user.id,
      token_address: mint,
      symbol,
      buy_price: tokenPriceUsd,
      amount_tokens: tokensReceived,
      sol_spent: solAmount
    });
  }
  // record buy transaction
  try {
    await models.Transaction.create({
      user_id: user.id,
      type: 'buy',
      token_address: mint,
      token_symbol: symbol,
      token_amount: tokensReceived,
      price_usd: parseFloat(tokenPriceUsd),
      total_usd: tokensReceived * parseFloat(tokenPriceUsd),
      sol_amount: solAmount,
      pnl_usd: null
    });
  } catch (err) {
    console.error('record buy transaction error', err);
  }
  // apply delay based on user preference
  await applySpeedDelay(user.speed_mode);
  return `✅ Trade Executed [${user.speed_mode}]\nBought ${Math.round(tokensReceived)} ${pos.symbol} at $${tokenPriceUsd} using ${solAmount} SOL`;
};

export const executeSell = async (user, mint, percent) => {
  const db = await initDB();
  const { models } = db;
  // find position
  const pos = await models.Position.findOne({ where: { user_id: user.id, token_address: mint }});
  if (!pos) throw new Error('Position not found');
  const sellTokens = pos.amount_tokens * (percent / 100);
  const data = await fetchTokenData(mint);
  const tokenPriceUsd = (data.priceUsd || (data.pairs && data.pairs[0] && data.pairs[0].priceUsd)) || null;
  if (!tokenPriceUsd) throw new Error('Token price unavailable');
  const proceedsUsd = sellTokens * tokenPriceUsd;
  const costUsd = sellTokens * pos.buy_price;
  const profitUsd = proceedsUsd - costUsd;
  const solUsd = await getSolUsd();
  const profitSol = profitUsd / solUsd;
  // update user balance
  const userModel = await models.User.findByPk(user.id);
  // calculate and deduct gas for sell
  const mode = (user && user.speed_mode) || 'normal';
  const gasUsd = GAS_USD[mode] || GAS_USD.normal;
  const gasSol = gasUsd / solUsd;
  userModel.balance_sol = parseFloat(userModel.balance_sol) + profitSol + (pos.sol_spent * (percent/100)) - gasSol; // add back principal portion + profit and deduct gas
  await userModel.save();
  // update position
  pos.amount_tokens = pos.amount_tokens - sellTokens;
  if (pos.amount_tokens <= 0) {
    await pos.destroy();
  } else {
    await pos.save();
  }
  // record transaction
  try {
    await models.Transaction.create({
      user_id: user.id,
      type: 'sell',
      token_address: mint,
      token_symbol: pos.symbol,
      token_amount: sellTokens,
      price_usd: parseFloat(tokenPriceUsd),
      total_usd: proceedsUsd,
      sol_amount: profitSol,
      pnl_usd: profitUsd
    });
  } catch (err) {
    console.error('record sell transaction error', err);
  }
  await applySpeedDelay(user.speed_mode);
  return `✅ Sold ${percent}% of ${pos.symbol} at $${tokenPriceUsd} (${(profitUsd>=0?'+':'')}${profitUsd.toFixed(2)} USD)\n💵 Profit: ${profitSol.toFixed(4)} SOL`;
};
