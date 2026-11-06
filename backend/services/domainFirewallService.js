import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { httpsAgent } from "../config/hosts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.resolve(__dirname, "../config/blocked_domains.json");

const ADMIN_PASSWORD = "Wasim@123#";

class DomainFirewallService {
  constructor() {
    this.blockedDomains = new Set();
    this.clientDomains = new Map(); // domain -> { domain, hits, blockedHits, firstSeen, lastSeen, lastIp, lastEndpoint, recentEndpoints: [] }
    this.liveLogs = []; // last 100 requests
    this.maxLiveLogs = 100;
    this.emergencyKillSwitch = false; // if true, blocks all external traffic

    this.loadBlockedDomains();

    // Seed common known origins if empty
    if (this.clientDomains.size === 0) {
      this.clientDomains.set("direct-api-client", {
        domain: "direct-api-client",
        hits: 1,
        blockedHits: 0,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        lastIp: "127.0.0.1",
        lastEndpoint: "/api/sports/events",
        recentEndpoints: ["/api/sports/events"],
      });
    }
  }

  loadBlockedDomains() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, "utf8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          this.blockedDomains = new Set(list.map((d) => String(d).toLowerCase().trim()).filter(Boolean));
        }
      }
    } catch (err) {
      console.warn("[Firewall] Failed to load blocked domains file:", err.message);
      this.blockedDomains = new Set();
    }
  }

  saveBlockedDomains() {
    try {
      const arr = Array.from(this.blockedDomains);
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(arr, null, 2), "utf8");
    } catch (err) {
      console.error("[Firewall] Failed to save blocked domains file:", err.message);
    }
  }

  cleanDomain(input) {
    if (!input) return "direct-api-client";
    let str = String(input).trim().toLowerCase();
    try {
      if (str.startsWith("http://") || str.startsWith("https://")) {
        const parsed = new URL(str);
        return parsed.hostname || parsed.host || str;
      }
      // Strip path and port if present
      str = str.split("/")[0].split(":")[0];
      return str || "direct-api-client";
    } catch (e) {
      return str.replace(/[^a-zA-Z0-9.-]/g, "") || "unknown-domain";
    }
  }

  extractDomainFromReq(req) {
    const origin = req.headers["origin"];
    const referer = req.headers["referer"];
    if (origin) return this.cleanDomain(origin);
    if (referer) return this.cleanDomain(referer);
    const forwardedHost = req.headers["x-forwarded-host"];
    if (forwardedHost) return this.cleanDomain(forwardedHost);
    return "direct-api-client";
  }

  isDomainBlocked(domain) {
    if (this.emergencyKillSwitch) return true;
    const clean = this.cleanDomain(domain);
    if (this.blockedDomains.has(clean)) return true;
    // Check wildcard match (e.g. *.xyz.com)
    for (const blocked of this.blockedDomains) {
      if (clean === blocked || clean.endsWith("." + blocked)) {
        return true;
      }
    }
    return false;
  }

  recordRequest({ domain, path, method, ip, status, latencyMs, isBlocked }) {
    const clean = this.cleanDomain(domain);
    const now = new Date().toISOString();

    let entry = this.clientDomains.get(clean);
    if (!entry) {
      entry = {
        domain: clean,
        hits: 0,
        blockedHits: 0,
        firstSeen: now,
        lastSeen: now,
        lastIp: ip,
        lastEndpoint: path,
        recentEndpoints: [],
      };
      this.clientDomains.set(clean, entry);
    }

    if (isBlocked) {
      entry.blockedHits = (entry.blockedHits || 0) + 1;
    } else {
      entry.hits = (entry.hits || 0) + 1;
    }
    entry.lastSeen = now;
    entry.lastIp = ip;
    entry.lastEndpoint = path;

    if (!entry.recentEndpoints.includes(path)) {
      entry.recentEndpoints.unshift(path);
      if (entry.recentEndpoints.length > 5) entry.recentEndpoints.pop();
    }

    // Append to live logs
    this.liveLogs.unshift({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      timeFormatted: new Date().toLocaleTimeString(),
      method: method || "GET",
      path: path || "/",
      domain: clean,
      ip: ip || "0.0.0.0",
      status: status || 200,
      latencyMs: latencyMs || 0,
      blocked: Boolean(isBlocked),
    });

    if (this.liveLogs.length > this.maxLiveLogs) {
      this.liveLogs.pop();
    }
  }

  verifyPassword(password) {
    return String(password).trim() === ADMIN_PASSWORD;
  }

  blockDomain(domain, password) {
    if (!this.verifyPassword(password)) {
      throw new Error("Invalid Administrator Password. Access Denied.");
    }
    const clean = this.cleanDomain(domain);
    if (!clean || clean === "direct-api-client") {
      throw new Error("Cannot block core direct API client.");
    }
    this.blockedDomains.add(clean);
    this.saveBlockedDomains();

    let entry = this.clientDomains.get(clean);
    if (entry) {
      entry.lastBlockedAt = new Date().toISOString();
    }
    return { success: true, message: `Domain ${clean} successfully BLOCKED.`, domain: clean };
  }

  unblockDomain(domain, password) {
    if (!this.verifyPassword(password)) {
      throw new Error("Invalid Administrator Password. Access Denied.");
    }
    const clean = this.cleanDomain(domain);
    this.blockedDomains.delete(clean);
    this.saveBlockedDomains();

    let entry = this.clientDomains.get(clean);
    if (entry) {
      delete entry.lastBlockedAt;
    }
    return { success: true, message: `Domain ${clean} successfully UNBLOCKED.`, domain: clean };
  }

  toggleEmergencyKillSwitch(password, state) {
    if (!this.verifyPassword(password)) {
      throw new Error("Invalid Administrator Password. Access Denied.");
    }
    this.emergencyKillSwitch = Boolean(state);
    return {
      success: true,
      message: `Emergency Kill-Switch is now ${this.emergencyKillSwitch ? "ACTIVE (All traffic blocked)" : "OFF (Normal mode)"}`,
      killSwitch: this.emergencyKillSwitch,
    };
  }

  // Probe Upstream Sources (Origin side health and block check)
  async probeUpstreams() {
    const upstreams = [
      {
        id: "startexch",
        name: "Startexch99",
        origin: "https://startexch99.com",
        role: "Sports Odds, Match Odds, In-Play Rates & Streaming Token",
        testUrl: "https://startexch99.com/api/exchange/market/matchodds/allEventsList",
        category: "SPORTS_EXCHANGE",
      },
      {
        id: "nice444",
        name: "Nice444",
        origin: "https://casino.nice444.com",
        role: "Live Casino Feeds, Teen Patti, Roulette, Baccarat & HD Stream",
        testUrl: "https://casino.nice444.com/api/v2/tables/all",
        category: "CASINO_TABLES",
      },
      {
        id: "universe_score",
        name: "Universe Score Firebase",
        origin: "https://firestore.googleapis.com",
        role: "Multi-Sport Real-time Live Scorecards (Cricket, Tennis, Soccer)",
        testUrl: "https://firestore.googleapis.com/v1/projects/universe-score/databases/(default)/documents:runQuery",
        category: "SCORECARDS",
      },
      {
        id: "ltve_stream",
        name: "LTVE Video CDN",
        origin: "https://player.ltve.live",
        role: "High-Bitrate Low-Latency Direct HLS Broadcast Streams",
        testUrl: "https://player.ltve.live",
        category: "LIVE_STREAM",
      },
      {
        id: "spx_static",
        name: "SPX Media & Kits",
        origin: "https://spxstatic.com",
        role: "Team Kits, Match Crests, Player Avatars & SVGs",
        testUrl: "https://spxstatic.com",
        category: "MEDIA_ASSETS",
      },
    ];

    const results = await Promise.all(
      upstreams.map(async (u) => {
        const start = Date.now();
        try {
          let res;
          if (u.id === "universe_score") {
            res = await axios.post(
              u.testUrl,
              { structuredQuery: { from: [{ collectionId: "cricketScore" }], limit: 1 } },
              { timeout: 3500 }
            );
          } else {
            res = await axios.get(u.testUrl, {
              httpsAgent,
              timeout: 3500,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              },
            });
          }
          const latency = Date.now() - start;
          const isBlocked = res.status === 403 || res.status === 429 || res.status === 401;
          return {
            ...u,
            status: isBlocked ? "BLOCKED_BY_ORIGIN" : "ACTIVE",
            statusCode: res.status,
            latencyMs: latency,
            lastChecked: new Date().toISOString(),
            message: isBlocked ? "Blocked by origin WAF/Firewall" : "Connected & responding healthy",
          };
        } catch (err) {
          const latency = Date.now() - start;
          const status = err.response?.status;
          const isBlocked = status === 403 || status === 401 || status === 429;
          return {
            ...u,
            status: isBlocked ? "BLOCKED_BY_ORIGIN" : "OFFLINE",
            statusCode: status || 0,
            latencyMs: latency,
            lastChecked: new Date().toISOString(),
            message: isBlocked ? `Blocked by upstream origin (HTTP ${status})` : err.message,
          };
        }
      })
    );

    return results;
  }

  getDashboardData() {
    const clientList = Array.from(this.clientDomains.values()).map((entry) => ({
      domain: entry.domain,
      hits: entry.hits || 0,
      blockedHits: entry.blockedHits || 0,
      totalAttempts: (entry.hits || 0) + (entry.blockedHits || 0),
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      lastIp: entry.lastIp || "0.0.0.0",
      lastEndpoint: entry.lastEndpoint || "/",
      recentEndpoints: entry.recentEndpoints || [],
      isBlocked: this.isDomainBlocked(entry.domain),
      lastBlockedAt: entry.lastBlockedAt || null,
    }));

    // Ensure all blocked domains are also listed even if no hits yet
    for (const b of this.blockedDomains) {
      if (!clientList.find((c) => c.domain === b)) {
        clientList.unshift({
          domain: b,
          hits: 0,
          blockedHits: 0,
          totalAttempts: 0,
          firstSeen: new Date().toISOString(),
          lastSeen: "Never",
          lastIp: "N/A",
          lastEndpoint: "None",
          recentEndpoints: [],
          isBlocked: true,
          lastBlockedAt: new Date().toISOString(),
        });
      }
    }

    // Sort by active hits descending
    clientList.sort((a, b) => b.totalAttempts - a.totalAttempts);

    const totalInboundRequests = clientList.reduce((acc, c) => acc + c.hits, 0);
    const totalBlockedRequests = clientList.reduce((acc, c) => acc + c.blockedHits, 0);

    return {
      success: true,
      timestamp: Date.now(),
      timeIso: new Date().toISOString(),
      summary: {
        totalClientDomains: clientList.length,
        activeDomains: clientList.filter((c) => !c.isBlocked).length,
        blockedDomainsCount: this.blockedDomains.size,
        totalInboundRequests,
        totalBlockedRequests,
        emergencyKillSwitch: this.emergencyKillSwitch,
      },
      blockedList: Array.from(this.blockedDomains),
      clientDomains: clientList,
      recentLogs: this.liveLogs.slice(0, 50),
    };
  }
}

export const domainFirewall = new DomainFirewallService();
