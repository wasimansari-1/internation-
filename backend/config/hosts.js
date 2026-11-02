import http from "http";
import https from "https";
import dns from "node:dns";

// Ensure IPv4 first on cloud hosts
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

export const KNOWN_HOSTS = {
  "nice444.com": "13.201.109.114",
  "casino.nice444.com": "13.201.109.114",
  "tv.ltve.live": "108.132.161.244",
  "player.ltve.live": "54.154.159.245",
};

export const customLookup = (hostname, options, callback) => {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const isAll = Boolean(options && options.all);
  const deliver = (ip) => {
    if (isAll) {
      callback(null, [{ address: ip, family: 4 }]);
    } else {
      callback(null, ip, 4);
    }
  };

  const ip = KNOWN_HOSTS[hostname];
  if (ip) {
    return deliver(ip);
  }

  dns.lookup(hostname, options, (err, address, family) => {
    if (!err && address) {
      return callback(null, address, family);
    }
    // Fallback directly to Known IPs on cloud environments where DNS lookup fails
    if (hostname.includes("nice444.com")) {
      return deliver("13.201.109.114");
    }
    if (hostname.includes("ltve.live")) {
      return deliver("108.132.161.244");
    }
    callback(err || new Error(`DNS resolution failed for ${hostname}`));
  });
};

export const httpsAgent = new https.Agent({ lookup: customLookup, keepAlive: true });
export const httpAgent = new http.Agent({ lookup: customLookup, keepAlive: true });

export const TARGET_BASE = "https://nice444.com";
export const STABLE_STREAM_IP = "49.36.142.88";
