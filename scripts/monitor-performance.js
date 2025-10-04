#!/usr/bin/env node

/**
 * Performance monitoring script for Dreamscapes services
 * Monitors resource usage, startup times, and service health
 */

const { execSync } = require('child_process');
const fs = require('fs');

const SERVICES = [
  { name: 'frontend', port: 3000 },
  { name: 'express', port: 8000 },
  { name: 'mcp-gateway', port: 8080 },
  { name: 'llama-stylist', port: 8002 },
  { name: 'render-worker', port: 8001 },
];

class PerformanceMonitor {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      services: {},
      summary: {},
    };
  }

  async monitorServices() {
    console.log('🔍 Monitoring Dreamscapes services performance...\n');

    for (const service of SERVICES) {
      console.log(`📊 Monitoring ${service.name}...`);

      try {
        const stats = await this.getServiceStats(service);
        this.results.services[service.name] = stats;

        console.log(`  ✅ ${service.name}: ${stats.status}`);
        console.log(`     Memory: ${stats.memory}MB, CPU: ${stats.cpu}%`);
        console.log(`     Response time: ${stats.responseTime}ms\n`);
      } catch (error) {
        console.log(`  ❌ ${service.name}: Error - ${error.message}\n`);
        this.results.services[service.name] = {
          status: 'error',
          error: error.message,
        };
      }
    }

    this.generateSummary();
    this.saveResults();
  }

  async getServiceStats(service) {
    const containerName = `dreamscapes-${service.name}-1`;

    // Get container stats
    let dockerStats;
    try {
      const statsOutput = execSync(
        `docker stats ${containerName} --no-stream --format "table {{.MemUsage}}\t{{.CPUPerc}}"`,
        { encoding: 'utf8', timeout: 5000 }
      );

      const lines = statsOutput.trim().split('\n');
      if (lines.length > 1) {
        const [memUsage, cpuPerc] = lines[1].split('\t');
        dockerStats = {
          memory: parseFloat(memUsage.split('/')[0].replace('MiB', '').trim()),
          cpu: parseFloat(cpuPerc.replace('%', '')),
        };
      }
    } catch (error) {
      dockerStats = { memory: 0, cpu: 0 };
    }

    // Test service response time
    const startTime = Date.now();
    let responseTime = 0;
    let status = 'unknown';

    try {
      const response = await this.testServiceHealth(service.port);
      responseTime = Date.now() - startTime;
      status = response ? 'healthy' : 'unhealthy';
    } catch (error) {
      responseTime = Date.now() - startTime;
      status = 'unreachable';
    }

    return {
      status,
      memory: dockerStats.memory || 0,
      cpu: dockerStats.cpu || 0,
      responseTime,
    };
  }

  async testServiceHealth(port) {
    return new Promise((resolve, reject) => {
      const http = require('http');

      const req = http.get(
        `http://localhost:${port}/health`,
        { timeout: 3000 },
        (res) => {
          resolve(res.statusCode === 200);
        }
      );

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  generateSummary() {
    const services = Object.values(this.results.services);
    const healthyServices = services.filter(
      (s) => s.status === 'healthy'
    ).length;
    const totalMemory = services.reduce((sum, s) => sum + (s.memory || 0), 0);
    const avgCpu =
      services.reduce((sum, s) => sum + (s.cpu || 0), 0) / services.length;
    const avgResponseTime =
      services
        .filter((s) => s.responseTime)
        .reduce((sum, s) => sum + s.responseTime, 0) /
      services.filter((s) => s.responseTime).length;

    this.results.summary = {
      healthyServices: `${healthyServices}/${services.length}`,
      totalMemoryUsage: `${totalMemory.toFixed(1)}MB`,
      averageCpuUsage: `${avgCpu.toFixed(1)}%`,
      averageResponseTime: `${avgResponseTime.toFixed(0)}ms`,
    };

    console.log('📈 Performance Summary:');
    console.log(`   Healthy services: ${this.results.summary.healthyServices}`);
    console.log(
      `   Total memory usage: ${this.results.summary.totalMemoryUsage}`
    );
    console.log(
      `   Average CPU usage: ${this.results.summary.averageCpuUsage}`
    );
    console.log(
      `   Average response time: ${this.results.summary.averageResponseTime}`
    );
  }

  saveResults() {
    const filename = `performance-report-${
      new Date().toISOString().split('T')[0]
    }.json`;
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Results saved to ${filename}`);
  }
}

// Run monitoring
const monitor = new PerformanceMonitor();
monitor.monitorServices().catch(console.error);
