export const fmtUSD = (n) => {
  if (n === null || n === undefined) return 'N/A';
  const num = Number(n);
  if (!Number.isFinite(num)) return 'N/A';

  // choose decimals based on magnitude for better readability
  const abs = Math.abs(num);
  let minimumFractionDigits = 2;
  let maximumFractionDigits = 2;
  if (abs === 0) {
    minimumFractionDigits = maximumFractionDigits = 2;
  } else if (abs < 0.01) {
    minimumFractionDigits = maximumFractionDigits = 8;
  } else if (abs < 1) {
    minimumFractionDigits = maximumFractionDigits = 4;
  } else if (abs < 1000) {
    minimumFractionDigits = maximumFractionDigits = 2;
  } else {
    // large numbers: no decimals, use grouping
    minimumFractionDigits = maximumFractionDigits = 0;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: true
  }).format(num);
};
