import express from "express";
import { proxyRequest } from "../services/authService.js";
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

router.get("/list", async (req, res) => {
  const result = await proxyRequest("/api/exchange/sports/sportsList");
  res.status(result.statusCode).json(result);
});

router.get("/all-events", async (req, res) => {
  const result = await proxyRequest(
    "/api/exchange/market/matchodds/allEventsList",
  );

  if (!result || !result.success) {
    return res.status(result?.statusCode || 500).json({
      success: false,
      message: result?.error || "Failed to fetch sports events",
      data: [],
    });
  }

  let allRaw = [];
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

  if (req.query.sportId) {
    allRaw = allRaw.filter(
      (e) => String(e.sportId) === String(req.query.sportId),
    );
  }

  const formattedData = allRaw.map(formatSportEvent);

  res.status(200).json({
    success: true,
    message: "All sports events fetched successfully",
    data: formattedData,
  });
});

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

  const result = await proxyRequest(
    "/api/exchange/markets/getMarketsEventList",
    {
      eventId: String(eventId),
      sportId: String(sportId),
      key: "2",
    },
  );

  if (!result || !result.success) {
    return res.status(result?.statusCode || 500).json({
      data: null,
      meta: {
        message: result?.error || "Failed to fetch markets",
        status_code: result?.statusCode || 500,
        status: false,
      },
    });
  }

  const rawData = result.data?.data || {};
  const meta = result.data?.meta || {
    message: "Market List",
    status_code: 200,
    status: true,
  };

  // Exact schema matching original exchange response:
  // Root keys: 'data' and 'meta'
  return res.status(200).json({
    data: {
      fancyData: rawData.fancyData || [],
      matchOddsData: rawData.matchOddsData || [],
      bookmakersData: rawData.bookmakersData || [],
      sportsbookData: rawData.sportsbookData || [],
      binaryData: rawData.binaryData || [],
      lotteryData: rawData.lotteryData || [],
      isScore: Boolean(rawData.isScore ?? false),
    },
    meta: meta,
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
        statusCommentry: "",
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
  const data = await getLiveScoreData(eventId, sportId);

  const isSoccer = String(sportId) === "1";
  const isTennis = String(sportId) === "2";

  let colHeaders = ["SCORE", "OVS", "RR"];
  if (isSoccer) {
    colHeaders = ["GOAL", "HT", "CRN", "YEL", "RED"];
  } else if (isTennis) {
    colHeaders = ["SETS", "S1", "S2", "S3", "PTS"];
  }

  const t1 = data?.teams?.[0] || { name: data?.team1Name || "Team 1" };
  const t2 = data?.teams?.[1] || { name: data?.team2Name || "Team 2" };

  const getVals = (t) => {
    if (isSoccer) return [t.score || "0", t.htscore || "0", t.corners || "0", t.yellowCard || "0", t.redCard || "0"];
    if (isTennis) return [t.sets || "0", t.set1 || "0", t.set2 || "0", t.set3 || "0", t.pts || "0"];
    return [t.score || "-", t.overs || "-", t.rr || "-"];
  };

  const t1Vals = getVals(t1);
  const t2Vals = getVals(t2);
  const commentary = data?.statusCommentry || "";

  const t1Icon = isSoccer ? "⚽" : isTennis ? "🎾" : t1.isBatting ? "🏏" : "⚾";
  const t2Icon = isSoccer ? "⚽" : isTennis ? "🎾" : t2.isBatting ? "🏏" : "⚾";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
    .scoreboard { padding: 6px 12px; background: #000000; border-bottom: 1px solid #1a1a1a; }
    .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 4px; border-bottom: 1px solid #1a1a1a; margin-bottom: 4px; font-size: 11px; font-weight: 800; color: #94a3b8; }
    .powered { display: flex; align-items: center; gap: 4px; color: #0284c7; }
    .cols { display: flex; gap: 14px; }
    .col-item { width: 44px; text-align: right; }
    .team-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 4px 0; }
    .team-left { display: flex; align-items: flex-start; gap: 8px; flex: 1; min-width: 0; }
    .icon { font-size: 13px; width: 16px; text-align: center; margin-top: 1px; }
    .team-name-box { display: flex; flex-direction: column; min-width: 0; }
    .team-name { font-weight: 800; font-size: 12px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; }
    .batsman { font-size: 10px; color: #94a3b8; font-weight: 600; margin-top: 2px; }
    .stats { display: flex; gap: 14px; align-items: center; }
    .stat-val { width: 44px; text-align: right; font-weight: 700; font-size: 11px; color: #e2e8f0; }
    .stat-val.main { font-weight: 900; font-size: 13px; color: #ffffff; }
    .footer { margin-top: 4px; padding-top: 4px; border-top: 1px solid #1a1a1a; font-size: 11px; color: #94a3b8; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  <div class="scoreboard" id="sb">
    <div class="header">
      <div class="powered"><span>●</span> Powered By Universe Score</div>
      <div class="cols">
        ${colHeaders.map((c) => `<div class="col-item">${c}</div>`).join("")}
      </div>
    </div>
    <div class="team-row">
      <div class="team-left">
        <span class="icon" id="t1Icon">${t1Icon}</span>
        <div class="team-name-box">
          <span class="team-name" id="t1Name">${t1.name}</span>
          ${t1.batsman ? `<span class="batsman" id="t1Batsman">${t1.batsman}</span>` : `<span class="batsman" id="t1Batsman" style="display:none"></span>`}
        </div>
      </div>
      <div class="stats" id="t1Stats">
        <div class="stat-val main">${t1Vals[0]}</div>
        ${t1Vals.slice(1).map((v) => `<div class="stat-val">${v}</div>`).join("")}
      </div>
    </div>
    <div class="team-row">
      <div class="team-left">
        <span class="icon" id="t2Icon">${t2Icon}</span>
        <div class="team-name-box">
          <span class="team-name" id="t2Name">${t2.name}</span>
          ${t2.batsman ? `<span class="batsman" id="t2Batsman">${t2.batsman}</span>` : `<span class="batsman" id="t2Batsman" style="display:none"></span>`}
        </div>
      </div>
      <div class="stats" id="t2Stats">
        <div class="stat-val main">${t2Vals[0]}</div>
        ${t2Vals.slice(1).map((v) => `<div class="stat-val">${v}</div>`).join("")}
      </div>
    </div>
    <div class="footer" id="commentary">${commentary || "Match Live in Play"}</div>
  </div>
  <script>
    const isSoccer = ${isSoccer};
    const isTennis = ${isTennis};
    function getVals(t) {
      if (isSoccer) return [t.score || '0', t.htscore || '0', t.corners || '0', t.yellowCard || '0', t.redCard || '0'];
      if (isTennis) return [t.sets || '0', t.set1 || '0', t.set2 || '0', t.set3 || '0', t.pts || '0'];
      return [t.score || '-', t.overs || '-', t.rr || '-'];
    }
    setInterval(async () => {
      try {
        const res = await fetch('/api/sports/score/${eventId}?sportId=${sportId}');
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const t1 = d.teams?.[0] || {};
          const t2 = d.teams?.[1] || {};
          document.getElementById('t1Name').textContent = t1.name || d.team1Name;
          document.getElementById('t2Name').textContent = t2.name || d.team2Name;
          if (t1.batsman) {
            const el = document.getElementById('t1Batsman');
            el.textContent = t1.batsman;
            el.style.display = 'block';
          }
          if (t2.batsman) {
            const el = document.getElementById('t2Batsman');
            el.textContent = t2.batsman;
            el.style.display = 'block';
          }
          if (!isSoccer && !isTennis) {
            document.getElementById('t1Icon').textContent = t1.isBatting ? '🏏' : '⚾';
            document.getElementById('t2Icon').textContent = t2.isBatting ? '🏏' : '⚾';
          }
          const v1 = getVals(t1);
          const v2 = getVals(t2);
          document.getElementById('t1Stats').innerHTML = '<div class="stat-val main">' + v1[0] + '</div>' + v1.slice(1).map(v => '<div class="stat-val">' + v + '</div>').join('');
          document.getElementById('t2Stats').innerHTML = '<div class="stat-val main">' + v2[0] + '</div>' + v2.slice(1).map(v => '<div class="stat-val">' + v + '</div>').join('');
          if (d.statusCommentry) document.getElementById('commentary').textContent = d.statusCommentry;
        }
      } catch (e) {}
    }, 2000);
  </script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
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

export default router;

