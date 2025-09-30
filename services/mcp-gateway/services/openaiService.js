// services/mcp-gateway/services/openaiService.js
// Wrapper around OpenAI's Chat Completions API with config-driven defaults

const axios = require('axios');
const config = require('../config/openai');

async function callOpenAI(prompt, options = {}) {
  try {
    const response = await axios.post(
      config.apiUrl,
      {
        model: options.model || config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? config.defaults.temperature,
        max_tokens: options.maxTokens ?? config.defaults.maxTokens,
        n: options.n ?? config.defaults.n,
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: options.timeoutMs ?? config.defaults.timeoutMs,
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
}

async function testConnection() {
  if (!config.apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await axios.post(
      config.apiUrl,
      {
        model: config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );
    return true;
  } catch (error) {
    throw new Error(`OpenAI connection test failed: ${error.message}`);
  }
}

async function generateDream(prompt, options = {}) {
  return await callOpenAI(prompt, options);
}

async function patchDream(prompt, baseJson, options = {}) {
  return await callOpenAI(prompt, options);
}

async function enrichStyle(prompt, baseJson, options = {}) {
  return await callOpenAI(prompt, options);
}

module.exports = {
  callOpenAI,
  testConnection,
  generateDream,
  patchDream,
  enrichStyle,
};
