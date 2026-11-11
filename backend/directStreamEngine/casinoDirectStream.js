import axios from "axios";
import { getStartexchToken, getDemoToken, getAsstarplayToken } from "../services/authService.js";
import { nativeHttpsAgent } from "../services/streamService.js";

// Game ID mapping: Maps common exchange IDs / names to Official Universe Provider Stream IDs
export const CASINO_GAME_MAP = {
  // Teen Patti 20-20
  "3030": "99.0010",
  "teen20": "99.0010",
  "teen-20": "99.0010",
  "99.0010": "99.0010",

  // One Day Teen Patti
  "3031": "99.0013",
  "teen": "99.0013",
  "teen-1day": "99.0013",
  "99.0013": "99.0013",

  // Dragon Tiger
  "3035": "99.0018",
  "dt20": "99.0018",
  "dragon-tiger": "99.0018",
  "99.0018": "99.0018",

  // Dragon Tiger Lion (DTL)
  "3047": "99.0041",
  "dtl20": "99.0041",
  "dtl": "99.0041",
  "99.0041": "99.0041",

  // Lucky 7 EU
  "3032": "99.0030",
  "lucky7": "99.0030",
  "lucky7eu": "99.0030",
  "99.0030": "99.0030",

  // Lucky 7 B
  "3059": "99.0031",
  "lucky7b": "99.0031",
  "99.0031": "99.0031",

  // Andar Bahar
  "3055": "99.0025",
  "andarbahar": "99.0025",
  "andar-bahar": "99.0025",
  "99.0025": "99.0025",

  // 32 Cards
  "3034": "99.0022",
  "card32": "99.0022",
  "card32eu": "99.0022",
  "99.0022": "99.0022",

  // Baccarat
  "3058": "99.0001",
  "3044": "99.0001",
  "baccarat": "99.0001",
  "99.0001": "99.0001",

  // Poker
  "3051": "99.0027",
  "poker": "99.0027",
  "99.0027": "99.0027",

  // Worli Matka
  "3040": "99.0033",
  "worli": "99.0033",
  "worli2": "99.0033",
  "99.0033": "99.0033",

  // Amar Akbar Anthony (AAA)
  "aaa": "99.0029",
  "99.0029": "99.0029"
};

// In-memory cache for resolved stream URLs (TTL: 3 minutes)
const streamUrlCache = new Map();

/**
 * Resolve input game identifier to provider stream ID
 */
export function resolveProviderStreamId(input) {
  const key = String(input || "").trim().toLowerCase();
  return CASINO_GAME_MAP[key] || input;
}

/**
 * Fetch direct studio WebRTC stream watch link from official upstream providers
 * Startexch99 is Primary, Nice444 is Failover
 */
export async function getDirectCasinoStreamUrl(rawGameId, forceRefresh = false, clientIp = "") {
  const streamId = resolveProviderStreamId(rawGameId);
  const forwardedIp = clientIp || "103.21.124.5";
  const cacheKey = `casino_${streamId}_${forwardedIp}`;

  // Check cache
  if (!forceRefresh && streamUrlCache.has(cacheKey)) {
    const cached = streamUrlCache.get(cacheKey);
    if (Date.now() < cached.expiresAt && cached.url) {
      return {
        success: true,
        url: cached.url,
        streamId,
        provider: cached.provider,
        cached: true
      };
    }
  }

  const providers = [
    {
      name: "Asstarplay",
      domain: "https://casino.asstarplay.com",
      getToken: (force) => getAsstarplayToken(force)
    },
    {
      name: "Startexch99",
      domain: "https://casino.startexch99.com",
      getToken: (force) => getStartexchToken(force)
    },
    {
      name: "Nice444",
      domain: "https://casino.nice444.com",
      getToken: (force) => getDemoToken(force)
    }
  ];

  const candidateIps = forwardedIp === "103.21.124.5" ? [forwardedIp] : [forwardedIp, "103.21.124.5"];

  const requestWatchLink = async (p, token, ip) => {
    const res = await axios.post(
      `${p.domain}/casinoapp/exchange/users/streaming/casinoGameWatchLink`,
      { streamId: String(streamId), timestamp: Date.now() },
      {
        headers: {
          Origin: p.domain,
          Referer: `${p.domain}/`,
          Authorization: `Bearer ${token}`,
          "X-Forwarded-For": ip,
          "X-Real-IP": ip,
          "CF-Connecting-IP": ip,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Content-Type": "application/json"
        },
        httpsAgent: nativeHttpsAgent,
        timeout: 6000
      }
    );
    return res.data?.data?.url || "";
  };

  for (const p of providers) {
    let token = await p.getToken(false);
    if (!token) continue;

    for (const ip of candidateIps) {
      try {
        const streamUrl = await requestWatchLink(p, token, ip);
        if (streamUrl) {
          streamUrlCache.set(cacheKey, {
            url: streamUrl,
            provider: p.name,
            expiresAt: Date.now() + 180000
          });
          console.log(`[DirectStreamEngine] Casino ${rawGameId} (${streamId}) resolved via ${p.name}`);
          return {
            success: true,
            url: streamUrl,
            streamId,
            provider: p.name,
            cached: false
          };
        }
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          try {
            token = await p.getToken(true);
            const streamUrl = await requestWatchLink(p, token, ip);
            if (streamUrl) {
              streamUrlCache.set(cacheKey, {
                url: streamUrl,
                provider: p.name,
                expiresAt: Date.now() + 180000
              });
              return {
                success: true,
                url: streamUrl,
                streamId,
                provider: p.name,
                cached: false
              };
            }
          } catch (_) {}
        }
        console.warn(`[DirectStreamEngine] Provider ${p.name} (${ip}) failed for ${streamId}:`, err.message);
      }
    }
  }

  return {
    success: false,
    message: `Direct studio stream not available for game ${rawGameId}`,
    streamId
  };
}

