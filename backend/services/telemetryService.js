import os from "os";
import axios from "axios";

class TelemetryService {
  constructor() {
    this.startTime = Date.now();
    this.requestLog = [];
    this.maxLogSize = 60;

    this.counters = {
      totalRequests: 0,
      byCategory: {
        casinoOdds: 0,
        streamWatch: 0,
        streamProxy: 0,
        results: 0,
        sports: 0,
        admin: 0,
        other: 0,
      },
      byStatus: {
        "2xx": 0,
        "4xx": 0,
        "5xx": 0,
      },
    };

    this.authStats = {
      nice444: {
        account: "demo52",
        domain: "https://nice444.com",
        casinoDomain: "https://casino.nice444.com",
        attempts: 0,
        successes: 0,
        failures: 0,
        lastAttempt: null,
        lastSuccess: null,
        lastError: null,
        status: "ACTIVE",
      },
      startexch99: {
        account: "smdemo",
        domain: "https://startexch99.com",
        casinoDomain: "https://casino.startexch99.com",
        attempts: 0,
        successes: 0,
        failures: 0,
        lastAttempt: null,
        lastSuccess: null,
        lastError: null,
        status: "ACTIVE",
      },
    };

    this.providerHealth = {
      nice444: {
        name: "Nice444",
        domain: "casino.nice444.com",
        status: "HEALTHY",
        isBlocked: false,
        latencyMs: 145,
        totalCalls: 0,
        successCount: 0,
        blockCount: 0,
        lastTested: null,
        lastError: null,
      },
      startexch99: {
        name: "Startexch99",
        domain: "casino.startexch99.com",
        status: "HEALTHY",
        isBlocked: false,
        latencyMs: 120,
        totalCalls: 0,
        successCount: 0,
        blockCount: 0,
        lastTested: null,
        lastError: null,
      },
    };

    this.routingConfig = {
      casinoProvider: "AUTO", // 'AUTO' | 'NICE444' | 'STARTEXCH99'
      streamProvider: "AUTO", // 'AUTO' | 'NICE444' | 'STARTEXCH99'
      sportsProvider: "AUTO", // 'AUTO' | 'NICE444' | 'STARTEXCH99'
      lastChanged: Date.now(),
      changedBy: "system",
    };

    this.requestTimestamps = [];
  }

  recordRequest({ method, path, category, provider = "LOCAL", status = 200, latencyMs = 0 }) {
    this.counters.totalRequests++;

    const catKey = this.counters.byCategory[category] !== undefined ? category : "other";
    this.counters.byCategory[catKey]++;

    if (status >= 200 && status < 300) this.counters.byStatus["2xx"]++;
    else if (status >= 400 && status < 500) this.counters.byStatus["4xx"]++;
    else if (status >= 500) this.counters.byStatus["5xx"]++;

    const now = Date.now();
    this.requestTimestamps.push(now);

    // Keep request timestamps within 60s window
    const cutoff = now - 60000;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < cutoff) {
      this.requestTimestamps.shift();
    }

    if (provider === "Nice444" || provider === "Startexch99") {
      const pKey = provider.toLowerCase();
      if (this.providerHealth[pKey]) {
        this.providerHealth[pKey].totalCalls++;
        if (status >= 200 && status < 400) {
          this.providerHealth[pKey].successCount++;
        } else if (status === 422 || status === 403) {
          this.providerHealth[pKey].blockCount++;
        }
      }
    }

    this.requestLog.unshift({
      id: `${now}-${Math.random().toString(36).substr(2, 4)}`,
      time: new Date().toLocaleTimeString("en-IN", { hour12: false }),
      timestamp: now,
      method: method || "GET",
      path: path || "/",
      category,
      provider,
      status,
      latencyMs: Math.round(latencyMs),
    });

