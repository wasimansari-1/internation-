import express from "express";
import { proxyRequest } from "../services/authService.js";
import { telemetry } from "../services/telemetryService.js";
import {
  getLiveScoreData,
  getLiveRatesForEvent,
  queryFirestoreForEvent,
} from "../services/sportsService.js";

const router = express.Router();

function formatSportEvent(e) {
  const odds = e.oddsData || {};
  return {
    _id: String(e._id || e.exEventId || ""),
    isCasinoGame: Boolean(e.isCasinoGame ?? false),
    isVirtual: Boolean(e.isVirtual ?? false),
    marketType: e.marketType || "MATCH_ODDS",
    popular: Boolean(e.popular ?? false),
    quickLink: Boolean(e.quickLink ?? false),
    runnersData: e.runnersData || {},
    betDelay: Number(odds.betDelay ?? e.betDelay ?? 0),
    preBet: Boolean(odds.preBet ?? e.preBet ?? false),
    crossMatching: Boolean(odds.crossMatching ?? e.crossMatching ?? false),
    totalMatched: Number(odds.totalMatched ?? e.totalMatched ?? 0),
    tournamentId: String(e.tournamentId || ""),
    isBookmakers: Boolean(e.isBookmakers ?? false),
    isFancy: Boolean(e.isFancy ?? false),
    isSportsbook: Boolean(e.isSportsbook ?? false),
    isStreaming: Boolean(e.isStreaming ?? false),
    tv: Boolean(e.tv ?? false),
    productId: e.productId || `${e.sportId || "1"}.${e.exEventId || e._id}`,
    sportId: String(e.sportId || ""),
    sportName: e.sportName || "",
    exEventId: String(e.exEventId || e._id || ""),
    eventName: e.eventName || "",
    marketId: String(e.marketId || ""),
    marketName: e.marketName || "Match Odds",
    eventTime: e.eventTime || "",
    tournamentName: e.tournamentName || "",
    inPlay: Boolean(odds.inPlay ?? e.inPlay ?? false),
    status: odds.status || e.status || "OPEN",
    runners: (odds.runners || e.runners || []).map((r) => ({
      selectionId: String(r.selectionId ?? ""),
      status: r.status || "ACTIVE",
      handicap: Number(r.handicap ?? 0),
      backPrice: Number(r.backPrice ?? r.price?.back?.[0]?.price ?? 0),
      backSize: Number(r.backSize ?? r.price?.back?.[0]?.size ?? 0),
      layPrice: Number(r.layPrice ?? r.price?.lay?.[0]?.price ?? 0),
      laySize: Number(r.laySize ?? r.price?.lay?.[0]?.size ?? 0),
    })),
    isScore: Boolean(e.isScore ?? false),
  };
}

const SPORTS_CATALOG = [
  { sportId: "1", name: "Soccer" },
  { sportId: "2", name: "Tennis" },
  { sportId: "4", name: "Cricket" },
  { sportId: "7", name: "Horse Racing" },
  { sportId: "4339", name: "Greyhound Racing" },
  { sportId: "7522", name: "Basketball" },
];

function handleSportsCatalog(req, res) {
  res.status(200).json({
    success: true,
    message: "Sports catalog fetched successfully",
    data: SPORTS_CATALOG,
    timestamp: new Date().toISOString(),
  });
}

router.get("/", handleSportsCatalog);
router.get("/list", handleSportsCatalog);

// Persistent memory cache for sports event catalog to prevent empty responses during upstream blips
let cachedAllEvents = [];

