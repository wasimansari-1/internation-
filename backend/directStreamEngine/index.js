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
