import axios from "axios";
import { getDemoToken, getStartexchToken, proxyRequest } from "./authService.js";

// Realistic Indian residential IP subnets (Jio, Airtel, Vodafone Idea)
export const RESIDENTIAL_INDIAN_IPS = [
  "49.36.142.88",   // Jio Fiber Mumbai
  "106.193.184.22", // Airtel Broadband Delhi
  "27.57.198.45",   // Vodafone Idea Pune
  "49.37.210.15",   // Jio Mobile Bangalore
  "117.216.48.91",  // BSNL FTTH Hyderabad
  "106.208.77.104", // Airtel 5G Kolkata
  "157.34.120.65",  // Jio Fiber Chennai
];

export const getClientIp = (req) => {
  if (!req) return RESIDENTIAL_INDIAN_IPS[0];
  const forwarded =
    req.headers?.["cf-connecting-ip"] ||
    req.headers?.["x-real-ip"] ||
    (req.headers?.["x-forwarded-for"]
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : null) ||
    req.ip;

  if (
    forwarded &&
    !forwarded.startsWith("127.") &&
    !forwarded.startsWith("10.") &&
    !forwarded.startsWith("192.168.") &&
    forwarded !== "::1"
  ) {
    return forwarded;
  }
  // Rotate residential IP
  const idx = Math.floor(Math.random() * RESIDENTIAL_INDIAN_IPS.length);
  return RESIDENTIAL_INDIAN_IPS[idx];
};

export const STABLE_STREAM_IP = RESIDENTIAL_INDIAN_IPS[0];

// Global in-memory cache for sports streams to prevent single-demo account stream invalidations
export const sportsStreamCache = new Map(); // key: streamId/eventId -> { html, url, streamId, expiresAt }
// In-flight promise coalescing map: ensures concurrent requests for the same stream wait for ONE single fetch
export const inFlightStreamFetches = new Map(); // key: cacheKey -> Promise<string>
// Upstream circuit breaker to prevent hammering provider on 403 access denial
export const upstreamStreamBreaker = new Map(); // key: cacheKey -> blockedUntilTimestamp

export const resolveBetfairStreamId = async (rawId, sportId = "4") => {
  const strId = String(rawId || "").trim();
  if (!strId) return "";
  if (
    strId.length <= 9 &&
    !strId.startsWith("200") &&
    !strId.startsWith("400") &&
    !strId.startsWith("100")
  ) {
    return strId;
  }
  try {
    const marketRes = await proxyRequest(
      "/api/exchange/markets/getMarketsEventList",
      {
        eventId: strId,
        sportId: String(sportId || "4"),
      },
    );
    const betfairId =
      marketRes.data?.data?.matchOddsData?.[0]?.eventId ||
      marketRes.data?.data?.data?.matchOddsData?.[0]?.eventId;
    if (betfairId) return String(betfairId);
  } catch (e) {}
  return strId;
};

export const fetchSportsWatchLink = async (
  rawId,
  sportId = "4",
  clientIp = "",
  forceRefresh = false,
) => {
  const streamId = await resolveBetfairStreamId(rawId, sportId);
  const cacheKey = String(streamId || rawId);

  if (!forceRefresh && sportsStreamCache.has(cacheKey)) {
    const cached = sportsStreamCache.get(cacheKey);
    if (Date.now() < cached.expiresAt && cached.url) {
      return { url: cached.url, streamId };
    }
  }

  const forwardedIp = clientIp || STABLE_STREAM_IP;
  let provider = "Nice444";
  let streamUrl = "";

  // 1. Primary Attempt: Nice444
  try {
    let token = await getDemoToken(forceRefresh);
    const headers = {
      Authorization: `Bearer ${token}`,
      Origin: "https://nice444.com",
      Referer: "https://nice444.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "X-Forwarded-For": forwardedIp,
      "X-Real-IP": forwardedIp,
      "CF-Connecting-IP": forwardedIp,
    };
    const res = await axios.post(
      "https://nice444.com/api/exchange/streaming/exchEventsWatchLink",
      { streamId: String(streamId), timestamp: Date.now() },
      { headers, timeout: 6000 },
    );
    streamUrl = res.data?.data?.url || "";
  } catch (err) {
    console.warn("[StreamService] Nice444 watch link failed:", err.message);
  }

  // 2. Secondary Attempt: Startexch99 (Dual-Provider Failover)
  if (!streamUrl) {
    try {
      const startexchToken = await getStartexchToken(forceRefresh);
      if (startexchToken) {
        const headers = {
          Authorization: `Bearer ${startexchToken}`,
          Origin: "https://startexch99.com",
          Referer: "https://startexch99.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "X-Forwarded-For": forwardedIp,
          "X-Real-IP": forwardedIp,
          "CF-Connecting-IP": forwardedIp,
        };
        const res = await axios.post(
          "https://startexch99.com/api/exchange/streaming/exchEventsWatchLink",
          { streamId: String(streamId), timestamp: Date.now() },
          { headers, timeout: 6000 },
        );
        if (res.data?.data?.url) {
          streamUrl = res.data.data.url;
          provider = "Startexch99";
          console.log("[StreamService] Successfully acquired Startexch99 stream URL:", streamUrl);
        }
      }
    } catch (startErr) {
      console.warn("[StreamService] Startexch99 watch link fallback failed:", startErr.message);
    }
  }

  const entry = { url: streamUrl, streamId, provider, expiresAt: Date.now() + 60000 };
  if (streamUrl) {
    sportsStreamCache.set(cacheKey, entry);
  }
  return entry;
};

