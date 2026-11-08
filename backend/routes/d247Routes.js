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

router.get("/debug/images", async (req, res) => {
  const result = await getDebugPageImages();
  res.json(result);
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
  const realOdds = await fetchRealMatchOdds(etid, gmid);
  if (realOdds) {
    return res.json({ success: true, data: realOdds });
  }
  const data = await getLiveMatchOdds(etid, gmid);
  res.json({ success: true, data });
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
  const realLive = await fetchRealCasinoTableLive(gtype);
  if (realLive) {
    return res.json({ success: true, data: realLive });
  }
  const data = await getCasinoTableLive(gtype);
  res.json({ success: true, data });
});

// Real Round Winning Results
router.get("/casino/results/:gtype", async (req, res) => {
  const { gtype } = req.params;
  const realResults = await fetchRealCasinoLastResults(gtype);
  res.json({ success: true, data: { res: realResults || [] } });
});

// User profile & balance
router.get("/user", async (req, res) => {
  const data = await getUserData();
  res.json({ success: true, data });
});

export default router;

