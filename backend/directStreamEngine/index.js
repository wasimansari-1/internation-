import express from "express";
import {
  getDirectCasinoStreamUrl,
  CASINO_GAME_MAP
} from "./casinoDirectStream.js";
import { getDirectSportsStreamUrl } from "./sportsDirectStream.js";
import {
  renderCasinoPlayerHtml,
  renderSportsPlayerHtml,
  renderRadarHtml
} from "./streamProxyServer.js";

const router = express.Router();

/**
 * Health check & Engine status
 */
router.get("/health", (req, res) => {
  res.json({
    status: "online",
    engine: "Direct Origin Stream Engine",
    version: "1.0.0",
    upstreamStudio: "Universe / Startexch99 / Nice444 / CBTFexchange",
    competitorDependent: false,
    timestamp: new Date().toISOString()
  });
});

/**
 * Supported Casino Games Catalog
 */
router.get("/catalog", (req, res) => {
  res.json({
    success: true,
    games: Object.keys(CASINO_GAME_MAP).map((alias) => ({
      alias,
      providerStreamId: CASINO_GAME_MAP[alias],
      streamPlayerUrl: `/api/direct-stream/casino/player/${alias}`,
      streamLinkUrl: `/api/direct-stream/casino/link/${alias}`
    }))
  });
});

/**
 * Live Interactive Demo Page (To test & view iframe streams in browser)
 * GET /api/direct-stream/demo
 */