// Directly resolve the real live HLS stream from Startexch99 (with Nice444 fallback)
export const fetchDirectHlsStream = async (rawId, sportId = "4", forceRefresh = false) => {
  const streamId = await resolveBetfairStreamId(rawId, sportId);
  const cacheKey = `hls_${streamId || rawId}`;

  if (!forceRefresh && sportsStreamCache.has(cacheKey)) {
    const cached = sportsStreamCache.get(cacheKey);
    if (Date.now() < cached.expiresAt && cached.hlsUrl) {
      return cached;
    }
  }

  // 1. Primary: Startexch99 live streaming
  let watchUrl = "";
  let origin = "https://startexch99.com";
  try {
    const startToken = await getStartexchToken(forceRefresh);
    if (startToken) {
      const res = await axios.post(
        "https://startexch99.com/api/exchange/streaming/exchEventsWatchLink",
        { streamId: String(streamId), timestamp: Date.now() },
        {
          headers: {
            Authorization: `Bearer ${startToken}`,
            Origin: "https://startexch99.com",
            Referer: "https://startexch99.com/",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
          timeout: 6000,
        },
      );
      watchUrl = res.data?.data?.url || "";
    }
  } catch (e) {
    console.warn("[StreamService] Startexch watchlink failed:", e.message);
  }

  // 2. Secondary: Nice444 fallback
  if (!watchUrl) {
    try {
      const niceToken = await getDemoToken(forceRefresh);
      const res = await axios.post(
        "https://nice444.com/api/exchange/streaming/exchEventsWatchLink",
        { streamId: String(streamId), timestamp: Date.now() },
        {
          headers: {
            Authorization: `Bearer ${niceToken}`,
            Origin: "https://nice444.com",
            Referer: "https://nice444.com/",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
          timeout: 6000,
        },
      );
      if (res.data?.data?.url) {
        watchUrl = res.data.data.url;
        origin = "https://nice444.com";
      }
    } catch (e) {
      console.warn("[StreamService] Nice444 fallback failed:", e.message);
    }
  }

  if (!watchUrl) {
    throw new Error("No live stream broadcast found for this event");
  }

  // 3. Fetch watch page to extract CFG
  const pageRes = await axios.get(watchUrl, {
    headers: {
      Origin: origin,
      Referer: `${origin}/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    timeout: 8000,
  });

  const cfgMatch = pageRes.data.match(/<script type="application\/json" id="cfg">([^<]+)<\/script>/);
  if (!cfgMatch) {
    throw new Error("Failed to parse stream configuration from provider");
  }
  const cfg = JSON.parse(cfgMatch[1]);

  // 4. Ping endpoint to retrieve real HLS stream URL and token
  const pingUrl = `https://tv.ltve.live${cfg.pingUrl}`;
  const pingRes = await axios.post(
    pingUrl,
    { sid: cfg.sid, mode: null, init: true, tz: "Asia/Kolkata" },
    {
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Referer: watchUrl,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      timeout: 8000,
    },
  );

  const { hlsUrl, token, streamId: ltveStreamId } = pingRes.data || {};
  if (!hlsUrl || !token) {
    throw new Error("Live stream manifest currently unavailable");
  }

  const directHlsUrl = `${hlsUrl}?token=${token}`;
  const result = {
    hlsUrl: directHlsUrl,
    baseHlsUrl: hlsUrl,
    token,
    sid: cfg.sid,
    pingUrl: cfg.pingUrl,
    streamId,
    watchUrl,
    expiresAt: Date.now() + 50000,
  };
  sportsStreamCache.set(cacheKey, result);
  return result;
};

