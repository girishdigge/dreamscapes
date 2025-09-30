// services/mcp-gateway/config/openai.js
// Default config for OpenAI provider

module.exports = {
  apiKey: process.env.OPENAI_API_KEY || null,
  apiUrl:
    process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  defaults: {
    temperature: 0.7,
    maxTokens: 1500,
    n: 1,
    timeoutMs: 20000,
  },
};
