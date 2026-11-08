import axios from "axios";
import {
  startD247Engine,
  realDataStore,
  fetchRealSportHighlights,
  fetchRealCasinoTables,
  fetchRealSportsTree,
  fetchRealCasinoTableLive,
  fetchRealCasinoLastResults,
  fetchRealMatchOdds
} from "../backend/services/d247ScraperEngine.js";
import { getCasinoTableList } from "../backend/services/d247Service.js";

const TARGET_VPS_URL = process.env.VPS_URL || "https://stream.chimneysolutions.info/api/d247/push-live";
const POLL_INTERVAL_MS = 2000;

const POPULAR_CASINO_TABLES = [
  "goal2",
  "superover2",
  "dt20",
  "ab20",
  "card32",
  "card32eu",
  "roulette11",
  "teen",
  "lucky7",
  "lucky7eu",
  "baccarat",
  "dolidana",
  "mogambo",
  "aaa",
  "sicbo",
  "worli3"
];

// All active sports supported by D247
const ACTIVE_SPORTS_ETIDS = [4, 1, 2, 8, 10, 65, 7522];

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
      
      // Fetch highlights for ALL sports (Cricket, Football, Tennis, Table Tennis, Horse Racing, Greyhound, Basketball)
      const allSportsMatches = {};
      for (const etid of ACTIVE_SPORTS_ETIDS) {
        try {
          const list = await fetchRealSportHighlights(etid).catch(() => []);
          if (Array.isArray(list) && list.length > 0) {
            allSportsMatches[etid] = list;
          }
        } catch (e) {}
      }

      const cricketMatches = allSportsMatches[4] || [];
      const footballMatches = allSportsMatches[1] || [];
      const tennisMatches = allSportsMatches[2] || [];
      
      let casinoTables = realDataStore.casinoTables || [];
      if (casinoTables.length === 0) {
        const fullTables = await getCasinoTableList().catch(() => []);
        casinoTables = Array.isArray(fullTables) ? fullTables : (fullTables?.data || []);
      }

      let sportsTree = realDataStore.sportsTree || [];
      if (sportsTree.length === 0 || loopCount % 15 === 0) {
        sportsTree = await fetchRealSportsTree().catch(() => sportsTree);
      }

      // Continuously fetch live table states & results for popular casino games (batch of 8 per cycle + pinned)
      const casinoLiveBatch = {};
      const casinoResultsBatch = {};
      const batchSize = 8;
      const startIdx = (loopCount * batchSize) % POPULAR_CASINO_TABLES.length;
      const batchGtypes = ["superover2", "goal2"];
      for (let i = 0; i < batchSize; i++) {
        const t = POPULAR_CASINO_TABLES[(startIdx + i) % POPULAR_CASINO_TABLES.length];
        if (!batchGtypes.includes(t)) batchGtypes.push(t);
      }

      await Promise.all(batchGtypes.map(async (gtype) => {
        try {
          const live = await fetchRealCasinoTableLive(gtype).catch(() => null);
          if (live) {
            casinoLiveBatch[gtype] = live;
            const norm = normalizeCasinoGtype(gtype);
            if (norm && norm !== gtype) casinoLiveBatch[norm] = live;
          }
          const res = await fetchRealCasinoLastResults(gtype).catch(() => null);
          if (res && res.length > 0) {
            casinoResultsBatch[gtype] = res;
            const norm = normalizeCasinoGtype(gtype);
            if (norm && norm !== gtype) casinoResultsBatch[norm] = res;
          }
        } catch (e) {}
      }));

      // Continuously fetch deep multi-market odds for top active cricket matches
      const matchDetailsBatch = {};
      if (cricketMatches.length > 0) {
        const candidateMatches = cricketMatches.slice(0, 6);
        const topMatch = candidateMatches[loopCount % candidateMatches.length];
        if (topMatch && topMatch.gmid && topMatch.gmid !== 'superover2') {
          try {
            const odds = await fetchRealMatchOdds(4, topMatch.gmid).catch(() => null);
            if (odds && Array.isArray(odds) && odds.length > 0) {
              matchDetailsBatch[topMatch.gmid] = odds;
            }
          } catch (e) {}
        }
      }

      const payload = {
        sportsTree,
        allSportsMatches,
        cricketMatches,
        footballMatches,
        tennisMatches,
        casinoTables,
        casinoLive: casinoLiveBatch,
        casinoResults: casinoResultsBatch,
        matchDetails: matchDetailsBatch,
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
      const oddsKeys = Object.keys(matchDetailsBatch).join(", ") || "none";
      const totalSportsSynced = Object.keys(allSportsMatches).length;
      console.log(`[Sync Worker #${loopCount}] Pushed to VPS -> Sports: ${totalSportsSynced} (Cricket: ${cricketMatches.length}, Football: ${footballMatches.length}, Tennis: ${tennisMatches.length}, TT: ${(allSportsMatches[8] || []).length}) | Live: [${liveKeys}] | Match odds: [${oddsKeys}]`);
    } catch (err) {
      console.warn(`[Sync Worker Error #${loopCount}]:`, err.message);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

runWorker();

