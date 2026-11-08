import axios from "axios";
import {
  startD247Engine,
  realDataStore,
  fetchRealSportHighlights,
  fetchRealCasinoTables,
  fetchRealSportsTree,
  fetchRealCasinoTableLive,
  fetchRealCasinoLastResults,
  fetchRealMatchOdds,
  normalizeCasinoGtype
} from "../backend/services/d247ScraperEngine.js";
import { getCasinoTableList } from "../backend/services/d247Service.js";

const TARGET_VPS_URL = process.env.VPS_URL || "https://stream.chimneysolutions.info/api/d247/push-live";
const TARGET_LOCAL_URL = process.env.LOCAL_URL || "http://127.0.0.1:5001/api/d247/push-live";
const POLL_INTERVAL_MS = 1200;

const POPULAR_CASINO_TABLES = [
  "goal2",
  "superover2",
  "dt20",
  "ab20",
  "card32",
  "card32eu",
  "roulette11",
  "roulette12",
  "teen",
  "lucky7",
  "lucky7eu",
  "lucky6",
  "baccarat",
  "poker6",
  "poker20",
  "poker1day",
  "poker",
  "dolidana",
  "mogambo",
  "aaa",
  "sicbo",
  "worli3"
];

// All active sports supported by D247 in exact sequence
const ACTIVE_SPORTS_ETIDS = [
  4,   // Cricket
  1,   // Football
  2,   // Tennis
  8,   // Table Tennis
  10,  // Horse Racing
  65,  // Greyhound Racing
  15,  // Basketball
  69,  // Wrestling
  18,  // Volleyball
  59,  // Snooker
  11,  // E Games
  19,  // Ice Hockey
  9,   // Futsal
  22,  // Badminton
  6,   // Boxing
  3,   // Mixed Martial Arts
  58,  // American Football
  52,  // Motor Sports
  66,  // Kabaddi
  40,  // Politics
  7522 // Virtual
];

// Active tables & matches currently watched by live frontend clients on VPS
let clientWatchList = new Set();
let clientWatchMatches = [];

// Dedicated ultra-speed loops: Casino & Active Match run at 400ms, Sports runs at 2500ms
let currentActiveMatch = null;
let currentActiveCasino = null;

