import axios from "axios";
import {
  startD247Engine,
  realDataStore,
  fetchRealSportHighlights,
  fetchRealCasinoTables,
  fetchRealSportsTree,
  fetchRealCasinoTableLive,
  fetchRealCasinoLastResults
} from "../backend/services/d247ScraperEngine.js";
import { getCasinoTableList } from "../backend/services/d247Service.js";

const TARGET_VPS_URL = process.env.VPS_URL || "https://stream.chimneysolutions.info/api/d247/push-live";
const POLL_INTERVAL_MS = 2000;

const POPULAR_CASINO_TABLES = [
  "goal2",
  "matka",
  "worli3",
  "lucky7",
  "teen",
  "superover2",
  "dolidana",
  "roulette",
  "dragon_tiger",
  "andar_bahar",
  "32cards",
  "baccarat",
  "mogambo",
  "lucky6"
];

async function runWorker() {
  console.log("==================================================================");
  console.log("   D247 HIGH-SPEED RESIDENTIAL SYNC BRIDGE -> PRODUCTION VPS      ");
  console.log(`   Target: ${TARGET_VPS_URL}`);
  console.log("==================================================================");

  console.log("[Sync Worker] Booting autonomous local Chrome engine on Mac...");
  await startD247Engine();

  // Wait a few seconds for engine initialization
  await new Promise(r => setTimeout(r, 4000));

  console.log("[Sync Worker] Chrome engine is online! Starting real-time synchronization loop...");

  let loopCount = 0;
  while (true) {
    try {
      loopCount++;
      const cricketMatches = await fetchRealSportHighlights(4).catch(() => []);
      const footballMatches = await fetchRealSportHighlights(1).catch(() => []);
      const tennisMatches = await fetchRealSportHighlights(2).catch(() => []);
      
      let casinoTables = realDataStore.casinoTables || [];
      if (casinoTables.length === 0) {
        const fullTables = await getCasinoTableList().catch(() => []);
        casinoTables = Array.isArray(fullTables) ? fullTables : (fullTables?.data || []);
      }

      let sportsTree = realDataStore.sportsTree || [];
      if (sportsTree.length === 0 || loopCount % 15 === 0) {
        sportsTree = await fetchRealSportsTree().catch(() => sportsTree);
      }

      // Continuously fetch live table states & results for popular casino games (round-robin)
      const casinoLiveBatch = {};
      const casinoResultsBatch = {};
      const startIdx = (loopCount * 2) % POPULAR_CASINO_TABLES.length;
      const batchGtypes = [
        POPULAR_CASINO_TABLES[startIdx],
        POPULAR_CASINO_TABLES[(startIdx + 1) % POPULAR_CASINO_TABLES.length]
      ];

      for (const gtype of batchGtypes) {
        try {
          const live = await fetchRealCasinoTableLive(gtype).catch(() => null);
          if (live) casinoLiveBatch[gtype] = live;
          const res = await fetchRealCasinoLastResults(gtype).catch(() => null);
          if (res && res.length > 0) casinoResultsBatch[gtype] = res;
        } catch (e) {}
      }

      const payload = {
        sportsTree,
        cricketMatches,
        footballMatches,
        tennisMatches,
        casinoTables,
        casinoLive: casinoLiveBatch,
        casinoResults: casinoResultsBatch,
        latestEvents: cricketMatches.slice(0, 6).map(m => ({
          name: m.ename,
          sportId: 4,
          id: m.gmid
        }))
      };

      const res = await axios.post(TARGET_VPS_URL, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 6000
      });

      const liveKeys = Object.keys(casinoLiveBatch).join(", ") || "none";
      console.log(`[Sync Worker #${loopCount}] Pushed to VPS -> Cricket: ${cricketMatches.length} | Casino: ${casinoTables.length} tables | Live tables: [${liveKeys}] | VPS matches: ${res.data.cricketCount}`);
    } catch (err) {
      console.warn(`[Sync Worker Error #${loopCount}]:`, err.message);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

runWorker();