    if (this.requestLog.length > this.maxLogSize) {
      this.requestLog.pop();
    }
  }

  recordAuthAttempt(providerKey, success, errorMsg = null) {
    const target = this.authStats[providerKey];
    if (!target) return;

    target.attempts++;
    target.lastAttempt = new Date().toISOString();

    if (success) {
      target.successes++;
      target.lastSuccess = new Date().toISOString();
      target.status = "ACTIVE";
      target.lastError = null;
    } else {
      target.failures++;
      target.lastError = errorMsg || "Authentication failed";
      target.status = target.failures > 3 ? "WARNING" : "ACTIVE";
    }
  }

  setRoutingConfig(newConfig, changedBy = "admin") {
    if (newConfig.casinoProvider) this.routingConfig.casinoProvider = newConfig.casinoProvider;
    if (newConfig.streamProvider) this.routingConfig.streamProvider = newConfig.streamProvider;
    if (newConfig.sportsProvider) this.routingConfig.sportsProvider = newConfig.sportsProvider;
    this.routingConfig.lastChanged = Date.now();
    this.routingConfig.changedBy = changedBy;
    return this.routingConfig;
  }

  async probeProviders(getDemoToken, getStartexchToken) {
    const results = {};

    // 1. Probe Nice444
    try {
      const t0 = Date.now();
      const token = await getDemoToken();
      const res = await axios.post(
        "https://casino.nice444.com/casinoapp/exchange/users/streaming/casinoGameWatchLink",
        { streamId: "99.0010", timestamp: Date.now() },
        {
          headers: {
            Origin: "https://casino.nice444.com",
            Referer: "https://casino.nice444.com/",
            Authorization: `Bearer ${token}`,
            "X-Forwarded-For": "103.21.124.5",
          },
          timeout: 4000,
        },
      );
      const lat = Date.now() - t0;
      this.providerHealth.nice444.latencyMs = lat;
      this.providerHealth.nice444.status = "HEALTHY";
      this.providerHealth.nice444.isBlocked = false;
      this.providerHealth.nice444.lastTested = new Date().toISOString();
      this.providerHealth.nice444.lastError = null;
      results.nice444 = { ok: true, latency: lat, status: res.status };
    } catch (e) {
      const is422 = e.response?.status === 422 || e.response?.status === 403;
      this.providerHealth.nice444.status = is422 ? "BLOCKED" : "DEGRADED";
      this.providerHealth.nice444.isBlocked = is422;
      this.providerHealth.nice444.lastTested = new Date().toISOString();
      this.providerHealth.nice444.lastError = e.response?.data?.meta?.message || e.message;
      results.nice444 = { ok: false, error: this.providerHealth.nice444.lastError, status: e.response?.status };
    }

    // 2. Probe Startexch99
    try {
      const t0 = Date.now();
      const token = await getStartexchToken();
      const res = await axios.post(
        "https://casino.startexch99.com/casinoapp/exchange/users/streaming/casinoGameWatchLink",
        { streamId: "99.0010", timestamp: Date.now() },
        {
          headers: {
            Origin: "https://casino.startexch99.com",
            Referer: "https://casino.startexch99.com/",
            Authorization: `Bearer ${token}`,
            "X-Forwarded-For": "103.21.124.5",
          },
          timeout: 4000,
        },
      );
      const lat = Date.now() - t0;
      this.providerHealth.startexch99.latencyMs = lat;
      this.providerHealth.startexch99.status = "HEALTHY";
      this.providerHealth.startexch99.isBlocked = false;
      this.providerHealth.startexch99.lastTested = new Date().toISOString();
      this.providerHealth.startexch99.lastError = null;
      results.startexch99 = { ok: true, latency: lat, status: res.status };
    } catch (e) {
      const is422 = e.response?.status === 422 || e.response?.status === 403;
      this.providerHealth.startexch99.status = is422 ? "BLOCKED" : "DEGRADED";
      this.providerHealth.startexch99.isBlocked = is422;
      this.providerHealth.startexch99.lastTested = new Date().toISOString();
      this.providerHealth.startexch99.lastError = e.response?.data?.meta?.message || e.message;
      results.startexch99 = { ok: false, error: this.providerHealth.startexch99.lastError, status: e.response?.status };
    }

    return results;
  }

  getMetrics() {
    const now = Date.now();
    const cutoff = now - 60000;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < cutoff) {
      this.requestTimestamps.shift();
    }
    const reqPerMinute = this.requestTimestamps.length;

    let loadRisk = {
      level: "LOW",
      label: "SAFE",
      color: "#10b981",
      message: "Normal traffic. Origin block risk is minimal.",
      percentage: Math.min(100, Math.round((reqPerMinute / 150) * 100)),
    };

    if (reqPerMinute >= 120) {
      loadRisk = {
        level: "CRITICAL",
        label: "HIGH RISK",
        color: "#ef4444",
        message: "High request rate! Origin may be rate-limited or blocked. Switch routing to 50/50 balance.",
        percentage: 100,
      };
    } else if (reqPerMinute >= 60) {
      loadRisk = {
        level: "MODERATE",
        label: "MODERATE",
        color: "#f59e0b",
        message: "Active load. Balancing requests across both providers.",
        percentage: Math.min(100, Math.round((reqPerMinute / 150) * 100)),
      };
    }

    const mem = process.memoryUsage();
    const system = {
      uptimeSeconds: Math.floor((now - this.startTime) / 1000),
      memoryRssMb: Math.round(mem.rss / (1024 * 1024)),
      memoryHeapMb: Math.round(mem.heapUsed / (1024 * 1024)),
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      platform: os.platform(),
    };

    return {
      success: true,
      timestamp: now,
      system,
      reqPerMinute,
      loadRisk,
      counters: this.counters,
      authStats: this.authStats,
      providerHealth: this.providerHealth,
      routingConfig: this.routingConfig,
      recentRequests: this.requestLog.slice(0, 30),
    };
  }

  resetCounters() {
    this.counters.totalRequests = 0;
    this.counters.byCategory = {
      casinoOdds: 0,
      streamWatch: 0,
      streamProxy: 0,
      results: 0,
      sports: 0,
      admin: 0,
      other: 0,
    };
    this.counters.byStatus = { "2xx": 0, "4xx": 0, "5xx": 0 };
    this.requestLog = [];
    this.requestTimestamps = [];
    return true;
  }
}

export const telemetry = new TelemetryService();
