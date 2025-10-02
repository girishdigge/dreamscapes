class CerebrasService {
  constructor(config = {}) {
    if (!config.apiKey) {
      throw new Error('Cerebras API key is required');
    }
    this.config = config;
  }
  
  getConfig() {
    return this.config;
  }
  
  async generateDream(prompt, options = {}) {
    return JSON.stringify({
      title: 'Mock Dream',
      description: 'Test dream',
      scenes: [],
      style: 'ethereal'
    });
  }
}

module.exports = CerebrasService;
