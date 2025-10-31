export const SPEEDS = {
  turbo: [0, 0],
  fast: [200, 300],
  normal: [500, 700],
  slow: [1000, 2000]
};

export const DEFAULTS = {
  DEFAULT_SOL: parseFloat(process.env.DEFAULT_SOL || '1.0'),
  DEXSCREENER_BASE_URL: process.env.DEXSCREENER_BASE_URL || 'https://api.dexscreener.com/latest/dex/tokens'
};
