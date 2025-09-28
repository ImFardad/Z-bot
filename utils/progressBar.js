/**
 * Generates a text-based progress bar string.
 * @param {number} current The current value.
 * @param {number} max The maximum value.
 * @param {number} length The total length of the bar in characters.
 * @returns {string} The formatted progress bar string.
 */
function generateProgressBar(current, max, length = 10) {
  if (max === 0) return '[░░░░░░░░░░] 0 / 0'; // Handle division by zero

  const percentage = Math.max(0, Math.min(1, current / max));
  const filledBlocks = Math.round(percentage * length);
  const emptyBlocks = length - filledBlocks;

  const filledStr = '█'.repeat(filledBlocks);
  const emptyStr = '░'.repeat(emptyBlocks);

  return `[${filledStr}${emptyStr}] ${current} / ${max}`;
}

module.exports = { generateProgressBar };
