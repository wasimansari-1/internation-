import axios from "axios";
import { getStartexchToken, getDemoToken, proxyRequest } from "./services/authService.js";
import { resolveBetfairStreamId, fetchDirectHlsStream, nativeHttpsAgent } from "./services/streamService.js";

async function main() {
  console.log("==================================================");
  console.log("  SCANNING ALL IN-PLAY MATCHES FOR LIVE STREAMS   ");
  console.log("==================================================");

  let allRes;
  try {
    allRes = await proxyRequest("/api/exchange/market/matchodds/allEventsList");
  } catch (err) {
    console.error("Failed to fetch allEventsList:", err.message);
    return;
  }

  const allData = allRes.data?.data?.data || allRes.data?.data || {};
  const sports = [
    { id: "4", name: "Cricket" },
    { id: "1", name: "Soccer" },
    { id: "2", name: "Tennis" },
  ];

  let sToken, nToken;
  try {
    sToken = await getStartexchToken();
    nToken = await getDemoToken();
  } catch (e) {
    console.warn("Token fetch error:", e.message);
  }

  const activeStreamingMatches = [];

  for (const sport of sports) {
    const list = allData[sport.id] || [];
    const inPlayList = list.filter((m) => m.inPlay === true || m.inPlay === "true" || m.tv || m.streamId);
    console.log(`\n--- [${sport.name}] In-Play Matches: ${inPlayList.length} (Total: ${list.length}) ---`);

    for (const match of inPlayList) {
      const exEventId = match.exEventId || match.eventId;
      process.stdout.write(`Checking: "${match.eventName}" (exEventId: ${exEventId})... `);

      const streamId = await resolveBetfairStreamId(exEventId, sport.id);

      // Try Startexch and Nice444
      let watchUrl = "";
      let providerName = "";

      // Try Startexch
      if (sToken) {
        try {
          const r = await axios.post(
            "https://startexch99.com/api/exchange/streaming/exchEventsWatchLink",
            { streamId: String(streamId), timestamp: Date.now() },
            {
              headers: {
                Authorization: "Bearer " + sToken,
                Origin: "https://startexch99.com",
                Referer: "https://startexch99.com/",
              },
              httpsAgent: nativeHttpsAgent,
              timeout: 4000,
            }
          );
          if (r.data?.data?.url) {
            watchUrl = r.data.data.url;
            providerName = "Startexch99";
          }
        } catch (e) {}
      }

      // Try Nice444
      if (!watchUrl && nToken) {
        try {
          const r = await axios.post(
            "https://nice444.com/api/exchange/streaming/exchEventsWatchLink",
            { streamId: String(streamId), timestamp: Date.now() },
            {
              headers: {
                Authorization: "Bearer " + nToken,
                Origin: "https://nice444.com",
                Referer: "https://nice444.com/",
              },
              httpsAgent: nativeHttpsAgent,
              timeout: 4000,
            }
          );
          if (r.data?.data?.url) {
            watchUrl = r.data.data.url;
            providerName = "Nice444";
          }
        } catch (e) {}
      }

      if (watchUrl) {
        console.log(`\n  >>> LIVE BROADCAST ACTIVE! <<<`);
        console.log(`  Provider: ${providerName}`);
        console.log(`  Watch URL: ${watchUrl}`);

        // Try direct HLS extraction
        try {
          const hlsRes = await fetchDirectHlsStream(exEventId, sport.id, true);
          if (hlsRes && hlsRes.hlsUrl) {
            console.log(`  HLS Stream: ${hlsRes.hlsUrl}`);
          }
        } catch (hlsErr) {
          console.log(`  HLS Note: ${hlsErr.message}`);
        }

        activeStreamingMatches.push({
          sport: sport.name,
          sportId: sport.id,
          name: match.eventName,
          exEventId,
          streamId,
          watchUrl,
          vpsProxyUrl: `https://stream.chimneysolutions.info/api/stream/sports-tv-proxy/${exEventId}?sportId=${sport.id}&fresh=1`,
        });
      } else {
        console.log(`No active stream.`);
      }
    }
  }

  console.log("\n==================================================");
  console.log("            ACTIVE LIVE STREAM RESULTS            ");
  console.log("==================================================");

  if (activeStreamingMatches.length === 0) {
    console.log("No matches currently have an active video broadcast.");
    console.log("Note: Upstream broadcast providers only start the stream when the match is actively in session and stop it during breaks / between matches.");
  } else {
    for (const item of activeStreamingMatches) {
      console.log(`\nMatch: [${item.sport}] ${item.name}`);
      console.log(`Event ID: ${item.exEventId}`);
      console.log(`VPS Proxy Link: ${item.vpsProxyUrl}`);
    }
  }
}

main().catch(console.error);
