import axios from "axios";
import { getStartexchToken, getDemoToken, getCbtfToken, proxyRequest } from "../services/authService.js";
import { nativeHttpsAgent } from "../services/streamService.js";

const sportsStreamCache = new Map();

/**
 * Resolve external or exchange match ID to Betfair streaming ID
 */
export async function resolveSportsStreamId(rawId, sportId = "4") {
  const strId = String(rawId || "").trim();
  if (!strId) return "";

  // If already standard Betfair ID format (length <= 9 and doesn't start with 200/400/100)
  if (
    strId.length <= 9 &&
    !strId.startsWith("200") &&
    !strId.startsWith("400") &&
    !strId.startsWith("100")
  ) {
    return strId;
  }

  try {
    const marketRes = await proxyRequest("/api/exchange/markets/getMarketsEventList", {
      eventId: strId,
      sportId: String(sportId || "4"),
      key: "2"
    });
    const rawData = marketRes.data?.data?.data || marketRes.data?.data || {};
    const betfairId =
      rawData.matchOddsData?.[0]?.eventId ||
      rawData.bookmakersData?.[0]?.eventId ||
      rawData.fancyData?.[0]?.eventId ||
      rawData.streamId ||
      rawData.eventId;

    if (betfairId) {
      return String(betfairId);
    }
  } catch (e) {
    console.warn(`[DirectStreamEngine] Failed to resolve Betfair ID for ${strId}:`, e.message);
  }

  return strId;
}

/**
 * Fetch direct live sports stream watch link from official upstream providers
 */
export async function getDirectSportsStreamUrl(rawId, sportId = "4", forceRefresh = false) {
  const streamId = await resolveSportsStreamId(rawId, sportId);
  const cacheKey = `sports_${streamId || rawId}`;

  if (!forceRefresh && sportsStreamCache.has(cacheKey)) {
    const cached = sportsStreamCache.get(cacheKey);
    if (Date.now() < cached.expiresAt && cached.url) {
      return {
        success: true,
        url: cached.url,
        streamId,
        provider: cached.provider,
        cached: true,
        radarUrl: `https://tv.tresting.com/lnt.php?eventid=${streamId}&matchId=${streamId}`
      };
    }
  }

  const providers = [
    {
      name: "Startexch99",
      domain: "https://startexch99.com",
      getToken: (force) => getStartexchToken(force)
    },
    {
      name: "Nice444",
      domain: "https://nice444.com",
      getToken: (force) => getDemoToken(force)
    },
    {
      name: "CBTFexchange",
      domain: "https://cbtfexchange.com",
      getToken: (force) => getCbtfToken(force)
    }
  ];

  for (const p of providers) {
    try {
      let token = await p.getToken(false);
      if (!token) continue;

      const endpoint = `${p.domain}/api/exchange/streaming/exchEventsWatchLink`;
      const res = await axios.post(
        endpoint,
        { streamId: String(streamId), timestamp: Date.now() },
        {
          headers: {
            Origin: p.domain,
            Referer: `${p.domain}/`,
            Authorization: `Bearer ${token}`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Content-Type": "application/json"
          },
          httpsAgent: nativeHttpsAgent,
          timeout: 6000
        }
      );

      const streamUrl = res.data?.data?.url;
      if (streamUrl) {
        sportsStreamCache.set(cacheKey, {
          url: streamUrl,
          provider: p.name,
          expiresAt: Date.now() + 60000 // 60s cache
        });

        console.log(`[DirectStreamEngine] Sports match ${rawId} (${streamId}) resolved via ${p.name}`);
        return {
          success: true,
          url: streamUrl,
          streamId,
          provider: p.name,
          cached: false,
          radarUrl: `https://tv.tresting.com/lnt.php?eventid=${streamId}&matchId=${streamId}`
        };
      }
    } catch (err) {
      console.warn(`[DirectStreamEngine] Sports provider ${p.name} failed for ${streamId}:`, err.message);
    }
  }

  return {
    success: false,
    message: `Direct live match stream currently not broadcasted for event ${rawId}`,
    streamId,
    radarUrl: `https://tv.tresting.com/lnt.php?eventid=${streamId}&matchId=${streamId}`
  };
}
