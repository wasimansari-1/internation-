import express from "express";
import {
  getSportsTree,
  getHighlightEvents,
  getLiveMatchOdds,
  getMatchDetails,
  getCasinoTableList,
  getAllCasinoList,
  getCasinoTableLive,
  getCasinoLastResults,
  getUserData,
  setD247Session,
  getD247Session
} from "../services/d247Service.js";
import {
  realDataStore,
  fetchRealSportsTree,
  fetchRealSportHighlights,
  fetchRealCasinoTableLive,
  fetchRealCasinoLastResults,
  fetchRealMatchOdds,
  getDebugPageImages
} from "../services/d247ScraperEngine.js";

const router = express.Router();

router.get("/debug/status", async (req, res) => {
  const { getChromeExecutablePath, realDataStore } = await import("../services/d247ScraperEngine.js");
  const fs = (await import("fs")).default;
  const chromePath = getChromeExecutablePath();
  res.json({
    chromeDetected: chromePath,
    hasGoogleChromeStable: fs.existsSync("/usr/bin/google-chrome-stable"),
    hasGoogleChrome: fs.existsSync("/usr/bin/google-chrome"),
    hasChromiumBrowser: fs.existsSync("/usr/bin/chromium-browser"),
    hasChromium: fs.existsSync("/usr/bin/chromium"),
    isEngineActive: realDataStore.isEngineActive,
    cricketMatchesCount: (realDataStore.sportsMatches[4] || []).length,
    casinoTablesCount: (realDataStore.casinoTables || []).length,
    cookiesLength: (realDataStore.sessionCookies || "").length
  });
});

router.get("/debug/test-axios", async (req, res) => {
  const { encrypt, decrypt } = await import("../services/d247ScraperEngine.js");
  const axios = (await import("axios")).default;
  const fs = (await import("fs")).default;
  const path = (await import("path")).default;
  const SESSION_FILE = path.resolve(process.cwd(), ".d247_session.json");
  let cookieStr = "";
  if (fs.existsSync(SESSION_FILE)) {
    try { cookieStr = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8")).cookies || ""; } catch(e) {}
  }
  try {
    const encBody = encrypt({ etid: 4, type: "all" });
    const r = await axios.post("https://d247.com/api/front/highlighthomePrivate?etid=4", 
      { data: encBody },
      {
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://d247.com",
          "Referer": "https://d247.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Cookie": cookieStr
        },
        timeout: 8000
      }
    );
    let dec = r.data;
    if (r.data?.data && typeof r.data.data === "string") {
      dec = decrypt(r.data.data);
    }
    res.json({ success: true, status: r.status, dataSample: dec ? (dec.data ? (Array.isArray(dec.data) ? dec.data.length : Object.keys(dec.data)) : dec) : null });
  } catch (err) {
    res.json({ success: false, error: err.message, status: err.response?.status, responseData: err.response?.data });
  }
});

router.get("/debug/images", async (req, res) => {
  const result = await getDebugPageImages();
  res.json(result);
});