async function handleEvents(req, res) {
  const result = await telemetry.deduplicateOrFetch("sports_all_events", 2500, async () => {
    return proxyRequest("/api/exchange/market/matchodds/allEventsList");
  });

  let allRaw = [];
  if (result && result.success) {
    const rawData =
      result.data?.data?.data || result.data?.data || result.data || [];
    if (Array.isArray(rawData)) {
      allRaw = rawData;
    } else if (typeof rawData === "object" && rawData !== null) {
      for (const key of Object.keys(rawData)) {
        if (Array.isArray(rawData[key])) {
          allRaw.push(...rawData[key]);
        }
      }
    }
  }

  // Update persistent cache if valid events arrived; otherwise fallback to last known good events
  if (allRaw.length > 0) {
    cachedAllEvents = allRaw;
  } else if (cachedAllEvents.length > 0) {
    allRaw = cachedAllEvents;
  }

  if (allRaw.length === 0 && (!result || !result.success)) {
    return res.status(result?.statusCode || 500).json({
      success: false,
      message: result?.error || "Failed to fetch sports events",
      data: [],
      timestamp: new Date().toISOString(),
    });
  }

  const sportId = req.params.sportId || req.query.sportId;
  if (sportId) {
    const filtered = allRaw.filter((e) => String(e.sportId) === String(sportId));
    const formattedData = filtered.map(formatSportEvent);
    return res.status(200).json({
      success: true,
      message: "Sport events fetched successfully",
      data: formattedData,
      timestamp: new Date().toISOString(),
    });
  }

  const formattedData = allRaw.map(formatSportEvent);
  return res.status(200).json({
    success: true,
    message: "All sports events fetched successfully",
    data: formattedData,
    timestamp: new Date().toISOString(),
  });
}

router.get("/events", handleEvents);
router.get("/all-events", handleEvents);
router.get("/:sportId/events", handleEvents);

function enrichMarketsWithNews(rawMarkets = [], liveRatesMarkets = [], fallbackNews = "") {
  const byId = new Map();
  const byName = new Map();
  for (const lm of liveRatesMarkets) {
    if (!lm?.news) continue;
    if (lm.marketId) byId.set(String(lm.marketId), lm.news);
    if (lm.marketName) byName.set(String(lm.marketName).toLowerCase(), lm.news);
  }
  return (Array.isArray(rawMarkets) ? rawMarkets : []).map((m) => {
    const id = String(m?.exMarketId || m?.marketId || "");
    const nameKey = String(m?.marketName || m?.sessionName || "").toLowerCase();
    const news =
      String(m?.news ?? m?.remark ?? m?.message ?? m?.oddsData?.news ?? "").trim() ||
      byId.get(id) ||
      byName.get(nameKey) ||
      fallbackNews ||
      "";
    return { ...m, news };
  });
}

function collectTickerNews(...marketArrays) {
  const seen = new Set();
  for (const arr of marketArrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const txt = String(item?.news || "").trim();
      if (txt) seen.add(txt);
    }
  }
  return Array.from(seen).join("   ★   ");
}

async function getEventMarketsHandler(req, res) {
  const sportId = String(
    req.params.sportId || req.body?.sportId || req.query?.sportId || "4",
  );
  const eventId = String(
    req.params.eventId || req.body?.eventId || req.query?.eventId || "",
  );

  if (!eventId) {
    return res.status(400).json({
      success: false,
      message: "eventId is required",
      data: null,
      timestamp: new Date().toISOString(),
    });
  }

  const [result, liveRates] = await Promise.all([
    proxyRequest("/api/exchange/markets/getMarketsEventList", {
      eventId: String(eventId),
      sportId: String(sportId),
      key: "2",
    }),
    getLiveRatesForEvent(eventId, sportId).catch(() => null),
  ]);

  if (!result || !result.success) {
    return res.status(result?.statusCode || 500).json({
      success: false,
      message: result?.error || "Failed to fetch markets",
      data: null,
      timestamp: new Date().toISOString(),
    });
  }

  const rawData = result.data?.data || {};
  const meta = result.data?.meta || {
    message: "Market List",
    status_code: 200,
    status: true,
  };

  const moNewsFallback = liveRates?.matchOdds?.news || "";
  const bmNewsFallback = liveRates?.bookmaker?.news || "";

  const fancyData = enrichMarketsWithNews(rawData.fancyData, liveRates?.fancy || []);
  const matchOddsData = enrichMarketsWithNews(rawData.matchOddsData, liveRates?.matchOddsList || [], moNewsFallback);
  const bookmakersData = enrichMarketsWithNews(rawData.bookmakersData, liveRates?.bookmakerList || [], bmNewsFallback);
  const sportsbookData = enrichMarketsWithNews(rawData.sportsbookData, liveRates?.sportsbook || []);
  const binaryData = enrichMarketsWithNews(rawData.binaryData, []);
  const lotteryData = enrichMarketsWithNews(rawData.lotteryData, []);

  const combinedNews =
    collectTickerNews(matchOddsData, bookmakersData, fancyData, sportsbookData, binaryData, lotteryData) ||
    liveRates?.news ||
    "";

  return res.status(200).json({
    success: true,
    message: "Markets fetched successfully",
    data: {
      data: {
        news: combinedNews,
        fancyData,
        matchOddsData,
        bookmakersData,
        sportsbookData,
        binaryData,
        lotteryData,
        isScore: Boolean(rawData.isScore ?? false),
      },
      meta: meta,
    },
    timestamp: new Date().toISOString(),
  });
}

