// services/mcp-gateway/utils/retry.js
// Simple retry helper with exponential backoff

async function retry(fn, opts = {}) {
  const attempts = opts.attempts || 3;
  const baseDelay = opts.baseDelay || 300; // ms
  const factor = opts.factor || 2;

  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const delay = baseDelay * Math.pow(factor, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

module.exports = retry;
