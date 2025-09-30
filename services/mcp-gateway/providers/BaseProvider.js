// providers/BaseProvider.js
// Base class for all AI providers

class BaseProvider {
  constructor(config) {
    this.config = config;
    this.name = this.constructor.name;
    this.isHealthy = true;
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      avgResponseTime: 0,
      lastHealthCheck: null,
    };
  }

  async generateDream(prompt, options = {}) {
    throw new Error('generateDream must be implemented by subclass');
  }

  async testConnection() {
    throw new Error('testConnection must be implemented by subclass');
  }

  async healthCheck() {
    try {
      await this.testConnection();
      this.isHealthy = true;
      this.metrics.lastHealthCheck = new Date();
      return true;
    } catch (error) {
      this.isHealthy = false;
      this.metrics.lastHealthCheck = new Date();
      throw error;
    }
  }

  updateMetrics(success, responseTime) {
    this.metrics.requests++;
    if (success) {
      this.metrics.successes++;
    } else {
      this.metrics.failures++;
    }

    // Update average response time
    const totalTime =
      this.metrics.avgResponseTime * (this.metrics.requests - 1) + responseTime;
    this.metrics.avgResponseTime = totalTime / this.metrics.requests;
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.requests > 0
          ? this.metrics.successes / this.metrics.requests
          : 0,
      isHealthy: this.isHealthy,
    };
  }
}

module.exports = BaseProvider;
