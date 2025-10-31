import axios from 'axios';
import { DEFAULTS } from '../../config/constants.js';
import { redisGet, redisSet } from '../../cache/redisClient.js';

const BASE = DEFAULTS.DEXSCREENER_BASE_URL;

export const fetchTokenData = async (mint) => {
  const key = `dex:${mint}`;
  const cached = await redisGet(key);
  if (cached) return JSON.parse(cached);
  const url = `${BASE}/${mint}`;
  const res = await axios.get(url);
  if (!res || !res.data) return null;
  await redisSet(key, JSON.stringify(res.data), 60); // cache 60s
  return res.data;
};
