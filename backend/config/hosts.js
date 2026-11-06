import http from "http";
import https from "https";
import dns from "node:dns";

// Ensure IPv4 first on cloud hosts
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

// High-speed public DNS resolvers (Google, Cloudflare, OpenDNS)
// Bypasses Linux VPS local resolver bugs, rate-limits, and stale caches
const publicResolver = new dns.Resolver();
try {
  publicResolver.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4", "208.67.222.222"]);
} catch (e) {}

// Dynamic in-memory IP pools for each domain (auto-updated in real-time)
export const dynamicIpPools = new Map([
  ["casino.nice444.com", ["15.206.139.110", "13.202.182.49"]],
  ["nice444.com", ["15.206.139.110", "13.202.182.49"]],
  ["casino.startexch99.com", ["3.111.181.8", "13.205.38.140"]],
  ["startexch99.com", ["3.111.181.8", "13.205.38.140"]],
  ["cbtfexchange.com", []],
  ["casino.cbtfexchange.com", []],
  ["tv.ltve.live", []],
  ["player.ltve.live", []],
]);

const TRACKED_DOMAINS = [
  "casino.nice444.com",
  "nice444.com",
  "casino.startexch99.com",
  "startexch99.com",
  "cbtfexchange.com",
  "casino.cbtfexchange.com",
  "tv.ltve.live",
  "player.ltve.live",
];

/**
 * Dynamically discovers and auto-detects all active IPv4 addresses for a domain.
 * Queries: 1) Public Direct Resolver (Google/Cloudflare) -> 2) System IPv4 lookup.
 * Returns the fresh active IP list and updates dynamicIpPools automatically.
 */
export async function refreshHostIps(hostname) {
  try {
    const ips = await new Promise((resolve) => {
      publicResolver.resolve4(hostname, (err, addresses) => {
        if (!err && Array.isArray(addresses) && addresses.length > 0) {
          return resolve(addresses);
        }
        dns.lookup(hostname, { family: 4, all: true }, (err2, addresses2) => {
          if (!err2 && Array.isArray(addresses2) && addresses2.length > 0) {
            return resolve(addresses2.map((a) => a.address));
          }
          resolve(null);
        });
      });
    });

    if (ips && ips.length > 0) {
      dynamicIpPools.set(hostname, ips);
      return ips;
    }
  } catch (err) {}

  return dynamicIpPools.get(hostname) || [];
}

/**
 * Background Auto-Discovery Worker:
 * Continuously runs every 30 seconds to detect any IP changes made by Nice444 / AWS.
 * Even if provider changes their IP 10 times a day, this auto-detects it in real-time!
 */
let autoDiscoveryTimer = null;
export function startDnsAutoDiscovery() {
  if (autoDiscoveryTimer) return;
  const runAutoDiscovery = async () => {
    for (const domain of TRACKED_DOMAINS) {
      await refreshHostIps(domain);
    }
  };
  runAutoDiscovery().catch(() => {});
  autoDiscoveryTimer = setInterval(runAutoDiscovery, 30000);
}

// Start auto-discovery immediately
startDnsAutoDiscovery();

/**
 * Custom dynamic lookup function for http/https agents:
 * Never uses stale static IPs; dynamically delivers the latest auto-discovered IPs.
 */
export const customLookup = (hostname, options, callback) => {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const isAll = Boolean(options && options.all);

  const deliver = (ipList) => {
    if (!ipList || ipList.length === 0) {
      return callback(new Error(`No IP available for ${hostname}`));
    }
    if (isAll) {
      return callback(null, ipList.map((ip) => ({ address: ip, family: 4 })));
    }
    return callback(null, ipList[0], 4);
  };

  // 1. Try system DNS
  dns.lookup(hostname, { family: 4, all: isAll }, (err, res, family) => {
    if (!err && res) {
      if (isAll && Array.isArray(res) && res.length > 0) {
        dynamicIpPools.set(hostname, res.map((r) => r.address));
        return callback(null, res);
      }
      if (!isAll && res) {
        return callback(null, res, family || 4);
      }
    }

    // 2. Deliver from live dynamic auto-discovered pool
    const pool = dynamicIpPools.get(hostname);
    if (pool && pool.length > 0) {
      refreshHostIps(hostname).catch(() => {});
      return deliver(pool);
    }

    // 3. Fallback to direct public resolver
    refreshHostIps(hostname)
      .then((newIps) => {
        if (newIps && newIps.length > 0) {
          return deliver(newIps);
        }
        callback(err || new Error(`DNS resolution failed for ${hostname}`));
      })
      .catch(() => {
        callback(err || new Error(`DNS resolution failed for ${hostname}`));
      });
  });
};

export const httpsAgent = new https.Agent({ lookup: customLookup, keepAlive: true });
export const httpAgent = new http.Agent({ lookup: customLookup, keepAlive: true });

export const TARGET_BASE = "https://nice444.com";
export const STABLE_STREAM_IP = "49.36.142.88";