async function runCasinoLoop() {
  console.log("[Casino Engine] Starting real-time 300ms casino & active match live feed loop...");
  let count = 0;
  let bgOffset = 0;

  while (true) {
    try {
      count++;
      const casinoLiveBatch = {};
      const casinoResultsBatch = {};
      const matchDetailsBatch = {};

      // 1. Identify Priority Tables (Client watched tables + Top core tables)
      const topCoreTables = ["lucky7", "superover2", "poker6", "dt20", "goal2", "teen", "card32", "ab20"];
      const prioritySet = new Set([
        ...topCoreTables,
        ...(currentActiveCasino ? [currentActiveCasino] : []),
        ...clientWatchList
      ]);
      const priorityGtypes = Array.from(prioritySet);

      // 2. Rotating background tables (4 tables per tick to prevent CDP/network congestion)
      const backgroundGtypes = POPULAR_CASINO_TABLES.filter(g => !prioritySet.has(g));
      const chunkCount = 4;
      const rotatingGtypes = [];
      if (backgroundGtypes.length > 0) {
        for (let i = 0; i < chunkCount; i++) {
          const idx = (bgOffset + i) % backgroundGtypes.length;
          rotatingGtypes.push(backgroundGtypes[idx]);
        }
        bgOffset = (bgOffset + chunkCount) % backgroundGtypes.length;
      }

      const tickGtypes = Array.from(new Set([...priorityGtypes, ...rotatingGtypes]));
      const shouldFetchResults = (count % 12 === 0); // Results sync every ~3.5s

      await Promise.all(tickGtypes.map(async (gtype) => {
        try {
          const live = await fetchRealCasinoTableLive(gtype).catch(() => null);
          if (live) {
            casinoLiveBatch[gtype] = live;
            const norm = normalizeCasinoGtype(gtype);
            if (norm && norm !== gtype) casinoLiveBatch[norm] = live;
            if (Array.isArray(live.results) && live.results.length > 0) {
              casinoResultsBatch[gtype] = live.results;
              if (norm && norm !== gtype) casinoResultsBatch[norm] = live.results;
            }
          }
          if (shouldFetchResults) {
            const res = await fetchRealCasinoLastResults(gtype).catch(() => null);
            if (res && res.length > 0) {
              casinoResultsBatch[gtype] = res;
              const norm = normalizeCasinoGtype(gtype);
              if (norm && norm !== gtype) casinoResultsBatch[norm] = res;
            }
          }
        } catch (e) {}
      }));

      // 3. Ultra-Fast Live Odds Scraper for Active Match open in user's browser (0.1s rate sync!)
      const matchesToScrape = [];
      if (currentActiveMatch && currentActiveMatch.gmid && currentActiveMatch.gmid !== 'superover2') {
        matchesToScrape.push(currentActiveMatch);
      }
      if (clientWatchMatches.length > 0) {
        clientWatchMatches.forEach(wm => {
          if (wm?.gmid && wm.gmid !== 'superover2' && !matchesToScrape.some(m => String(m.gmid) === String(wm.gmid))) {
            matchesToScrape.push(wm);
          }
        });
      }

      if (matchesToScrape.length > 0) {
        await Promise.all(matchesToScrape.map(async (wm) => {
          try {
            const odds = await fetchRealMatchOdds(wm.etid || 4, wm.gmid).catch(() => null);
            if (Array.isArray(odds) && odds.length > 0) {
              matchDetailsBatch[wm.gmid] = odds;
            }
          } catch (e) {}
        }));
      }

      if (Object.keys(casinoLiveBatch).length > 0 || Object.keys(matchDetailsBatch).length > 0) {
        const casinoPayload = {
          casinoLive: casinoLiveBatch,
          casinoResults: casinoResultsBatch,
          matchDetails: matchDetailsBatch
        };

        const [pushRes, localRes] = await Promise.all([
          axios.post(TARGET_VPS_URL, casinoPayload, { headers: { "Content-Type": "application/json" }, timeout: 3000 }).catch(() => null),
          axios.post(TARGET_LOCAL_URL, casinoPayload, { headers: { "Content-Type": "application/json" }, timeout: 1200 }).catch(() => null)
        ]);

        const combinedRes = pushRes || localRes;

        // Update active watch lists from connected clients
        if (combinedRes?.data?.watchList && Array.isArray(combinedRes.data.watchList)) {
          clientWatchList = new Set(combinedRes.data.watchList.map(g => normalizeCasinoGtype(g)));
        }
        if (combinedRes?.data?.activeCasino) {
          currentActiveCasino = normalizeCasinoGtype(combinedRes.data.activeCasino);
          clientWatchList.add(currentActiveCasino);
        } else {
          currentActiveCasino = null;
        }
        if (combinedRes?.data?.watchMatches && Array.isArray(combinedRes.data.watchMatches)) {
          clientWatchMatches = combinedRes.data.watchMatches;
        }
        if (combinedRes?.data?.activeMatch) {
          currentActiveMatch = combinedRes.data.activeMatch;
        } else {
          currentActiveMatch = null;
        }
        if (count === 1 || count % 10 === 0) {
          console.log(`[Casino Sync #${count}] Pushed ${Object.keys(casinoLiveBatch).length} tables | lucky7: RID ${casinoLiveBatch.lucky7?.roundId} (${casinoLiveBatch.lucky7?.leftSec}s, ${casinoLiveBatch.lucky7?.roundStatus}) | poker6: RID ${casinoLiveBatch.poker6?.roundId} (${casinoLiveBatch.poker6?.leftSec}s) | goal2: RID ${casinoLiveBatch.goal2?.roundId} (${casinoLiveBatch.goal2?.leftSec}s)`);
        }
      }
    } catch (e) {
      console.error("[Casino Engine] Loop tick error:", e.message);
    }

    await new Promise(r => setTimeout(r, 220));
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
        const targetCricket = cricketMatches[count % Math.min(cricketMatches.length, 6)];
        if (targetCricket?.gmid && targetCricket.gmid !== 'superover2') {
          try {
            const odds = await fetchRealMatchOdds(4, targetCricket.gmid).catch(() => null);
            if (Array.isArray(odds) && odds.length > 0) matchDetailsBatch[targetCricket.gmid] = odds;
          } catch (e) {}
        }
      }
      if (footballMatches.length > 0) {
        const targetFootball = footballMatches[count % Math.min(footballMatches.length, 6)];
        if (targetFootball?.gmid) {
          try {
            const odds = await fetchRealMatchOdds(1, targetFootball.gmid).catch(() => null);
            if (Array.isArray(odds) && odds.length > 0) matchDetailsBatch[targetFootball.gmid] = odds;
          } catch (e) {}
        }
      }
      const ttMatches = allSportsMatches[8] || [];
      if (ttMatches.length > 0) {
        const targetTT = ttMatches[count % Math.min(ttMatches.length, 6)];
        if (targetTT?.gmid) {
          try {
            const odds = await fetchRealMatchOdds(8, targetTT.gmid).catch(() => null);
            if (Array.isArray(odds) && odds.length > 0) matchDetailsBatch[targetTT.gmid] = odds;
          } catch (e) {}
        }
      }
      if (tennisMatches.length > 0) {
        const targetTennis = tennisMatches[count % Math.min(tennisMatches.length, 6)];
        if (targetTennis?.gmid) {
          try {
            const odds = await fetchRealMatchOdds(2, targetTennis.gmid).catch(() => null);
            if (Array.isArray(odds) && odds.length > 0) matchDetailsBatch[targetTennis.gmid] = odds;
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

      await Promise.allSettled([
        axios.post(TARGET_VPS_URL, payload, { headers: { "Content-Type": "application/json" }, timeout: 5000 }).catch(() => null),
        axios.post(TARGET_LOCAL_URL, payload, { headers: { "Content-Type": "application/json" }, timeout: 2000 }).catch(() => null)
      ]);

      console.log(`[Sports Sync #${count}] Pushed -> Cricket: ${cricketMatches.length}, Football: ${footballMatches.length}, Tennis: ${tennisMatches.length}, TT: ${(allSportsMatches[8] || []).length}, Horse: ${(allSportsMatches[10] || []).length}, Greyhound: ${(allSportsMatches[65] || []).length}`);
    } catch (err) {
      console.warn(`[Sports Sync Error #${count}]:`, err.message);
    }

    await new Promise(r => setTimeout(r, 1200));
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

