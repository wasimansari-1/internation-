import axios from "axios";
import { getDemoToken, proxyRequest } from "./authService.js";

export const STABLE_STREAM_IP = "49.36.142.88";

export const getClientIp = (req) => {
  return STABLE_STREAM_IP;
};

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
  let token = await getDemoToken(forceRefresh);
  const makeRequest = async (authToken) => {
    const headers = {
      Authorization: `Bearer ${authToken}`,
      Origin: "https://nice444.com",
      Referer: "https://nice444.com/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "X-Forwarded-For": forwardedIp,
      "X-Real-IP": forwardedIp,
    };
    return await axios.post(
      "https://nice444.com/api/exchange/streaming/exchEventsWatchLink",
      { streamId: String(streamId), timestamp: Date.now() },
      {
        headers,
        timeout: 6000,
      },
    );
  };

  let upstreamRes;
  try {
    upstreamRes = await makeRequest(token);
  } catch (err) {
    console.warn(
      "Nice444 exchEventsWatchLink initial attempt failed:",
      err.message,
      "Retrying with fresh token...",
    );
    try {
      token = await getDemoToken(true);
      upstreamRes = await makeRequest(token);
    } catch (retryErr) {
      throw retryErr;
    }
  }

  const url = upstreamRes.data?.data?.url || "";
  const entry = { url, streamId, expiresAt: Date.now() + 60000 };
  sportsStreamCache.set(cacheKey, entry);
  return entry;
};
