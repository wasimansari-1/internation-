import express from "express";
import axios from "axios";
import { getDemoToken, proxyRequest } from "../services/authService.js";
import {
  getScrapedCasinoLiveOdds,
  getCasinoTableList,
} from "../services/casinoService.js";
import { casinoConfig } from "../config/casinoConfig.js";
import { providerManager } from "../providers/index.js";

const router = express.Router();

router.get("/providers", async (req, res) => {
  const result = await proxyRequest(
    "/api/exchange/navigations/casino/casinoMainList",
  );
  res.status(result.statusCode).json(result);
});

router.all("/tables", async (req, res) => {
  const id = req.body?.id || req.query?.id || 110;
  const result = await getCasinoTableList(id);
  res.status(200).json(result);
});

router.get("/international-tables", async (req, res) => {
  try {
    const eventsRes = await proxyRequest(
      "/api/exchange/navigations/casinoEvents",
      { key: "2" },
    );
    const lobbyList = eventsRes.data?.data?.lobby || [];
    const intlList = lobbyList.filter(
      (item) =>
        item.menuName === "International" ||
        item.groupEventName === "evolutionWC" ||
        (item.link && item.link.includes("createLobbiesLink")),
    );

    if (intlList.length > 0) {
      const formatted = intlList.map((item) => ({
        eventId: item.eventId,
        eventName: item.eventName,
        companyName: "EVOLUTION",
        category: "live_casino",
        image: item.images || item.image || "",
        link: item.link,
      }));
      return res.json({ success: true, data: formatted });
    }

    const defaultEvoTables = [
      { eventId: "evo_roulette_live", eventName: "Lightning Roulette", companyName: "EVOLUTION", category: "roulette" },
      { eventId: "evo_crazy_time", eventName: "Crazy Time", companyName: "EVOLUTION", category: "game_shows" },
      { eventId: "evo_monopoly_live", eventName: "Monopoly Live", companyName: "EVOLUTION", category: "game_shows" },
      { eventId: "evo_baccarat_squeeze", eventName: "Baccarat Squeeze", companyName: "EVOLUTION", category: "baccarat" },
      { eventId: "evo_infinite_blackjack", eventName: "Infinite Blackjack", companyName: "EVOLUTION", category: "blackjack" },
      { eventId: "evo_mega_ball", eventName: "Mega Ball 100x", companyName: "EVOLUTION", category: "game_shows" },
    ];
    return res.json({ success: true, data: defaultEvoTables });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

router.get("/slots-tables", async (req, res) => {
  try {
    const token = await getDemoToken();
    const result = await proxyRequest(
      "/api/exchange/navigations/casino/casinoTableList",
      { id: 98 },
    );
    if (result.data?.data && Array.isArray(result.data.data)) {
      return res.json(result);
    }
    const defaultSlots = [
      { eventId: "slot_gates_olympus", eventName: "Gates of Olympus", companyName: "PRAGMATIC", category: "slots" },
      { eventId: "slot_sweet_bonanza", eventName: "Sweet Bonanza", companyName: "PRAGMATIC", category: "slots" },
      { eventId: "slot_sugar_rush", eventName: "Sugar Rush 1000", companyName: "PRAGMATIC", category: "slots" },
      { eventId: "slot_wolf_gold", eventName: "Wolf Gold", companyName: "PRAGMATIC", category: "slots" },
      { eventId: "slot_big_bass", eventName: "Big Bass Bonanza", companyName: "PRAGMATIC", category: "slots" },
    ];
    return res.json({ success: true, data: defaultSlots });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

router.get("/providers/config", (req, res) => {
  return res.json({ success: true, config: casinoConfig });
});

router.post("/providers/configure", (req, res) => {
  try {
    const { platformId, providerName, credentials, settings } = req.body;
    providerManager.configureProvider(platformId, providerName, {
      ...credentials,
      ...settings,
    });
    return res.json({ success: true, message: `Provider ${providerName} configured` });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

router.post("/update-evo-session", (req, res) => {
  const { sessionToken, launchUrl, clientBase } = req.body;
  if (!sessionToken && !launchUrl) {
    return res.status(400).json({ success: false, error: "sessionToken or launchUrl required" });
  }
  if (launchUrl) casinoConfig.evolution.gatewayUrl = launchUrl;
  if (clientBase) casinoConfig.evolution.clientBaseUrl = clientBase;
  return res.json({ success: true, message: "Evolution configuration updated successfully" });
});

router.get("/evolution-lobby", (req, res) => {
  const { category = "top_games" } = req.query;
  const launchId = casinoConfig.evolution.defaultLaunchId;
  const url = `${casinoConfig.evolution.clientBaseUrl}?launchId=${launchId}&category=${category}`;
  return res.json({ success: true, launchUrl: url });
});

router.post("/session/create", async (req, res) => {
  try {
    const { provider, eventId, userId, currency } = req.body;
    const session = await providerManager.createGameSession(
      provider || "UNIVERSE",
      { eventId, userId, currency },
    );
    return res.json(session);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/launch-game", async (req, res) => {
  const { eventId, companyName } = req.body;
  try {
    const token = await getDemoToken();
    const provider = (companyName || "").toUpperCase();
    if (provider.includes("EVOLUTION")) {
      const evoSession = await providerManager.createGameSession("EVOLUTION", { eventId });
      return res.json({ success: true, launchUrl: evoSession.launchUrl });
    }
    if (provider.includes("EZUGI")) {
      const ezugiSession = await providerManager.createGameSession("EZUGI", { eventId });
      return res.json({ success: true, launchUrl: ezugiSession.launchUrl });
    }
    const targetUrl = `https://casino.nice444.com/authentication/${token}/${eventId}`;
    return res.json({ success: true, launchUrl: targetUrl });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/launch-url", async (req, res) => {
  const { eventId } = req.body;
  try {
    const token = await getDemoToken();
    return res.json({
      success: true,
      launchUrl: `https://casino.nice444.com/authentication/${token}/${eventId}`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/watch-link/:gameId", async (req, res) => {
  const { gameId } = req.params;
  try {
    const token = await getDemoToken();
    const upstreamRes = await axios.post(
      "https://casino.nice444.com/casinoapp/exchange/users/streaming/casinoGameWatchLink",
      { streamId: String(gameId), timestamp: Date.now() },
      {
        headers: {
          Origin: "https://casino.nice444.com",
          Referer: "https://casino.nice444.com/",
          Authorization: `Bearer ${token}`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 6000,
      },
    );
    if (!upstreamRes.data?.data?.url) {
      return res.status(404).json({ success: false, error: "Stream URL not found", url: "" });
    }
    return res.json({ success: true, url: upstreamRes.data.data.url });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, url: "" });
  }
});

router.get("/stream-proxy/:gameId", async (req, res) => {
  const { gameId } = req.params;
  try {
    let token = await getDemoToken();
    let upstreamRes;
    try {
      upstreamRes = await axios.post(
        "https://casino.nice444.com/casinoapp/exchange/users/streaming/casinoGameWatchLink",
        { streamId: String(gameId), timestamp: Date.now() },
        {
          headers: {
            Origin: "https://casino.nice444.com",
            Referer: "https://casino.nice444.com/",
            Authorization: `Bearer ${token}`,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
          timeout: 6000,
        },
      );
    } catch (authErr) {
      token = await getDemoToken(true);
      upstreamRes = await axios.post(
        "https://casino.nice444.com/casinoapp/exchange/users/streaming/casinoGameWatchLink",
        { streamId: String(gameId), timestamp: Date.now() },
        {
          headers: {
            Origin: "https://casino.nice444.com",
            Referer: "https://casino.nice444.com/",
            Authorization: `Bearer ${token}`,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
          timeout: 6000,
        },
      );
    }

    const streamUrl = upstreamRes.data?.data?.url;
    if (!streamUrl) {
      return res.status(404).send("Stream URL not found");
    }

    const pageRes = await axios.get(streamUrl, {
      headers: {
        Origin: "https://casino.nice444.com",
        Referer: "https://casino.nice444.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      timeout: 8000,
    });

    let html = pageRes.data;
    if (typeof html === "string") {
      html = html.replace('src="/player/player.js', 'src="https://tv.ltve.live/player/player.js');
    }

    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err) {
    return res.status(500).send(`Failed to proxy stream: ${err.message}`);
  }
});

router.get("/results/:gameId", async (req, res) => {
  const { gameId } = req.params;
  try {
    const token = await getDemoToken();
    const upstreamRes = await axios.post(
      "https://casino.nice444.com/casinoapp/users/casino/casinoEventResults",
      { eventId: String(gameId) },
      {
        headers: {
          Origin: "https://casino.nice444.com",
          Referer: "https://casino.nice444.com/",
          Authorization: `Bearer ${token}`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 7000,
      },
    );
    return res.json({ success: true, data: upstreamRes.data?.data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

router.get("/live-odds/:gameId", async (req, res) => {
  const { gameId } = req.params;
  try {
    const data = await getScrapedCasinoLiveOdds(gameId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message, data: null });
  }
});

export default router;