router.post("/markets-event-list", getEventMarketsHandler);
router.get("/:sportId/:eventId/markets", getEventMarketsHandler);
router.get("/markets/:eventId", getEventMarketsHandler);
router.get("/:eventId/markets", getEventMarketsHandler);

router.post("/fancy-markets", async (req, res) => {
  const { eventId } = req.body;
  const result = await proxyRequest("/api/exchange/markets/fancyMarketList", {
    eventId,
  });
  res.status(result.statusCode).json(result);
});

router.post("/market-results", async (req, res) => {
  const { eventId } = req.body;
  const result = await proxyRequest(
    "/api/exchange/results/getMarketEventResults",
    { eventId: String(eventId) },
  );
  res.status(result.statusCode).json(result);
});

router.get("/score/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { sportId = "4" } = req.query;
  const data = await getLiveScoreData(eventId, sportId);
  if (!data) {
    return res.json({
      success: true,
      data: {
        eventId,
        format: sportId === "1" ? "soccer" : sportId === "2" ? "tennis" : "t20",
        isTestMatch: false,
        statusCommentry: "Match In Play",
        last6balls: [],
        team1Name: "Team 1",
        team2Name: "Team 2",
        teams: [],
      },
    });
  }
  return res.json({ success: true, data });
});

router.get("/scoreboard-frame/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { sportId = "4" } = req.query;
  const initialData = await getLiveScoreData(eventId, sportId);

  const initialJson = JSON.stringify(initialData || {
    eventId,
    format: sportId === "1" ? "soccer" : sportId === "2" ? "tennis" : "t20",
    isTestMatch: false,
    statusCommentry: "Connecting to live match feed...",
    last6balls: [],
    team1Name: "Team 1",
    team2Name: "Team 2",
    teams: [
      { name: "Team 1", score: "-", overs: "-", rr: "-", fours: "-", sixes: "-", wides: "-", sets: "0", set1: "0", set2: "0", set3: "0", pts: "0", htscore: "0", corners: "0", yellowCard: "0", redCard: "0" },
      { name: "Team 2", score: "-", overs: "-", rr: "-", fours: "-", sixes: "-", wides: "-", sets: "0", set1: "0", set2: "0", set3: "0", pts: "0", htscore: "0", corners: "0", yellowCard: "0", redCard: "0" }
    ]
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Live Scorecard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f172a;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      overflow: hidden;
      user-select: none;
    }
    .mc-sc {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 7px 12px;
      background: linear-gradient(180deg, #131b2e 0%, #0b1120 100%);
      border-bottom: 2px solid #1e293b;
    }
    /* Top Bar */
    .mc-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 5px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
    }
    .mc-brand {
      display: flex;
      align-items: center;
      gap: 6px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-size: 10px;
      color: #38bdf8;
    }
    .mc-pulse {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 8px #22c55e;
      animation: pulseAnim 1.4s infinite;
      display: inline-block;
    }
    @keyframes pulseAnim {
      0% { transform: scale(0.9); opacity: 0.8; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.8; }
    }
    .mc-headers {
      display: flex;
      gap: 10px;
    }
    .mc-col-hd {
      min-width: 42px;
      text-align: right;
      font-size: 10.5px;
      font-weight: 800;
      color: #94a3b8;
      letter-spacing: 0.5px;
    }
    /* Team Rows */
    .mc-body {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin: 4px 0;
    }
    .mc-team-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 28px;
    }
    .mc-team-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
      padding-right: 8px;
    }
    .mc-role-badge {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
    }
    .mc-role-badge.bat {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
    }
    .mc-role-badge.ball {
      background: rgba(148, 163, 184, 0.1);
      border: 1px solid rgba(148, 163, 184, 0.2);
      color: #94a3b8;
    }
    .mc-role-badge.server {
      background: rgba(34, 197, 94, 0.2);
      border: 1px solid rgba(34, 197, 94, 0.5);
      color: #4ade80;
      box-shadow: 0 0 6px rgba(34, 197, 94, 0.3);
    }
    .mc-role-badge.soccer {
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #38bdf8;
    }
    .mc-name-box {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .mc-team-name {
      font-size: 12.5px;
      font-weight: 800;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .mc-subtext {
      font-size: 9.5px;
      color: #94a3b8;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1px;
    }
    .mc-subtext.highlight {
      color: #facc15;
    }
    /* Stats Row Right */
    .mc-stats {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-shrink: 0;
    }
    .mc-stat {
      min-width: 42px;
      text-align: right;
      font-size: 11px;
      font-weight: 700;
      color: #cbd5e1;
    }
    .mc-stat.main {
      font-size: 13.5px;
      font-weight: 900;
      color: #ffffff;
      min-width: 48px;
    }
    .mc-stat.pts {
      font-size: 13px;
      font-weight: 900;
      color: #4ade80;
      background: rgba(34, 197, 94, 0.12);
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .mc-stat.active-ings {
      color: #fbbf24;
      font-weight: 900;
      background: rgba(245, 158, 11, 0.15);
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    /* Bottom Bar */
    .mc-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 5px;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 10.5px;
      gap: 10px;
      min-height: 24px;
    }
    .mc-commentary {
      color: #94a3b8;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }
    .mc-balls {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .mc-ball-lbl {
      font-size: 9px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      margin-right: 2px;
    }
    .mc-ball {
      width: 17px;
      height: 17px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 800;
      color: #ffffff;
      background: #1e293b;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .mc-ball.dot {
      background: #0f172a;
      color: #64748b;
      border-color: #334155;
    }
    .mc-ball.four {
      background: #2563eb;
      border-color: #3b82f6;
    }
    .mc-ball.six {
      background: #7c3aed;
      border-color: #8b5cf6;
    }
    .mc-ball.wicket {
      background: #dc2626;
      border-color: #ef4444;
      animation: pulseWicket 1.5s infinite;
    }
    .mc-ball.extra {
      background: #d97706;
      border-color: #f59e0b;
    }
    @keyframes pulseWicket {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    .mc-btn-refresh {
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      padding: 0 4px;
      transition: color 0.15s;
    }
    .mc-btn-refresh:hover { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="mc-sc" id="scoreboardContainer">
    <!-- Top Header -->
    <div class="mc-top">
      <div class="mc-brand">
        <span class="mc-pulse"></span>
        <span>Powered By Universe Score</span>
      </div>
      <div class="mc-headers" id="colHeaders">
        <!-- Rendered by JS -->
      </div>
    </div>

    <!-- Team Rows -->
    <div class="mc-body">
      <!-- Team 1 -->
      <div class="mc-team-row" id="teamRow1">
        <div class="mc-team-left">
          <div class="mc-role-badge ball" id="t1Badge">⚾</div>
          <div class="mc-name-box">
            <span class="mc-team-name" id="t1Name">Team 1</span>
            <span class="mc-subtext" id="t1Sub"></span>
          </div>
        </div>
        <div class="mc-stats" id="t1Stats">
          <!-- Rendered by JS -->
        </div>
      </div>

      <!-- Team 2 -->
      <div class="mc-team-row" id="teamRow2">
        <div class="mc-team-left">
          <div class="mc-role-badge bat" id="t2Badge">🏏</div>
          <div class="mc-name-box">
            <span class="mc-team-name" id="t2Name">Team 2</span>
            <span class="mc-subtext" id="t2Sub"></span>
          </div>
        </div>
        <div class="mc-stats" id="t2Stats">
          <!-- Rendered by JS -->
        </div>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div class="mc-bottom">
      <div class="mc-commentary" id="commentaryText">Match Live in Play</div>
      <div class="mc-balls" id="ballsTimeline" style="display:none;">
        <span class="mc-ball-lbl">Last Balls:</span>
        <div style="display:flex; gap:3px;" id="ballsList"></div>
      </div>
      <button class="mc-btn-refresh" id="btnRefresh" title="Force Refresh">🔄</button>
    </div>
  </div>

  <script>
    const eventId = "${eventId}";
    const sportId = "${sportId}";
    let lastRenderedData = ${initialJson};

    function renderScorecard(data) {
      if (!data) return;
      lastRenderedData = data;

      const format = data.format || (sportId === "1" ? "soccer" : sportId === "2" ? "tennis" : data.isTestMatch ? "test" : "t20");
      const isSoccer = format === "soccer";
      const isTennis = format === "tennis";
      const isTest = format === "test" || Boolean(data.isTestMatch);

      const hdEl = document.getElementById("colHeaders");
      let headersHtml = "";

      if (isTest) {
        headersHtml = '<div class="mc-col-hd" style="min-width:68px;">1st INN</div><div class="mc-col-hd" style="min-width:68px;">2nd INN</div>';
      } else if (isSoccer) {
        headersHtml = '<div class="mc-col-hd">GOAL</div><div class="mc-col-hd">HT</div><div class="mc-col-hd">CRN</div><div class="mc-col-hd">🟨</div><div class="mc-col-hd">🟥</div>';
      } else if (isTennis) {
        const hasSet4 = Boolean(data.teams?.[0]?.set4 || data.teams?.[1]?.set4);
        const hasSet5 = Boolean(data.teams?.[0]?.set5 || data.teams?.[1]?.set5);
        headersHtml = '<div class="mc-col-hd">SETS</div><div class="mc-col-hd">1</div><div class="mc-col-hd">2</div><div class="mc-col-hd">3</div>';
        if (hasSet4) headersHtml += '<div class="mc-col-hd">4</div>';
        if (hasSet5) headersHtml += '<div class="mc-col-hd">5</div>';
        headersHtml += '<div class="mc-col-hd">PTS</div>';
      } else {
        // T20 / 50-over ODI Cricket
        headersHtml = '<div class="mc-col-hd">SCORE</div><div class="mc-col-hd">OVS</div><div class="mc-col-hd">RR</div><div class="mc-col-hd">4s</div><div class="mc-col-hd">6s</div>';
      }
      hdEl.innerHTML = headersHtml;

      const t1 = data.teams?.[0] || { name: data.team1Name || "Team 1" };
      const t2 = data.teams?.[1] || { name: data.team2Name || "Team 2" };

      // Update Names
      document.getElementById("t1Name").textContent = t1.name || data.team1Name || "Team 1";
      document.getElementById("t2Name").textContent = t2.name || data.team2Name || "Team 2";

      // Badges
      const b1 = document.getElementById("t1Badge");
      const b2 = document.getElementById("t2Badge");
      if (isSoccer) {
        b1.className = "mc-role-badge soccer"; b1.textContent = "⚽";
        b2.className = "mc-role-badge soccer"; b2.textContent = "⚽";
      } else if (isTennis) {
        b1.className = t1.isServing ? "mc-role-badge server" : "mc-role-badge ball";
        b1.textContent = t1.isServing ? "🎾" : "·";
        b2.className = t2.isServing ? "mc-role-badge server" : "mc-role-badge ball";
        b2.textContent = t2.isServing ? "🎾" : "·";
      } else {
        b1.className = t1.isBatting ? "mc-role-badge bat" : "mc-role-badge ball";
        b1.textContent = t1.isBatting ? "🏏" : "⚾";
        b2.className = t2.isBatting ? "mc-role-badge bat" : "mc-role-badge ball";
        b2.textContent = t2.isBatting ? "🏏" : "⚾";
      }

      // Subtexts (Batsman / Goals info)
      const sub1 = document.getElementById("t1Sub");
      const sub2 = document.getElementById("t2Sub");
      if (isSoccer) {
        sub1.textContent = t1.goalInfo ? "⚽ " + t1.goalInfo : "";
        sub2.textContent = t2.goalInfo ? "⚽ " + t2.goalInfo : "";
      } else if (!isTennis) {
        sub1.textContent = t1.batsman || "";
        sub1.className = t1.isBatting ? "mc-subtext highlight" : "mc-subtext";
        sub2.textContent = t2.batsman || "";
        sub2.className = t2.isBatting ? "mc-subtext highlight" : "mc-subtext";
      } else {
        sub1.textContent = "";
        sub2.textContent = "";
      }

      // Render Stats Columns for each team
      function renderStats(t) {
        if (isTest) {
          const f1 = t.firstIngs || "-";
          const s1 = t.secondIngs || "-";
          const isActive1 = t.isBatting && !t.secondIngs;
          const isActive2 = t.isBatting && Boolean(t.secondIngs);
          return '<div class="mc-stat main ' + (isActive1 ? 'active-ings' : '') + '" style="min-width:68px;">' + f1 + '</div>' +
                 '<div class="mc-stat main ' + (isActive2 ? 'active-ings' : '') + '" style="min-width:68px;">' + s1 + '</div>';
        }
        if (isSoccer) {
          return '<div class="mc-stat main">' + (t.score || "0") + '</div>' +
                 '<div class="mc-stat">' + (t.htscore || "0") + '</div>' +
                 '<div class="mc-stat">' + (t.corners || "0") + '</div>' +
                 '<div class="mc-stat" style="color:#facc15;">' + (t.yellowCard || "0") + '</div>' +
                 '<div class="mc-stat" style="color:#ef4444;">' + (t.redCard || "0") + '</div>';
        }
        if (isTennis) {
          const hasSet4 = Boolean(data.teams?.[0]?.set4 || data.teams?.[1]?.set4);
          const hasSet5 = Boolean(data.teams?.[0]?.set5 || data.teams?.[1]?.set5);
          let str = '<div class="mc-stat main">' + (t.sets || "0") + '</div>' +
                    '<div class="mc-stat">' + (t.set1 || "0") + '</div>' +
                    '<div class="mc-stat">' + (t.set2 || "0") + '</div>' +
                    '<div class="mc-stat">' + (t.set3 || "0") + '</div>';
          if (hasSet4) str += '<div class="mc-stat">' + (t.set4 || "-") + '</div>';
          if (hasSet5) str += '<div class="mc-stat">' + (t.set5 || "-") + '</div>';
          str += '<div class="mc-stat pts">' + (t.pts || "0") + '</div>';
          return str;
        }
        // Cricket T20 / ODI
        return '<div class="mc-stat main">' + (t.score || "-") + '</div>' +
               '<div class="mc-stat">' + (t.overs || "-") + '</div>' +
               '<div class="mc-stat">' + (t.rr || "-") + '</div>' +
               '<div class="mc-stat">' + (t.fours || "-") + '</div>' +
               '<div class="mc-stat">' + (t.sixes || "-") + '</div>';
      }

      document.getElementById("t1Stats").innerHTML = renderStats(t1);
      document.getElementById("t2Stats").innerHTML = renderStats(t2);

      // Commentary
      const cText = document.getElementById("commentaryText");
      if (data.statusCommentry) {
        cText.textContent = data.statusCommentry;
      }

      // Last 6 Balls Timeline
      const ballsEl = document.getElementById("ballsTimeline");
      const ballsList = document.getElementById("ballsList");
      if (Array.isArray(data.last6balls) && data.last6balls.length > 0) {
        ballsEl.style.display = "flex";
        ballsList.innerHTML = data.last6balls.map(b => {
          const ball = String(b).trim();
          let cls = "mc-ball";
          if (ball === "•" || ball === "0" || ball === ".") cls += " dot";
          else if (ball === "4") cls += " four";
          else if (ball === "6") cls += " six";
          else if (ball.toUpperCase().includes("W") && !ball.toUpperCase().includes("WD")) cls += " wicket";
          else if (ball.toUpperCase().includes("WD") || ball.toUpperCase().includes("NB")) cls += " extra";
          return '<span class="' + cls + '">' + ball + '</span>';
        }).join("");
      } else {
        ballsEl.style.display = "none";
      }
    }

    renderScorecard(lastRenderedData);

    // Fast 1000ms Anti-Stuck Polling Engine with AbortController
    let inFlight = false;
    async function fetchLatestScore() {
      if (inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);

      try {
        const res = await fetch('/api/sports/score/' + eventId + '?sportId=' + sportId + '&t=' + Date.now(), {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.data) {
            renderScorecard(json.data);
          }
        }
      } catch (err) {
        // Silent retry on next interval - never freeze DOM!
      } finally {
        inFlight = false;
      }
    }

    // 1000ms live interval
    const intervalTimer = setInterval(fetchLatestScore, 1000);

    // Manual Refresh
    document.getElementById("btnRefresh").addEventListener("click", () => {
      fetchLatestScore();
    });
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(html);
});

router.get("/live-rates/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { sportId = "4" } = req.query;
  try {
    const realOdds = await getLiveRatesForEvent(eventId, sportId);
    return res.json({ success: true, data: realOdds });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Global exchange ticker news
router.get("/news", async (req, res) => {
  try {
    const result = await proxyRequest("/api/exchange/news/exchangeNews", {});
    const newsText = typeof result?.data?.data === "string" ? result.data.data : "";
    return res.json({
      success: true,
      data: { news: newsText },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.json({ success: true, data: { news: "" }, timestamp: new Date().toISOString() });
  }
});

// Match-level & per-market news across Match Odds, Bookmaker, Fancy, and Sportsbook
router.get("/news/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { sportId = "4" } = req.query;
  try {
    const [liveRates, marketsRes] = await Promise.all([
      getLiveRatesForEvent(eventId, sportId).catch(() => null),
      proxyRequest("/api/exchange/markets/getMarketsEventList", {
        eventId: String(eventId),
        sportId: String(sportId),
        key: "2",
      }).catch(() => null),
    ]);

    const raw = marketsRes?.data?.data || {};
    const toEntries = (list = []) =>
      list
        .filter((m) => String(m?.news || m?.remark || m?.message || "").trim())
        .map((m) => ({
          marketId: String(m.marketId || m.exMarketId || ""),
          marketName: m.marketName || m.sessionName || "",
          news: String(m.news || m.remark || m.message || "").trim(),
        }));

    const matchOdds = toEntries(
      enrichMarketsWithNews(raw.matchOddsData, liveRates?.matchOddsList || [], liveRates?.matchOdds?.news || "")
    );
    const bookmakers = toEntries(
      enrichMarketsWithNews(raw.bookmakersData, liveRates?.bookmakerList || [], liveRates?.bookmaker?.news || "")
    );
    const fancy = toEntries(
      enrichMarketsWithNews(raw.fancyData, liveRates?.fancy || [])
    );
    const sportsbook = toEntries(
      enrichMarketsWithNews(raw.sportsbookData, liveRates?.sportsbook || [])
    );
    const binary = toEntries(raw.binaryData || []);
    const lottery = toEntries(raw.lotteryData || []);

    const finalMo = matchOdds.length > 0 ? matchOdds : toEntries(liveRates?.matchOddsList || []);
    const finalBm = bookmakers.length > 0 ? bookmakers : toEntries(liveRates?.bookmakerList || []);
    const finalFancy = fancy.length > 0 ? fancy : toEntries(liveRates?.fancy || []);
    const finalSb = sportsbook.length > 0 ? sportsbook : toEntries(liveRates?.sportsbook || []);

    const news =
      collectTickerNews(finalMo, finalBm, finalFancy, finalSb, binary, lottery) ||
      liveRates?.news ||
      "";

    return res.json({
      success: true,
      data: {
        eventId: String(eventId),
        sportId: String(sportId),
        news,
        markets: {
          matchOdds: finalMo,
          bookmakers: finalBm,
          fancy: finalFancy,
          sportsbook: finalSb,
          binary,
          lottery,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

