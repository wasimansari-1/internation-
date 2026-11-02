import express from "express";
import { proxyRequest } from "../services/authService.js";
import {
  getLiveScoreData,
  queryFirestoreForEvent,
} from "../services/sportsService.js";

const router = express.Router();

router.get("/list", async (req, res) => {
  const result = await proxyRequest("/api/exchange/sports/sportsList");
  res.status(result.statusCode).json(result);
});

router.get("/all-events", async (req, res) => {
  const result = await proxyRequest(
    "/api/exchange/market/matchodds/allEventsList",
  );
  res.status(result.statusCode).json(result);
});

router.post("/markets-event-list", async (req, res) => {
  const { eventId, sportId } = req.body;
  const result = await proxyRequest(
    "/api/exchange/markets/getMarketsEventList",
    {
      eventId,
      sportId: sportId || "4",
      key: "2",
    },
  );
  res.status(result.statusCode).json(result);
});

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
    return res.status(404).json({ success: false, error: "Score data not found" });
  }
  return res.json({ success: true, data });
});

router.get("/scoreboard-frame/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { sportId = "4" } = req.query;
  const data = await getLiveScoreData(eventId, sportId);

  const isSoccer = String(sportId) === "1";
  const isTennis = String(sportId) === "2";

  let colHeaders = ["SCORE", "OVS", "RR", "4S", "6S"];
  let icon = "🏏";
  if (isSoccer) {
    colHeaders = ["GOAL", "HT", "CRN", "YEL", "RED"];
    icon = "⚽";
  } else if (isTennis) {
    colHeaders = ["SETS", "S1", "S2", "S3", "PTS"];
    icon = "🎾";
  }

  const t1 = data?.teams?.[0] || { name: data?.team1Name || "Team 1" };
  const t2 = data?.teams?.[1] || { name: data?.team2Name || "Team 2" };

  const getVals = (t) => {
    if (isSoccer) return [t.score || "0", t.htscore || "0", t.corners || "0", t.yellowCard || "0", t.redCard || "0"];
    if (isTennis) return [t.sets || "0", t.set1 || "0", t.set2 || "0", t.set3 || "0", t.pts || "0"];
    return [t.score || "-", t.overs || "-", t.rr || "-", t.fours || "-", t.sixes || "-"];
  };

  const t1Vals = getVals(t1);
  const t2Vals = getVals(t2);
  const commentary = data?.statusCommentry || "";

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
    .col-item { width: 34px; text-align: right; }
    .team-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; }
    .team-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .icon { font-size: 12px; width: 14px; text-align: center; }
    .team-name { font-weight: 800; font-size: 12px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; }
    .stats { display: flex; gap: 14px; }
    .stat-val { width: 34px; text-align: right; font-weight: 700; font-size: 11px; color: #e2e8f0; }
    .stat-val.main { font-weight: 900; font-size: 12px; color: #ffffff; }
    .footer { margin-top: 6px; padding-top: 4px; border-top: 1px solid #1a1a1a; font-size: 11px; color: #94a3b8; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
        <span class="icon">${icon}</span>
        <span class="team-name" id="t1Name">${t1.name}</span>
      </div>
      <div class="stats" id="t1Stats">
        <div class="stat-val main">${t1Vals[0]}</div>
        ${t1Vals.slice(1).map((v) => `<div class="stat-val">${v}</div>`).join("")}
      </div>
    </div>
    <div class="team-row">
      <div class="team-left">
        <span class="icon">${icon}</span>
        <span class="team-name" id="t2Name">${t2.name}</span>
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
      return [t.score || '-', t.overs || '-', t.rr || '-', t.fours || '-', t.sixes || '-'];
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
          const v1 = getVals(t1);
          const v2 = getVals(t2);
          document.getElementById('t1Stats').innerHTML = '<div class="stat-val main">' + v1[0] + '</div>' + v1.slice(1).map(v => '<div class="stat-val">' + v + '</div>').join('');
          document.getElementById('t2Stats').innerHTML = '<div class="stat-val main">' + v2[0] + '</div>' + v2.slice(1).map(v => '<div class="stat-val">' + v + '</div>').join('');
          if (d.statusCommentry) document.getElementById('commentary').textContent = d.statusCommentry;
        }
      } catch (e) {}
    }, 2500);
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
    const realOdds = await queryFirestoreForEvent(eventId, sportId);
    return res.json({ success: true, data: realOdds });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

