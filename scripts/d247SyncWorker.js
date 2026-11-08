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
const POLL_INTERVAL_MS = 1200;

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
const ACTIVE_SPORTS_ETIDS = [4, 1, 2, 8, 10, 65, 7522, 9, 11, 5, 12];

// Dedicated high-speed loops: Casino runs at 800ms, Sports runs at 2500ms
async function runCasinoLoop() {
  console.log("[Casino Engine] Starting real-time 800ms casino live feed loop...");
  let count = 0;
  while (true) {
    try {
      count++;
      const casinoLiveBatch = {};
      const casinoResultsBatch = {};
      const batchSize = 6;
      const startIdx = (count * batchSize) % POPULAR_CASINO_TABLES.length;
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

      if (Object.keys(casinoLiveBatch).length > 0) {
        await axios.post(TARGET_VPS_URL, {
          casinoLive: casinoLiveBatch,
          casinoResults: casinoResultsBatch
        }, {
          headers: { "Content-Type": "application/json" },
          timeout: 4000
        }).catch(() => null);
      }
    } catch (e) {}

    await new Promise(r => setTimeout(r, 800));
  }
}

async function runSportsLoop() {
  console.log("[Sports Engine] Starting real-time 2500ms multi-sport sync loop...");
  let count = 0;
  while (true) {
    try {
      count++;
      const allSportsMatches = {};
      for (const etid of ACTIVE_SPORTS_ETIDS) {
        try {
          const list = await fetchRealSportHighlights(etid).catch(() => []);
          allSportsMatches[etid] = Array.isArray(list) ? list : [];
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
      if (sportsTree.length === 0 || count % 10 === 0) {
        sportsTree = await fetchRealSportsTree().catch(() => sportsTree);
      }

      const matchDetailsBatch = {};
      if (cricketMatches.length > 0) {
        const topMatches = cricketMatches.slice(0, 5);
        const targetMatch = topMatches[count % topMatches.length];
        if (targetMatch?.gmid && targetMatch.gmid !== 'superover2') {
          try {
            const odds = await fetchRealMatchOdds(4, targetMatch.gmid).catch(() => null);
            if (Array.isArray(odds) && odds.length > 0) {
              matchDetailsBatch[targetMatch.gmid] = odds;
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
        matchDetails: matchDetailsBatch,
        latestEvents: cricketMatches.slice(0, 6).map(m => ({
          name: m.ename,
          sportId: 4,
          id: m.gmid
        }))
      };

      const res = await axios.post(TARGET_VPS_URL, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 5000
      });

      console.log(`[Sports Sync #${count}] Pushed -> Cricket: ${cricketMatches.length}, Football: ${footballMatches.length}, Tennis: ${tennisMatches.length}, TT: ${(allSportsMatches[8] || []).length}, Horse: ${(allSportsMatches[10] || []).length}, Greyhound: ${(allSportsMatches[65] || []).length}`);
    } catch (err) {
      console.warn(`[Sports Sync Error #${count}]:`, err.message);
    }

    await new Promise(r => setTimeout(r, 2500));
  }
}

async function runWorker() {
  console.log("==================================================================");
  console.log("   D247 DUAL-CORE ULTRA-SPEED RESIDENTIAL BRIDGE -> PRODUCTION VPS ");
  console.log(`   Target: ${TARGET_VPS_URL}`);
  console.log("==================================================================");

  console.log("[Sync Worker] Booting autonomous local Chrome engine on Mac...");
  await startD247Engine();

  // Wait 4 seconds for Chrome initialization & login
  await new Promise(r => setTimeout(r, 4000));

  console.log("[Sync Worker] Chrome engine is online! Launching dual parallel workers...");
  // Launch both loops in parallel
  Promise.all([
    runCasinoLoop(),
    runSportsLoop()
  ]);
}

runWorker();

