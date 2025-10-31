import { SPEEDS } from '../../config/constants.js';
export const applySpeedDelay = (mode = 'normal') => {
  const [min, max] = SPEEDS[mode] || SPEEDS.normal;
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((res) => setTimeout(res, delay));
};