router.get("/debug/page-info", async (req, res) => {
  const { evalInPage } = await import("../services/d247ScraperEngine.js");
  try {
    const url = await evalInPage("window.location.href");
    const title = await evalInPage("document.title");
    const text = await evalInPage("(document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').slice(0, 300)");
    const rowCount = await evalInPage("document.querySelectorAll('.bet-table-row').length");
    const htmlSnippet = await evalInPage("(document.body ? document.body.innerHTML : '').replace(/\\s+/g, ' ').slice(0, 500)");
    const fetchTest = await evalInPage(`
      fetch('/api/front/highlighthomePrivate?etid=4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' })
      }).then(r => ({ status: r.status, ok: r.ok, type: r.type })).catch(e => ({ error: e.message }))
    `);
    res.json({ success: true, url, title, text, htmlSnippet, rowCount, fetchTest });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.get("/debug/test-engine", async (req, res) => {
  const { evalD247Api, fetchRealSportHighlights, realDataStore } = await import("../services/d247ScraperEngine.js");
  try {
    const raw = await evalD247Api("highlighthomePrivate?etid=4", { etid: 4, type: "all" });
    const matches = await fetchRealSportHighlights(4);
    res.json({
      success: true,
      raw: raw,
      storeTreeLength: realDataStore.sportsTree.length,
      storeMatchesCricket: (realDataStore.sportsMatches[4] || []).length,
      matchesCount: (matches || []).length
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Live Feed Sync Bridge (Pushes 100% real D247 feed from residential node to production VPS)
router.post("/push-live", (req, res) => {
  const {
    sportsTree,
    sportsMatches,
    allSportsMatches,
    cricketMatches,
    footballMatches,
    tennisMatches,
    casinoTables,
    latestEvents,
    casinoLive,
    casinoResults,
    matchDetails
  } = req.body;

  if (Array.isArray(sportsTree) && sportsTree.length > 0) {
    realDataStore.sportsTree = sportsTree;
  }

  // Support comprehensive all-sports map (Cricket, Football, Tennis, Table Tennis, Horse Racing, Greyhound, Basketball, etc.)
  const sportsMap = allSportsMatches || sportsMatches;
  if (sportsMap && typeof sportsMap === "object") {
    for (const [etid, matches] of Object.entries(sportsMap)) {
      if (Array.isArray(matches)) {
        realDataStore.sportsMatches[Number(etid)] = matches;
        realDataStore.sportsMatches[String(etid)] = matches;
      }
    }
  }

  if (Array.isArray(cricketMatches) && cricketMatches.length > 0) {
    realDataStore.sportsMatches[4] = cricketMatches;
  }
  if (Array.isArray(footballMatches) && footballMatches.length > 0) {
    realDataStore.sportsMatches[1] = footballMatches;
  }
  if (Array.isArray(tennisMatches) && tennisMatches.length > 0) {
    realDataStore.sportsMatches[2] = tennisMatches;
  }
  if (Array.isArray(casinoTables) && casinoTables.length > 0) {
    realDataStore.casinoTables = casinoTables;
  }
  if (casinoLive && typeof casinoLive === "object") {
    Object.assign(realDataStore.casinoLive, casinoLive);
  }
  if (casinoResults && typeof casinoResults === "object") {
    Object.assign(realDataStore.casinoResults, casinoResults);
  }
  if (matchDetails && typeof matchDetails === "object") {
    if (!realDataStore.matchDetails) realDataStore.matchDetails = {};
    Object.assign(realDataStore.matchDetails, matchDetails);
  }
  if (Array.isArray(latestEvents) && latestEvents.length > 0) {
    cachedLatestEvents = latestEvents;
    lastEventsFetchTime = Date.now();
  }
  realDataStore.lastUpdate = Date.now();
  realDataStore.isEngineActive = true;
  res.json({
    success: true,
    message: "Live stream synchronized successfully!",
    cricketCount: (realDataStore.sportsMatches[4] || []).length,
    casinoCount: (realDataStore.casinoTables || []).length,
    sportsSynced: Object.keys(realDataStore.sportsMatches),
    matchDetailsCount: Object.keys(realDataStore.matchDetails || {}).length,
    timestamp: realDataStore.lastUpdate
  });
});

// Session Management
router.post("/session", (req, res) => {
  const { token, cookies, curlString, username } = req.body;
  setD247Session({ token, cookies, curlString, username });
  res.json({ success: true, session: getD247Session() });
});

router.get("/session", (req, res) => {
  res.json({ success: true, session: getD247Session() });
});

// Sports Tree / Tab Header (All sports in exact D247 sequence)
router.get("/sports/tree", async (req, res) => {
  if (realDataStore.sportsTree.length > 0) {
    return res.json({ success: true, data: realDataStore.sportsTree });
  }
  const tree = await fetchRealSportsTree();
  if (Array.isArray(tree) && tree.length > 0) {
    return res.json({ success: true, data: tree });
  }
  const result = await getSportsTree();
  const data = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
  res.json({ success: true, data });
});

// Sports Highlights (100% Real Scraped Matches)
router.get("/sports/highlights", async (req, res) => {
  const etid = Number(req.query.etid || 4); // 4 = Cricket, 1 = Football, 2 = Tennis, 7 = Horse, 8 = Table Tennis

  // 1. Check real autonomous scraper store
  if (realDataStore.sportsMatches[etid] && realDataStore.sportsMatches[etid].length > 0) {
    return res.json({ success: true, data: realDataStore.sportsMatches[etid] });
  }

  // 2. Fetch live via engine if engine active
  if (realDataStore.isEngineActive) {
    const live = await fetchRealSportHighlights(etid);
    return res.json({ success: true, data: Array.isArray(live) ? live : [] });
  }

  // 3. Fallback only if engine not started
  const result = await getHighlightEvents(etid);
  const data = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
  res.json({ success: true, data });
});

router.get("/debug/eval-page", async (req, res) => {
  const { evalInPage } = await import("../services/d247ScraperEngine.js");
  const result = await evalInPage(req.query.code);
  res.json({ success: true, result });
});

router.get("/debug/eval", async (req, res) => {
  const endpoint = req.query.ep;
  const body = req.query.body ? JSON.parse(req.query.body) : {};
  const { evalD247Api } = await import("../services/d247ScraperEngine.js");
  const result = await evalD247Api(endpoint, body);
  res.json({ success: true, result });
});

router.get("/debug/raw-odds/:etid/:gmid", async (req, res) => {
  const { etid, gmid } = req.params;
  const { evalD247Api } = await import("../services/d247ScraperEngine.js");
  const dec = await evalD247Api(`gamedataPrivate?etid=${etid}&gmid=${gmid}`, {
    etid: Number(etid),
    gmid: Number(gmid)
  });
  res.json(dec);
});

let cachedLatestEvents = [
  { name: "Bangladesh v West Indies", sportId: 4, id: "710711374" },
  { name: "South Africa v Australia", sportId: 4, id: "795819909" },
  { name: "England v Sri Lanka", sportId: 4, id: "695874475" },
  { name: "Melbourne Stars W v Hobart Hurricanes W", sportId: 4, id: "806604826" },
  { name: "E Rybakina v Putintseva", sportId: 2, id: "630023822" }
];
let lastEventsFetchTime = 0;

router.get("/sports/latest-events", async (req, res) => {
  const now = Date.now();
  if (now - lastEventsFetchTime < 15000 && cachedLatestEvents.length > 0) {
    return res.json({ success: true, data: cachedLatestEvents });
  }

  const { evalInPage } = await import("../services/d247ScraperEngine.js");
  const events = await evalInPage("window.NEW_EVENTS || []");
  if (Array.isArray(events) && events.length > 0) {
    cachedLatestEvents = events;
    lastEventsFetchTime = now;
  }
  res.json({ success: true, data: cachedLatestEvents });
});

router.get("/sports/tv/:gmid", async (req, res) => {
  const { gmid } = req.params;
  const cid = req.query.cid || 0;
  const { evalD247Api } = await import("../services/d247ScraperEngine.js");
  const result = await evalD247Api("gettv", { gmid: Number(gmid), cid: Number(cid), ip: "127.0.0.1" });
  if (result?.data?.url) {
    return res.json({ success: true, url: result.data.url });
  }
  res.json({ success: false, url: null });
});

router.get("/sports/detail-private/:etid/:gmid", async (req, res) => {
  const { etid, gmid } = req.params;
  const { evalD247Api } = await import("../services/d247ScraperEngine.js");
  const result = await evalD247Api(`gamedetailPrivate?etid=${etid}&gmid=${gmid}`, {
    etid: Number(etid),
    gmid: Number(gmid)
  });
  const data = Array.isArray(result?.data) ? result.data[0] : (result?.data || null);
  res.json({ success: true, data });
});

router.get("/sports/odds/:etid/:gmid", async (req, res) => {
  const { etid, gmid } = req.params;

  // 1. Check if full multi-market details already cached in realDataStore
  if (realDataStore.matchDetails && realDataStore.matchDetails[gmid]) {
    const cached = realDataStore.matchDetails[gmid];
    if (Array.isArray(cached) && cached.length > 0) {
      return res.json({ success: true, data: cached });
    }
  }

  // 2. Fast path: check in-memory match odds from highlights and wrap in standard market format
  const existingMatches = realDataStore.sportsMatches[etid] || [];
  const found = existingMatches.find(m => String(m.gmid) === String(gmid));
  if (found && Array.isArray(found.matchOdds) && found.matchOdds.length > 0) {
    const defaultMarket = [{
      mid: `${gmid}_match_odds`,
      mname: "MATCH_ODDS",
      gtype: "match",
      status: found.status === "STARTED" ? "OPEN" : "OPEN",
      max: 1000000,
      min: 100,
      section: found.matchOdds
    }];
    return res.json({ success: true, data: defaultMarket });
  }

  // 3. Strict timeout race to prevent any VPS hang
  try {
    const realOdds = await Promise.race([
      fetchRealMatchOdds(etid, gmid),
      new Promise(resolve => setTimeout(() => resolve(null), 2500))
    ]);
    if (realOdds && realOdds.length > 0) {
      return res.json({ success: true, data: realOdds });
    }
  } catch (e) {}

  const data = await getLiveMatchOdds(etid, gmid);
  if (data?.markets && Array.isArray(data.markets)) {
    const formatted = data.markets.map((m, idx) => ({
      mid: `${gmid}_${idx}`,
      mname: m.mname || "MATCH_ODDS",
      gtype: "match",
      status: "OPEN",
      max: 100000,
      min: 100,
      section: (m.runners || []).map((r, rIdx) => ({
        sid: rIdx + 1,
        nat: r.nat,
        b1: r.b1,
        bs1: r.bs1,
        l1: r.l1,
        ls1: r.ls1,
        gstatus: "ACTIVE"
      }))
    }));
    return res.json({ success: true, data: formatted });
  }
  res.json({ success: true, data: [] });
});

router.get("/sports/detail/:gmid", async (req, res) => {
  const { gmid } = req.params;
  const data = await getMatchDetails(gmid);
  res.json({ success: true, data });
});

// Casino Tables List (100% Real 77+ Live Tables)
router.get("/casino/tables", async (req, res) => {
  if (realDataStore.casinoTables.length > 0) {
    return res.json({ success: true, data: realDataStore.casinoTables, total: realDataStore.casinoTables.length });
  }
  const { fetchRealCasinoTables } = await import("../services/d247ScraperEngine.js");
  const liveTables = await fetchRealCasinoTables();
  if (Array.isArray(liveTables) && liveTables.length > 0) {
    return res.json({ success: true, data: liveTables, total: liveTables.length });
  }
  const gmid = req.query.gmid || null;
  const result = await getCasinoTableList(gmid);
  const data = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
  res.json({ success: true, data, total: data.length });
});

router.get("/casino/categories", async (req, res) => {
  const data = await getAllCasinoList();
  res.json({ success: true, data });
});

// Real Live Casino Table (Countdown timer, round ID, real rates)
router.get("/casino/live/:gtype", async (req, res) => {
  const { gtype } = req.params;
  const { normalizeCasinoGtype } = await import("../services/d247ScraperEngine.js");
  const normalized = normalizeCasinoGtype ? normalizeCasinoGtype(gtype) : gtype;

  // 1. Fast path: If live feed already synchronized into realDataStore
  if (realDataStore.casinoLive[normalized] || realDataStore.casinoLive[gtype]) {
    return res.json({ success: true, data: realDataStore.casinoLive[normalized] || realDataStore.casinoLive[gtype] });
  }

  // 2. Race against 2500ms timeout so VPS NEVER hangs with 504
  try {
    const realLive = await Promise.race([
      fetchRealCasinoTableLive(normalized),
      new Promise(resolve => setTimeout(() => resolve(null), 2500))
    ]);
    if (realLive) {
      return res.json({ success: true, data: realLive });
    }
  } catch (e) {}

  // 3. Instant fallback table generator (Zero delay)
  const data = await getCasinoTableLive(normalized);
  res.json({ success: true, data });
});

// Real Round Winning Results
router.get("/casino/results/:gtype", async (req, res) => {
  const { gtype } = req.params;
  const { normalizeCasinoGtype } = await import("../services/d247ScraperEngine.js");
  const normalized = normalizeCasinoGtype ? normalizeCasinoGtype(gtype) : gtype;

  // 1. Fast path: Check store
  if (realDataStore.casinoResults[normalized] || realDataStore.casinoResults[gtype]) {
    return res.json({ success: true, data: { res: realDataStore.casinoResults[normalized] || realDataStore.casinoResults[gtype] } });
  }

  // 2. Race against 2000ms timeout
  try {
    const realResults = await Promise.race([
      fetchRealCasinoLastResults(normalized),
      new Promise(resolve => setTimeout(() => resolve(null), 2000))
    ]);
    if (realResults) {
      return res.json({ success: true, data: { res: realResults } });
    }
  } catch (e) {}

  res.json({ success: true, data: { res: [] } });
});

// User profile & balance
router.get("/user", async (req, res) => {
  const data = await getUserData();
  res.json({ success: true, data });
});

export default router;

