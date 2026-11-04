import express from "express";
import axios from "axios";
import { getDemoToken, getStartexchToken, proxyRequest } from "../services/authService.js";
import {
  getScrapedCasinoLiveOdds,
  getCasinoTableList,
  getDedicatedCasinoResult,
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
    const startexchToken = await getStartexchToken();
    if (startexchToken) {
      return res.json({
        success: true,
        launchUrl: `https://casino.startexch99.com/authentication/${startexchToken}/${eventId}`,
      });
    }
    const token = await getDemoToken();
    return res.json({
      success: true,
      launchUrl: `https://casino.nice444.com/authentication/${token}/${eventId}`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

const RESIDENTIAL_IPS = [
  "103.21.124.5",
  "49.36.142.88",
  "152.57.12.1",
  "103.251.167.20",
  "122.161.49.200",
];

let streamProviderCounter = 0;

async function fetchUpstreamWatchUrl(gameId, incomingIp) {
  streamProviderCounter++;
  // Alternates 50/50: Startexch99 <-> Nice444 to avoid overloading or blocking any single provider
  const providers =
    streamProviderCounter % 2 === 0
      ? [
          {
            name: "Startexch99",
            domain: "https://casino.startexch99.com",
            getToken: () => getStartexchToken(),
          },
          {
            name: "Nice444",
            domain: "https://casino.nice444.com",
            getToken: () => getDemoToken(),
          },
        ]
      : [
          {
            name: "Nice444",
            domain: "https://casino.nice444.com",
            getToken: () => getDemoToken(),
          },
          {
            name: "Startexch99",
            domain: "https://casino.startexch99.com",
            getToken: () => getStartexchToken(),
          },
        ];

  const candidateIps = [incomingIp, ...RESIDENTIAL_IPS].filter(Boolean);

  for (const provider of providers) {
    let token = await provider.getToken();
    for (const ip of candidateIps) {
      try {
        const res = await axios.post(
          `${provider.domain}/casinoapp/exchange/users/streaming/casinoGameWatchLink`,
          { streamId: String(gameId), timestamp: Date.now() },
          {
            headers: {
              Origin: provider.domain,
              Referer: `${provider.domain}/`,
              Authorization: `Bearer ${token}`,
              "X-Forwarded-For": ip,
              "X-Real-IP": ip,
              "CF-Connecting-IP": ip,
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            timeout: 4000,
          },
        );
        if (res.data?.data?.url) {
          return res.data.data.url;
        }
      } catch (e) {
        if (e.response?.status === 401 || e.response?.status === 403) {
          token = await provider.getToken(true);
        }
        continue;
      }
    }
  }
  return null;
}

router.get("/watch-link/:gameId", async (req, res) => {
  const { gameId } = req.params;
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.headers["cf-connecting-ip"] ||
    "103.21.124.5";

  try {
    const url = await fetchUpstreamWatchUrl(gameId, clientIp);
    if (url) {
      return res.json({ success: true, url });
    }
  } catch (err) {}
  return res.json({ success: true, url: `/api/casino/stream-proxy/${gameId}` });
});

router.get("/stream-proxy/:gameId", async (req, res) => {
  const { gameId } = req.params;
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.headers["cf-connecting-ip"] ||
    "103.21.124.5";

  try {
    const streamUrl = await fetchUpstreamWatchUrl(gameId, clientIp);
    if (!streamUrl) {
      return res.status(200).send(`
        <!DOCTYPE html><html><body style="background:#050508;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;">
          <div style="text-align:center;">
            <p style="font-size:12px;font-weight:700;letter-spacing:0.5px;color:#38bdf8;">SYNCING DEALER STREAM...</p>
            <script>setTimeout(function(){ window.location.reload(); }, 2500);</script>
          </div>
        </body></html>
      `);
    }

    const pageRes = await axios.get(streamUrl, {
      headers: {
        Origin: "https://casino.nice444.com",
        Referer: "https://casino.nice444.com/",
        "X-Forwarded-For": clientIp,
        "X-Real-IP": clientIp,
        "CF-Connecting-IP": clientIp,
        "User-Agent":
          req.headers["user-agent"] ||
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      timeout: 8000,
    });

    let html = pageRes.data;
    if (typeof html === "string") {
      let streamOrigin = "https://live.livecdnplatin.com";
      try {
        streamOrigin = new URL(streamUrl).origin;
      } catch (e) {}

      // Correct player.js path to the actual stream host
      html = html.replace(/src="\/player\/player\.js/g, `src="${streamOrigin}/player/player.js`);
      html = html.replace(/href="\/player\//g, `href="${streamOrigin}/player/`);

      // Neutralize frame enforcement and devtools guard in configuration
      html = html.replace(/"enforce"\s*:\s*true/g, '"enforce":false');
      html = html.replace(/"devtoolsGuard"\s*:\s*true/g, '"devtoolsGuard":false');

      // Strip any raw debugger statements
      html = html.replace(/\bdebugger\b/g, '/*noop*/');

      // Cleanly inject inside <head> with base href, CORS /ping bypass, and anti-debugger
      const injectedScript = `
        <base href="${streamOrigin}/">
        <script>
          (function() {
            try {
              // 1. Mock /ping and telemetry requests to prevent CORS errors on livecdnplatin
              var origFetch = window.fetch;
              window.fetch = function(input, init) {
                var url = typeof input === "string" ? input : (input && input.url ? input.url : "");
                if (url.includes("/ping") || url.includes("/flag") || url.includes("/bye")) {
                  return Promise.resolve(new Response(JSON.stringify({ status: 200, message: "ok" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                  }));
                }
                return origFetch.apply(this, arguments).catch(function(err) {
                  if (url.includes("/ping") || url.includes("/flag")) {
                    return new Response(JSON.stringify({ status: 200 }), { status: 200 });
                  }
                  throw err;
                });
              };

              // 2. Intercept XMLHttpRequest for telemetry /ping
              var OrigXHR = window.XMLHttpRequest;
              window.XMLHttpRequest = function() {
                var xhr = new OrigXHR();
                var origOpen = xhr.open;
                var origSend = xhr.send;
                var isPing = false;
                xhr.open = function(method, url) {
                  if (typeof url === "string" && (url.includes("/ping") || url.includes("/flag") || url.includes("/bye"))) {
                    isPing = true;
                  }
                  return origOpen.apply(xhr, arguments);
                };
                xhr.send = function() {
                  if (isPing) {
                    Object.defineProperty(xhr, "status", { get: function() { return 200; } });
                    Object.defineProperty(xhr, "readyState", { get: function() { return 4; } });
                    Object.defineProperty(xhr, "responseText", { get: function() { return '{"status":"ok"}'; } });
                    setTimeout(function() {
                      if (typeof xhr.onload === "function") xhr.onload();
                      if (typeof xhr.onreadystatechange === "function") xhr.onreadystatechange();
                    }, 5);
                    return;
                  }
                  return origSend.apply(xhr, arguments);
                };
                return xhr;
              };

              // 3. Neutralize debugger
              window.debugger = function(){};
              var origFn = window.Function;
              window.Function = function() {
                for (var i = 0; i < arguments.length; i++) {
                  if (typeof arguments[i] === "string" && arguments[i].includes("debugger")) {
                    arguments[i] = arguments[i].replace(/\\bdebugger\\b/g, "/*noop*/");
                  }
                }
                return origFn.apply(this, arguments);
              };
              window.Function.prototype = origFn.prototype;

              // 4. Neutralize anti-debugger worker
              var OrigWorker = window.Worker;
              window.Worker = function(scriptURL, options) {
                if (typeof scriptURL === "string" && scriptURL.startsWith("blob:")) {
                  return {
                    postMessage: function(){},
                    terminate: function(){},
                    addEventListener: function(){},
                    removeEventListener: function(){},
                    onmessage: null,
                    onerror: null
                  };
                }
                return new OrigWorker(scriptURL, options);
              };

              // 5. Neutralize setInterval debugger
              var origSetInterval = window.setInterval;
              window.setInterval = function(fn, delay) {
                if (typeof fn === "function" && fn.toString().includes("debugger")) return 0;
                if (typeof fn === "string" && fn.includes("debugger")) return 0;
                return origSetInterval.apply(this, arguments);
              };
            } catch(e) {}
          })();
        </script>
      `;

      if (html.includes("<head>")) {
        html = html.replace("<head>", "<head>" + injectedScript);
      } else {
        html = injectedScript + html;
      }
    }

    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err) {
    return res.status(200).send(`
      <!DOCTYPE html><html><body style="background:#050508;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;">
        <div style="text-align:center;">
          <p style="font-size:12px;font-weight:700;letter-spacing:0.5px;color:#38bdf8;">RECONNECTING DEALER STREAM...</p>
          <script>setTimeout(function(){ window.location.reload(); }, 2500);</script>
        </div>
      </body></html>
    `);
  }
});

let resultsProviderCounter = 0;

router.get("/results/:gameId", async (req, res) => {
  const { gameId } = req.params;
  resultsProviderCounter++;
  const providers =
    resultsProviderCounter % 2 === 0
      ? [
          { domain: "https://casino.startexch99.com", getToken: getStartexchToken },
          { domain: "https://casino.nice444.com", getToken: getDemoToken },
        ]
      : [
          { domain: "https://casino.nice444.com", getToken: getDemoToken },
          { domain: "https://casino.startexch99.com", getToken: getStartexchToken },
        ];

  for (const p of providers) {
    try {
      const token = await p.getToken();
      const upstreamRes = await axios.post(
        `${p.domain}/casinoapp/users/casino/casinoEventResults`,
        { eventId: String(gameId) },
        {
          headers: {
            Origin: p.domain,
            Referer: `${p.domain}/`,
            Authorization: `Bearer ${token}`,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
          timeout: 4500,
        },
      );
      if (Array.isArray(upstreamRes.data?.data) && upstreamRes.data.data.length > 0) {
        return res.json({ success: true, data: upstreamRes.data.data });
      }
    } catch (err) {
      continue;
    }
  }

  return res.json({ success: true, data: [] });
});

// Dedicated ultra-fast result API (instant response as soon as round ends)
router.get("/result/:gameId", async (req, res) => {
  const { gameId } = req.params;
  try {
    const result = await getDedicatedCasinoResult(gameId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/latest-result/:gameId", async (req, res) => {
  const { gameId } = req.params;
  try {
    const result = await getDedicatedCasinoResult(gameId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/:gameId/result", async (req, res) => {
  const { gameId } = req.params;
  try {
    const result = await getDedicatedCasinoResult(gameId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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