router.get("/demo", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Direct Origin Live Stream Test Player</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 20px; }
        .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid #1e293b; margin-bottom: 20px; }
        .title { font-size: 20px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
        .badge { background: #059669; color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 9999px; font-weight: 600; text-transform: uppercase; }
        .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .tab-btn { background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .tab-btn:hover { background: #334155; color: #fff; }
        .tab-btn.active { background: #0284c7; color: #fff; border-color: #38bdf8; }
        .player-box { position: relative; width: 100%; max-width: 900px; height: 506px; background: #000; border-radius: 10px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); margin: 0 auto; }
        iframe { width: 100%; height: 100%; border: 0; }
        .info-bar { max-width: 900px; margin: 12px auto 0; font-size: 12px; color: #64748b; display: flex; justify-content: space-between; }
        .source-tag { color: #10b981; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">
          <span>⚡ Direct Origin Stream Player</span>
          <span class="badge">100% Live Studio</span>
        </div>
        <div style="font-size: 12px; color: #64748b;">No Competitor Dependency</div>
      </div>

      <div class="tabs">
        <button class="tab-btn active" onclick="loadGame('3030', 'Teen Patti 20-20', 'teen20')">Teen Patti 20-20</button>
        <button class="tab-btn" onclick="loadGame('3031', '1 Day Teen Patti', 'teen')">1 Day Teen Patti</button>
        <button class="tab-btn" onclick="loadGame('3035', 'Dragon Tiger 20-20', 'dt20')">Dragon Tiger</button>
        <button class="tab-btn" onclick="loadGame('3059', 'Dragon Tiger 2', 'dt202')">Dragon Tiger 2</button>
        <button class="tab-btn" onclick="loadGame('3057', '1 Day Dragon Tiger', 'dt6')">1 Day Dragon Tiger</button>
        <button class="tab-btn" onclick="loadGame('3047', 'Dragon Tiger Lion', 'dtl20')">DTL (Dragon Tiger Lion)</button>
        <button class="tab-btn" onclick="loadGame('3032', 'Lucky 7 EU', 'lucky7eu')">Lucky 7 EU</button>
        <button class="tab-btn" onclick="loadGame('3058', 'Lucky 7 B', 'lucky7')">Lucky 7 B</button>
        <button class="tab-btn" onclick="loadGame('3053', 'Andar Bahar', 'ab20')">Andar Bahar</button>
        <button class="tab-btn" onclick="loadGame('3043', 'Andar Bahar 2', 'abj')">Andar Bahar 2</button>
        <button class="tab-btn" onclick="loadGame('3034', '32 Cards EU', 'card32eu')">32 Cards EU</button>
        <button class="tab-btn" onclick="loadGame('3055', '32 Cards B', 'card32')">32 Cards B</button>
        <button class="tab-btn" onclick="loadGame('3056', 'Amar Akbar Anthony', 'aaa')">Amar Akbar Anthony</button>
        <button class="tab-btn" onclick="loadGame('3044', 'Baccarat', 'baccarat')">Baccarat</button>
        <button class="tab-btn" onclick="loadGame('3033', 'Baccarat 2', 'baccarat2')">Baccarat 2</button>
        <button class="tab-btn" onclick="loadGame('3051', '20-20 Poker', 'poker')">20-20 Poker</button>
        <button class="tab-btn" onclick="loadGame('3052', 'Poker 20', 'poker20')">Poker 20</button>
        <button class="tab-btn" onclick="loadGame('3054', 'Worli Matka', 'worli')">Worli Matka</button>
        <button class="tab-btn" onclick="loadGame('3041', 'Bollywood Table', 'btable')">Bollywood Table</button>
        <button class="tab-btn" onclick="loadGame('3036', 'Card Race 20', 'race20')">Card Race</button>
        <button class="tab-btn" onclick="loadGame('3037', 'Queen', 'queen')">Queen</button>
        <button class="tab-btn" onclick="loadGame('3038', 'Casino War', 'war')">Casino War</button>
        <button class="tab-btn" onclick="loadGame('3039', '3 Card Judgement', '3cardj')">3 Card Judgement</button>
        <button class="tab-btn" onclick="loadGame('3065', 'Joker 20-20', 'joker120')">Joker Teen Patti</button>
        <button class="tab-btn" onclick="loadGame('3066', 'Roulette', 'roulette12')">Roulette</button>
        <button class="tab-btn" onclick="loadRadar('33924716')">Match Radar Tracker</button>
      </div>

      <div class="player-box">
        <iframe id="streamFrame" src="/api/direct-stream/casino/player/3030?id=teen20" allow="autoplay; fullscreen; unload"></iframe>
      </div>

      <div class="info-bar">
        <span id="currentStatus">Now Playing: <b>Teen Patti 20-20</b></span>
        <span>Origin: <span class="source-tag">Live Studio Nanocosmos / H5Live Ultra Low-Latency Stream</span></span>
      </div>

      <script>
        function loadGame(id, name, slug) {
          updateActive(event.target);
          document.getElementById('currentStatus').innerHTML = 'Now Playing: <b>' + name + '</b>';
          document.getElementById('streamFrame').src = '/api/direct-stream/casino/player/' + id + '?id=' + (slug || id);
        }
        function loadRadar(eventId) {
          updateActive(event.target);
          document.getElementById('currentStatus').innerHTML = 'Now Playing: <b>Live Match Radar Tracker</b>';
          document.getElementById('streamFrame').src = '/api/direct-stream/sports/radar/' + eventId;
        }
        function updateActive(btn) {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      </script>
    </body>
    </html>
  `);
});

/**
 * 1. Casino Stream JSON Link
 * GET /api/direct-stream/casino/link/:gameId
 */
router.get("/casino/link/:gameId", async (req, res) => {
  const { gameId } = req.params;
  const force = req.query.force === "true";
  const result = await getDirectCasinoStreamUrl(gameId, force);
  return res.json(result);
});

/**
 * 2. Casino Stream Playable Video HTML (for direct <iframe> embeds)
 * GET /api/direct-stream/casino/player/:gameId
 */
router.get("/casino/player/:gameId", async (req, res) => {
  const { gameId } = req.params;
  await renderCasinoPlayerHtml(gameId, req, res);
});

/**
 * 3. Sports Match Stream JSON Link
 * GET /api/direct-stream/sports/link/:eventId
 */
router.get("/sports/link/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const sportId = req.query.sportId || "4";
  const force = req.query.force === "true";
  const result = await getDirectSportsStreamUrl(eventId, sportId, force);
  return res.json(result);
});

/**
 * 4. Sports Match Playable Video HTML (for direct <iframe> embeds)
 * GET /api/direct-stream/sports/player/:eventId
 */
router.get("/sports/player/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const sportId = req.query.sportId || "4";
  await renderSportsPlayerHtml(eventId, sportId, req, res);
});

/**
 * 5. Interactive Match Radar / Ball-by-ball Tracker
 * GET /api/direct-stream/sports/radar/:eventId
 */
router.get("/sports/radar/:eventId", (req, res) => {
  const { eventId } = req.params;
  renderRadarHtml(eventId, res);
});

export default router;
