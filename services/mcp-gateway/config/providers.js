// config/providers.js
// Enhanced provider configuration

module.exports = {
  cerebras: {
    enabled: process.env.CEREBRAS_ENABLED !== 'false',
    priority: parseInt(process.env.CEREBRAS_PRIORITY) || 1,
    sdk: {
      apiKey: process.env.CEREBRAS_API_KEY || null,
      model: process.env.CEREBRAS_MODEL || 'llama-4-maverick-17b-128e-instruct',
      streaming: process.env.CEREBRAS_STREAMING === 'true',
      maxTokens: parseInt(process.env.CEREBRAS_MAX_TOKENS) || 32768,
      temperature: parseFloat(process.env.CEREBRAS_TEMPERATURE) || 0.6,
      topP: parseFloat(process.env.CEREBRAS_TOP_P) || 0.9,
    },
    limits: {
      requestsPerMinute: parseInt(process.env.CEREBRAS_RPM) || 60,
      tokensPerMinute: parseInt(process.env.CEREBRAS_TPM) || 100000,
      maxConcurrent: parseInt(process.env.CEREBRAS_MAX_CONCURRENT) || 5,
    },
    fallback: {
      enabled: process.env.CEREBRAS_FALLBACK_ENABLED !== 'false',
      retryAttempts: parseInt(process.env.CEREBRAS_RETRY_ATTEMPTS) || 3,
      backoffMultiplier:
        parseFloat(process.env.CEREBRAS_BACKOFF_MULTIPLIER) || 2,
    },
  },

  openai: {
    enabled: process.env.OPENAI_ENABLED !== 'false',
    priority: parseInt(process.env.OPENAI_PRIORITY) || 2,
    sdk: {
      apiKey: process.env.OPENAI_API_KEY || null,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      streaming: process.env.OPENAI_STREAMING === 'true',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4096,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
    },
    limits: {
      requestsPerMinute: parseInt(process.env.OPENAI_RPM) || 50,
      tokensPerMinute: parseInt(process.env.OPENAI_TPM) || 80000,
      maxConcurrent: parseInt(process.env.OPENAI_MAX_CONCURRENT) || 3,
    },
    fallback: {
      enabled: process.env.OPENAI_FALLBACK_ENABLED !== 'false',
      retryAttempts: parseInt(process.env.OPENAI_RETRY_ATTEMPTS) || 3,
      backoffMultiplier: parseFloat(process.env.OPENAI_BACKOFF_MULTIPLIER) || 2,
    },
  },

  llama: {
    enabled: process.env.LLAMA_ENABLED === 'true',
    priority: parseInt(process.env.LLAMA_PRIORITY) || 3,
    sdk: {
      baseUrl: process.env.LLAMA_BASE_URL || 'http://llama-stylist:8000',
      model: process.env.LLAMA_MODEL || 'llama-2-7b-chat',
      streaming: process.env.LLAMA_STREAMING === 'true',
      maxTokens: parseInt(process.env.LLAMA_MAX_TOKENS) || 2048,
      temperature: parseFloat(process.env.LLAMA_TEMPERATURE) || 0.7,
    },
    limits: {
      requestsPerMinute: parseInt(process.env.LLAMA_RPM) || 30,
      tokensPerMinute: parseInt(process.env.LLAMA_TPM) || 50000,
      maxConcurrent: parseInt(process.env.LLAMA_MAX_CONCURRENT) || 2,
    },
    fallback: {
      enabled: process.env.LLAMA_FALLBACK_ENABLED !== 'false',
      retryAttempts: parseInt(process.env.LLAMA_RETRY_ATTEMPTS) || 2,
      backoffMultiplier:
        parseFloat(process.env.LLAMA_BACKOFF_MULTIPLIER) || 1.5,
    },
  },
};
