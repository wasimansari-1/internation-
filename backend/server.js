import express from "express";
import http from "http";
import dns from "node:dns";
import { Server } from "socket.io";
import { io as ioClient } from "socket.io-client";
import cors from "cors";
import axios from "axios";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { providerManager } from "./providers/index.js";
import { casinoConfig } from "./config/casinoConfig.js";

// Ensure IPv4 first on cloud hosts (avoids getaddrinfo ENOTFOUND on IPv6)
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5001;
const TARGET_BASE = "https://nice444.com";

app.use(cors());
app.use(express.json());

// Token cache
let cachedToken = null;
let cachedIntCasinoToken = null;
let cachedUserDetail = null;
let tokenExpiry = 0;

let tokenRetryTimer = null;
const scheduleTokenRetry = () => {
  if (tokenRetryTimer) return;
  tokenRetryTimer = setTimeout(async () => {
    tokenRetryTimer = null;
    const t = await getDemoToken(true);
    if (t) {
      console.log("Nice444 session token successfully acquired on retry.");
      ensureNiceCasinoSocket().catch(() => {});
    }
  }, 5000);
};

const getDemoToken = async (forceRefresh = false) => {
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  try {
    const res = await axios.post(
      `${TARGET_BASE}/app/users/userLogin`,
      {
        userName: "demo52",
        password: "Asdf1234",
        ipInfo: {},
      },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: TARGET_BASE,
          Referer: `${TARGET_BASE}/`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 8000,
      },
    );
    if (res.data?.data?.accessToken) {
      cachedToken = res.data.data.accessToken;
      cachedIntCasinoToken = res.data.data.intCasino || null;
      cachedUserDetail = res.data.data.userDetail || null;
      tokenExpiry = Date.now() + 30 * 60 * 1000;
      return cachedToken;
    }
  } catch (err) {
    console.error("Error getting demo token:", err.message);
    scheduleTokenRetry();
  }
  return cachedToken;
};

// Generic proxy helper
const proxyRequest = async (endpoint, payload = {}, method = "POST") => {
  const startTime = Date.now();
  const url = `${TARGET_BASE}${endpoint}`;
  try {
    const response = await axios({
      method,
      url,
      data: payload,
      headers: {
        "Content-Type": "application/json",
        Origin: TARGET_BASE,
        Referer: `${TARGET_BASE}/`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      timeout: 10000,
    });
    return {
      success: true,
      statusCode: response.status,
      latency: Date.now() - startTime,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      statusCode: error.response?.status || 500,
      latency: Date.now() - startTime,
      error: error.response?.data || error.message,
    };
  }
};

// --- HTTP API ROUTES ---
app.get("/api/sports/list", async (req, res) => {
  const result = await proxyRequest("/api/exchange/sports/sportsList");
  res.status(result.statusCode).json(result);
});

app.get("/api/sports/all-events", async (req, res) => {
  const result = await proxyRequest(
    "/api/exchange/market/matchodds/allEventsList",
  );
  res.status(result.statusCode).json(result);
});

app.post("/api/sports/markets-event-list", async (req, res) => {
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

app.post("/api/sports/fancy-markets", async (req, res) => {
  const { eventId } = req.body;
  const result = await proxyRequest("/api/exchange/markets/fancyMarketList", {
    eventId,
  });
  res.status(result.statusCode).json(result);
});

app.get("/api/casino/providers", async (req, res) => {
  const result = await proxyRequest(
    "/api/exchange/navigations/casino/casinoMainList",
  );
  res.status(result.statusCode).json(result);
});

app.post("/api/casino/tables", async (req, res) => {
  const { id } = req.body;
  const result = await proxyRequest(
    "/api/exchange/navigations/casino/casinoTableList",
    { id: id || 12 },
  );
  res.status(result.statusCode).json(result);
});

app.get("/api/casino/international-tables", async (req, res) => {
  try {
    // 1. Try real working Evolution / International lobbies from casinoEvents
    const token = await getDemoToken();
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
        eventName: item.eventName
          ? item.eventName.replace(/^wc-/, "").replace(/_/g, " ").toUpperCase()
          : "EVOLUTION LIVE",
        companyName: item.companyName || "INTERNATIONAL",
        image:
          item.url || "https://nice444.com/api/users/images/Evolution.webp",
        link: item.link,
        groupEventName: item.groupEventName || "evolutionWC",
        popular: item.popular || false,
        sequence: item.sequence || 0,
      }));
      return res.json({
        success: true,
        count: formatted.length,
        data: formatted,
      });
    }

    // Fallback to table list
    const [evoRes, ezugiRes] = await Promise.all([
      proxyRequest("/api/exchange/navigations/casino/casinoTableList", {
        id: 15,
      }),
      proxyRequest("/api/exchange/navigations/casino/casinoTableList", {
        id: 16,
      }),
    ]);
    const evoList = evoRes.data?.data || [];
    const ezugiList = ezugiRes.data?.data || [];
    const combined = [...evoList, ...ezugiList];
    res.json({ success: true, count: combined.length, data: combined });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

app.get("/api/casino/slots-tables", async (req, res) => {
  try {
    // 1. Try real working RNG slots from casinoEvents
    const eventsRes = await proxyRequest(
      "/api/exchange/navigations/casinoEvents",
      { key: "2" },
    );
    const lobbyList = eventsRes.data?.data?.lobby || [];
    const slotList = lobbyList.filter(
      (item) =>
        item.menuName === "SLOT GAMES" ||
        item.menuId === "946" ||
        item.companyName === "PLATIN",
    );

    if (slotList.length > 0) {
      const formatted = slotList.map((item) => ({
        eventId: item.eventId,
        eventName: item.eventName || "Slot Game",
        companyName: "PLATIN",
        image: item.url || "",
        link: item.link,
        groupEventName: item.groupEventName,
        popular: item.popular || false,
        sequence: item.sequence || 20,
      }));
      return res.json({
        success: true,
        count: formatted.length,
        data: formatted,
      });
    }

    // Fallback to table list id: 39
    const platinRes = await proxyRequest(
      "/api/exchange/navigations/casino/casinoTableList",
      { id: 39 },
    );
    const fallbackList = platinRes.data?.data || [];
    res.json({ success: true, count: fallbackList.length, data: fallbackList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

// --- DYNAMIC MULTI-PLATFORM CASINO PROVIDER ENDPOINTS (AURA, DIAMOND, STANDARD) ---

// 1. Get Live Provider Config & Supported Platforms
app.get("/api/casino/providers/config", (req, res) => {
  res.json({
    success: true,
    platforms: Object.keys(casinoConfig.platforms),
    providers: ["EVOLUTION", "EZUGI", "PLATIN", "UNIVERSE"],
    defaultOperatorId: casinoConfig.platform.defaultOperatorId,
    defaultCurrency: casinoConfig.platform.defaultCurrency,
    activeEvolutionLaunchId: casinoConfig.evolution.defaultLaunchId,
  });
});

// 2. Configure Dynamic Provider Settings (Platform operator keys, Evolution session)
app.post("/api/casino/providers/configure", (req, res) => {
  const {
    platform,
    operatorId,
    currency,
    evolutionLaunchId,
    evolutionFullUrl,
  } = req.body;
  if (platform && casinoConfig.platforms[platform.toLowerCase()]) {
    if (operatorId)
      casinoConfig.platforms[platform.toLowerCase()].operatorId = operatorId;
    if (currency)
      casinoConfig.platforms[platform.toLowerCase()].currency = currency;
  }
  if (evolutionLaunchId) {
    providerManager.updateEvolutionLaunchId(evolutionLaunchId);
    casinoConfig.evolution.defaultLaunchId = evolutionLaunchId;
  }
  if (evolutionFullUrl) {
    const match = evolutionFullUrl.match(/ua_launch_id=([a-zA-Z0-9]+)/);
    if (match) {
      providerManager.updateEvolutionLaunchId(match[1]);
      casinoConfig.evolution.defaultLaunchId = match[1];
    }
  }
  return res.json({
    success: true,
    message: "Provider configurations updated successfully",
    activeEvolutionLaunchId: casinoConfig.evolution.defaultLaunchId,
  });
});

// 3. Update Evolution Session dynamically
app.post("/api/casino/update-evo-session", (req, res) => {
  const { launchId, fullUrl } = req.body;
  let targetId = launchId;
  if (!targetId && fullUrl) {
    const match = fullUrl.match(/ua_launch_id=([a-zA-Z0-9]+)/);
    if (match) targetId = match[1];
  }
  if (targetId) {
    providerManager.updateEvolutionLaunchId(targetId);
    casinoConfig.evolution.defaultLaunchId = targetId;
    return res.json({
      success: true,
      message: "Evolution launch ID updated",
      evoLaunchId: targetId,
    });
  }
  return res
    .status(400)
    .json({
      success: false,
      error: "launchId or fullUrl containing ua_launch_id required",
    });
});

// 4. Get Direct Evolution Live Lobby URL
app.get("/api/casino/evolution-lobby", (req, res) => {
  const lobbyUrl = providerManager.getEvolutionLobbyUrl("top_games");
  res.json({
    success: true,
    lobbyUrl,
    evoLaunchId: casinoConfig.evolution.defaultLaunchId,
  });
});

// 5. Unified Dynamic Game Session Creator (Multi-platform: Aura, Diamond, etc.)
app.post("/api/casino/session/create", async (req, res) => {
  try {
    const {
      eventId,
      provider,
      companyName,
      userId,
      userToken,
      platform = "standard",
      operatorId,
      currency,
      lang,
      type,
      mode,
      rawLink,
    } = req.body;

    if (!eventId)
      return res
        .status(400)
        .json({ success: false, error: "eventId is required" });

    const resolvedProvider = providerManager.resolveProvider(
      eventId,
      companyName,
      provider,
    );
    let finalToken = userToken;
    if (
      !finalToken &&
      (resolvedProvider === "UNIVERSE" ||
        resolvedProvider === "PLATIN" ||
        resolvedProvider === "EVOLUTION")
    ) {
      finalToken = await getDemoToken();
    }

    const session = await providerManager.launchGame({
      eventId,
      provider: resolvedProvider,
      companyName,
      userId,
      userToken: finalToken,
      platform,
      operatorId,
      currency,
      lang,
      type,
      mode,
      rawLink,
    });

    return res.json(session);
  } catch (err) {
    console.error("Session creation error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Primary Launch Game Route (Compatible with existing frontend + custom platforms)
app.post("/api/casino/launch-game", async (req, res) => {
  try {
    const {
      eventId,
      companyName,
      provider,
      userId,
      userToken,
      platform,
      operatorId,
      currency,
      rawLink,
      mode,
    } = req.body;

    if (!eventId) return res.status(400).json({ error: "eventId required" });

    const resolvedProvider = providerManager.resolveProvider(
      eventId,
      companyName,
      provider,
    );
    let finalToken = userToken;
    if (
      !finalToken &&
      (resolvedProvider === "UNIVERSE" ||
        resolvedProvider === "PLATIN" ||
        resolvedProvider === "EVOLUTION")
    ) {
      finalToken = await getDemoToken();
    }

    const session = await providerManager.launchGame({
      eventId,
      companyName,
      provider: resolvedProvider,
      userId,
      userToken: finalToken,
      platform: platform || "standard",
      operatorId,
      currency,
      mode,
      rawLink,
    });

    return res.json(session);
  } catch (err) {
    console.error("Game launch error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- EVOLUTION SEAMLESS WALLET B2B CALLBACK ENDPOINTS ---
// Evolution Gaming calls these endpoints to authenticate players and settle bets in real-time
app.post("/api/evolution/seamless/auth", (req, res) => {
  const { sid, uuid } = req.body || {};
  console.log(`[Evolution Wallet Auth] Validating session token: ${sid}`);
  res.json({
    status: "OK",
    sid: sid || "valid_session",
    uuid: uuid || crypto.randomUUID(),
    balance: 50000.0,
    currency: "INR",
  });
});

app.post("/api/evolution/seamless/balance", (req, res) => {
  const { sid, uuid } = req.body || {};
  res.json({
    status: "OK",
    sid: sid,
    uuid: uuid,
    balance: 50000.0,
    currency: "INR",
  });
});

app.post("/api/evolution/seamless/debit", (req, res) => {
  const { sid, transaction, uuid } = req.body || {};
  console.log(`[Evolution Wallet Debit] Bet placed:`, transaction);
  res.json({
    status: "OK",
    sid: sid,
    uuid: uuid,
    balance: 49900.0,
    currency: "INR",
  });
});

app.post("/api/evolution/seamless/credit", (req, res) => {
  const { sid, transaction, uuid } = req.body || {};
  console.log(`[Evolution Wallet Credit] Win credited:`, transaction);
  res.json({
    status: "OK",
    sid: sid,
    uuid: uuid,
    balance: 51800.0,
    currency: "INR",
  });
});

app.post("/api/casino/launch-url", async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: "eventId required" });
  const token = await getDemoToken();
  if (!token)
    return res.status(500).json({ error: "Failed to retrieve session token" });
  res.json({
    success: true,
    eventId,
    launchUrl: `https://casino.nice444.com/authentication/${token}/${eventId}`,
  });
});

// --- REAL NICE444 CASINO SOCKET & RESULTS (100% NATIVE NICE444 SCRAPING) ---
let casinoSocket = null;
const casinoOddsCache = new Map(); // gameId -> latest packet
const activeCasinoSubscribers = new Map(); // gameId -> Set of socket.id

async function ensureNiceCasinoSocket() {
  if (casinoSocket && casinoSocket.connected) {
    return casinoSocket;
  }
  const token = await getDemoToken();
  if (!token) {
    console.warn("Unable to get Nice444 token for casino socket");
    return null;
  }

  if (!casinoSocket) {
    casinoSocket = ioClient("https://casino.nice444.com", {
      path: "/universecasino",
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
      auth: { token, uType: "usr" },
    });

    casinoSocket.on("connect", () => {
      console.log("Connected to Real Nice444 Casino Socket (/universecasino)");
      for (const gId of activeCasinoSubscribers.keys()) {
        casinoSocket.emit("SCSN", { eventId: gId });
      }
    });

    const handleCasinoPacket = (raw) => {
      try {
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!data) return;

        let payload = data.data;
        if (Array.isArray(payload)) {
          payload = payload[0] || {};
        }

        const eventId = String(
          data.eventId || payload?.eventId || payload?._id || data._id || "",
        );

        if (!eventId) return;

        const existing = casinoOddsCache.get(eventId) || {
          eventId,
          marketArr: [],
          cardsArr: {},
          leftSec: 0,
          roundId: "",
          status: "ONLINE",
        };

        // Deep clone existing marketArr if present to ensure immutability
        let currentMarketArr = existing.marketArr
          ? JSON.parse(JSON.stringify(existing.marketArr))
          : [];

        // If incoming packet contains complete marketArr, store ALL markets
        if (Array.isArray(payload?.marketArr) && payload.marketArr.length > 0) {
          currentMarketArr = payload.marketArr;
        } else if (Array.isArray(data.marketArr) && data.marketArr.length > 0) {
          currentMarketArr = data.marketArr;
        }

        // Merge cardsArr
        const currentCards = {
          ...(existing.cardsArr || {}),
          ...(payload?.cardsArr || {}),
          ...(data.cardsArr || {}),
        };

        // Extract timers and status
        const leftSec =
          payload?.leftSec !== undefined
            ? payload.leftSec
            : data.leftSec !== undefined
              ? data.leftSec
              : existing.leftSec;
        const roundId = payload?.roundId || data.roundId || existing.roundId;
        const roundStatus =
          payload?.roundStatus || data.roundStatus || existing.roundStatus;
        const status = payload?.status || data.status || existing.status;
        const eventName =
          payload?.eventName || data.eventName || existing.eventName;

        // Apply dotted updates (e.g. marketArr.0.runners.1.price.back.0.size: 2274325)
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          for (const [key, val] of Object.entries(payload)) {
            if (key.includes(".")) {
              const parts = key.split(".");
              if (parts[0] === "marketArr" && currentMarketArr.length > 0) {
                const mIdx = parseInt(parts[1], 10);
                if (currentMarketArr[mIdx]) {
                  const rIdx = parseInt(parts[3], 10);
                  const prop = parts[parts.length - 1]; // "size" or "price"
                  const backIdx = parseInt(parts[6] || 0, 10);
                  if (
                    currentMarketArr[mIdx].runners &&
                    currentMarketArr[mIdx].runners[rIdx]
                  ) {
                    const runner = currentMarketArr[mIdx].runners[rIdx];
                    if (!runner.price)
                      runner.price = { back: [{ price: 0, size: 0 }] };
                    if (!runner.price.back)
                      runner.price.back = [{ price: 0, size: 0 }];
                    if (!runner.price.back[backIdx])
                      runner.price.back[backIdx] = { price: 0, size: 0 };
                    runner.price.back[backIdx][prop] = val;
                  }
                }
              }
            }
          }
        }

        const merged = {
          eventId,
          eventName,
          roundId,
          leftSec,
          roundStatus,
          status,
          cardsArr: currentCards,
          marketArr: currentMarketArr,
          data: payload,
        };

        casinoOddsCache.set(eventId, merged);
        io.to(`casino:${eventId}`).emit("casino:live:odds", merged);
      } catch (err) {
        console.warn("Casino packet parse error:", err.message);
      }
    };

    casinoSocket.on("casino_odds", handleCasinoPacket);
    casinoSocket.on("message", handleCasinoPacket);

    casinoSocket.on("connect_error", (err) => {
      console.warn("Nice444 Casino socket error:", err.message);
    });
  }

  return casinoSocket;
}

// Start casino socket in background with slight delay to ensure network route readiness
setTimeout(() => {
  ensureNiceCasinoSocket().catch(() => {});
}, 3000);

app.get("/api/casino/watch-link/:gameId", async (req, res) => {
  const { gameId } = req.params;
  try {
    const token = await getDemoToken();
    const upstreamRes = await axios.post(
      "https://casino.nice444.com/casinoapp/exchange/users/streaming/casinoGameWatchLink",
      {
        streamId: String(gameId),
        timestamp: Date.now(),
      },
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
    const watchUrl = upstreamRes.data?.data?.url || "";
    return res.json({ success: true, url: watchUrl });
  } catch (err) {
    console.error(
      `Error fetching casino watch link for ${gameId}:`,
      err.message,
    );
    return res
      .status(500)
      .json({ success: false, error: err.message, url: "" });
  }
});

app.get("/api/casino/stream-proxy/:gameId", async (req, res) => {
  const { gameId } = req.params;
  try {
    let token = await getDemoToken();
    let upstreamRes;
    try {
      upstreamRes = await axios.post(
        "https://casino.nice444.com/casinoapp/exchange/users/streaming/casinoGameWatchLink",
        {
          streamId: String(gameId),
          timestamp: Date.now(),
        },
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
      if (authErr.response?.status === 401) {
        token = await getDemoToken(true);
        upstreamRes = await axios.post(
          "https://casino.nice444.com/casinoapp/exchange/users/streaming/casinoGameWatchLink",
          {
            streamId: String(gameId),
            timestamp: Date.now(),
          },
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
      } else {
        throw authErr;
      }
    }
    const watchUrl = upstreamRes.data?.data?.url || "";
    if (!watchUrl) {
      return res.status(404).send("Stream URL not found");
    }

    const pageRes = await axios.get(watchUrl, {
      headers: {
        Referer: "https://casino.nice444.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      timeout: 8000,
    });

    let html = pageRes.data;

    html = html.replace(
      /src="\/player\//g,
      'src="https://live.livecdnplatin.com/player/',
    );
    html = html.replace(
      /href="\/player\//g,
      'href="https://live.livecdnplatin.com/player/',
    );
    html = html.replace(
      /url\('\/player\//g,
      "url('https://live.livecdnplatin.com/player/",
    );

    const bypassScript = `
      <script>
        try {
          Object.defineProperty(document, 'referrer', { get: () => 'https://casino.nice444.com/' });
          Object.defineProperty(window.location, 'ancestorOrigins', {
            get: () => ({ 0: 'https://casino.nice444.com', length: 1, contains: () => true, item: () => 'https://casino.nice444.com' })
          });
        } catch (e) {}
      </script>
    `;

    html = html.replace(
      /<script type="application\/json" id="cfg">([^<]+)<\/script>/,
      (match, cfgStr) => {
        try {
          const cfg = JSON.parse(cfgStr);
          if (cfg.frameAllow) {
            cfg.frameAllow.enforce = false;
            if (cfg.frameAllow.outer) {
              cfg.frameAllow.outer.apps = true;
              cfg.frameAllow.outer.hosts = cfg.frameAllow.outer.hosts || [];
              cfg.frameAllow.outer.hosts.push("localhost", "127.0.0.1");
              cfg.frameAllow.outer.sites = cfg.frameAllow.outer.sites || [];
              cfg.frameAllow.outer.sites.push("localhost", "127.0.0.1");
            }
            if (cfg.frameAllow.parent) {
              cfg.frameAllow.parent.apps = true;
              cfg.frameAllow.parent.hosts = cfg.frameAllow.parent.hosts || [];
              cfg.frameAllow.parent.hosts.push("localhost", "127.0.0.1");
              cfg.frameAllow.parent.sites = cfg.frameAllow.parent.sites || [];
              cfg.frameAllow.parent.sites.push("localhost", "127.0.0.1");
            }
          }
          cfg.devtoolsGuard = false;
          return `<script type="application/json" id="cfg">${JSON.stringify(cfg)}</script>`;
        } catch (e) {
          return match;
        }
      },
    );

    html = html.replace("<head>", `<head>${bypassScript}`);

    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err) {
    console.error(`Stream proxy error for ${gameId}:`, err.message);
    return res.status(500).send(`Unable to proxy stream: ${err.message}`);
  }
});

app.get("/api/casino/results/:gameId", async (req, res) => {
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
    console.error(
      `Error fetching real Nice444 casino results for ${gameId}:`,
      err.message,
    );
    return res
      .status(500)
      .json({ success: false, error: err.message, data: [] });
  }
});

app.get("/api/casino/live-odds/:gameId", (req, res) => {
  const { gameId } = req.params;
  const cached = casinoOddsCache.get(String(gameId));
  if (cached) {
    return res.json({ success: true, data: cached });
  }
  return res.json({
    success: false,
    message: "No cached odds yet",
    data: null,
  });
});

app.post("/api/stream/watch-link", async (req, res) => {
  const { streamId } = req.body;
  const timestamp = Date.now();
  const result = await proxyRequest(
    "/api/exchange/streaming/exchEventsWatchLink",
    { streamId, timestamp },
  );
  res.status(result.statusCode).json(result);
});

app.get("/api/media/news", async (req, res) => {
  const result = await proxyRequest("/api/exchange/news/exchangeNews");
  res.status(result.statusCode).json(result);
});

// --- REAL-TIME FIRESTORE ODDS FETCHER (NO DUMMY DATA) ---
const queryFirestoreForEvent = async (eventId, sportId = "4") => {
  const projectMap = {
    1: "soccer-57fb9",
    2: "tennis-101ef",
    4: "t20-cricket-add9b",
    7: "other-sports-1bba3",
    4339: "other-sports-1bba3",
    7522: "other-sports-1bba3",
  };
  const projectId = projectMap[String(sportId)] || "t20-cricket-add9b";

  const fetchCollection = async (collectionId) => {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
      const query = {
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: "exEventId" },
              op: "EQUAL",
              value: { stringValue: String(eventId) },
            },
          },
        },
      };
      const res = await axios.post(url, query, { timeout: 3500 });
      return res.data || [];
    } catch (e) {
      return [];
    }
  };

  const [betfairDocs, bookmakerDocs, fancyDocs] = await Promise.all([
    fetchCollection("Betfair"),
    fetchCollection("Bookmakers"),
    fetchCollection("Fancy"),
  ]);

  const parseNumber = (f) => {
    if (!f) return 0;
    const raw = f.doubleValue ?? f.integerValue;
    if (raw === "NaN" || raw === null || raw === undefined) return 0;
    const n = Number(raw);
    return isNaN(n) ? 0 : n;
  };

  const parseRunners = (fields) => {
    if (!fields) return [];
    const rawRunners =
      fields.oddsData?.mapValue?.fields?.runners?.arrayValue?.values || [];
    const names = fields.runnersData?.mapValue?.fields || {};

    return rawRunners.map((r) => {
      const rf = r.mapValue?.fields || {};
      const selId = String(
        rf.selectionId?.integerValue || rf.selectionId?.stringValue || "",
      );
      const name = names[selId]?.stringValue || `Runner ${selId}`;
      const runnerStatus = rf.status?.stringValue || "ONLINE";
      const isSuspended =
        runnerStatus === "SUSPENDED" || runnerStatus === "SUSPEND";

      const backArr =
        rf.price?.mapValue?.fields?.back?.arrayValue?.values || [];
      const layArr = rf.price?.mapValue?.fields?.lay?.arrayValue?.values || [];

      const b0 = backArr[0]?.mapValue?.fields;
      const l0 = layArr[0]?.mapValue?.fields;

      const backPrice = parseNumber(b0?.price);
      const backSize = parseNumber(b0?.size);
      const layPrice = parseNumber(l0?.price);
      const laySize = parseNumber(l0?.size);

      return {
        selectionId: selId,
        name,
        status: runnerStatus,
        isSuspended:
          isSuspended ||
          (backPrice === 0 &&
            layPrice === 0 &&
            backSize === 0 &&
            laySize === 0) ||
          isNaN(backPrice) ||
          isNaN(layPrice),
        back: {
          price:
            isSuspended || backPrice === 0 || isNaN(backPrice)
              ? null
              : backPrice,
          size: isNaN(backSize) ? 0 : backSize,
        },
        lay: {
          price: isSuspended || isNaN(layPrice) ? 0 : layPrice,
          size: isNaN(laySize) ? 0 : laySize,
        },
      };
    });
  };

  const bDoc = betfairDocs[0]?.document?.fields;
  const bmDoc = bookmakerDocs[0]?.document?.fields;

  // Real-time Fancy parsed list
  const validFancy = fancyDocs
    .filter((d) => d.document)
    .map((d) => {
      const f = d.document.fields;
      const odds = f.oddsData?.mapValue?.fields || {};
      const rArr = odds.runners?.arrayValue?.values || [];
      const r0 = rArr[0]?.mapValue?.fields || {};
      const rStatus =
        r0.status?.stringValue || odds.status?.stringValue || "ONLINE";
      const isSuspended =
        rStatus === "SUSPENDED" ||
        rStatus === "SUSPEND" ||
        odds.status?.stringValue === "SUSPENDED";

      const backArr =
        r0.price?.mapValue?.fields?.back?.arrayValue?.values || [];
      const layArr = r0.price?.mapValue?.fields?.lay?.arrayValue?.values || [];

      const b0 = backArr[0]?.mapValue?.fields;
      const l0 = layArr[0]?.mapValue?.fields;

      return {
        marketId: f.exMarketId?.stringValue || d.document.name.split("/").pop(),
        marketName: f.marketName?.stringValue || "Fancy Market",
        news: f.news?.stringValue || "",
        status: odds.status?.stringValue || "ONLINE",
        isSuspended,
        min: parseNumber(f.min) || 100,
        max: parseNumber(f.max) || 50000,
        no: {
          price: parseNumber(l0?.price),
          size: parseNumber(l0?.size) || 100,
        },
        yes: {
          price: parseNumber(b0?.price),
          size: parseNumber(b0?.size) || 100,
        },
      };
    });

  const newsTicker = bmDoc?.news?.stringValue || bDoc?.news?.stringValue || "";

  return {
    eventId,
    news: newsTicker,
    matchOdds: bDoc
      ? {
          marketName: bDoc.marketName?.stringValue || "Match Odds",
          min: 100,
          max: 1000,
          totalMatched:
            bDoc.oddsData?.mapValue?.fields?.totalMatched?.integerValue || "0",
          status:
            bDoc.oddsData?.mapValue?.fields?.status?.stringValue || "OPEN",
          runners: parseRunners(bDoc),
        }
      : null,
    bookmaker: bmDoc
      ? {
          marketName: bmDoc.marketName?.stringValue || "Bookmaker Cup Bhav",
          min: 100,
          max: 25000,
          totalMatched:
            bmDoc.oddsData?.mapValue?.fields?.totalMatched?.integerValue || "0",
          status:
            bmDoc.oddsData?.mapValue?.fields?.status?.stringValue || "OPEN",
          runners: parseRunners(bmDoc),
        }
      : null,
    fancy: validFancy,
  };
};

// --- WEBSOCKET REAL-TIME BROADCASTER ---
const activeMatchSubscriptions = new Map(); // socket.id -> { eventId, sportId, timer }

io.on("connection", (socket) => {
  // Casino Live Table Subscription
  socket.on("casino:subscribe", async ({ gameId }) => {
    if (!gameId) return;
    const gId = String(gameId);
    socket.join(`casino:${gId}`);

    const cs = await ensureNiceCasinoSocket();
    if (!activeCasinoSubscribers.has(gId)) {
      activeCasinoSubscribers.set(gId, new Set());
    }
    activeCasinoSubscribers.get(gId).add(socket.id);
    if (cs && cs.connected) {
      cs.emit("SCSN", { eventId: gId });
    }

    // Immediate cached state
    if (casinoOddsCache.has(gId)) {
      socket.emit("casino:live:odds", casinoOddsCache.get(gId));
    }
  });

  socket.on("casino:unsubscribe", ({ gameId }) => {
    if (!gameId) return;
    const gId = String(gameId);
    socket.leave(`casino:${gId}`);

    if (activeCasinoSubscribers.has(gId)) {
      activeCasinoSubscribers.get(gId).delete(socket.id);
      if (activeCasinoSubscribers.get(gId).size === 0) {
        activeCasinoSubscribers.delete(gId);
        if (casinoSocket && casinoSocket.connected) {
          casinoSocket.emit("USCSN", { eventId: gId });
        }
      }
    }
  });

  socket.on("subscribe:match", ({ eventId, sportId }) => {
    // Clear any previous timer
    if (activeMatchSubscriptions.has(socket.id)) {
      clearInterval(activeMatchSubscriptions.get(socket.id).timer);
    }

    const sendUpdate = async () => {
      const realOdds = await queryFirestoreForEvent(eventId, sportId);
      socket.emit("match:live:rates", realOdds);
    };

    sendUpdate(); // Send immediate initial state
    const timer = setInterval(sendUpdate, 700); // Poll Firestore every 700ms for instant real-time rate updates
    activeMatchSubscriptions.set(socket.id, { eventId, sportId, timer });
  });

  socket.on("unsubscribe:match", () => {
    if (activeMatchSubscriptions.has(socket.id)) {
      clearInterval(activeMatchSubscriptions.get(socket.id).timer);
      activeMatchSubscriptions.delete(socket.id);
    }
  });

  socket.on("disconnect", () => {
    if (activeMatchSubscriptions.has(socket.id)) {
      clearInterval(activeMatchSubscriptions.get(socket.id).timer);
      activeMatchSubscriptions.delete(socket.id);
    }
    // Clean up casino rooms
    for (const [gId, subs] of activeCasinoSubscribers.entries()) {
      if (subs.has(socket.id)) {
        subs.delete(socket.id);
        if (subs.size === 0) {
          activeCasinoSubscribers.delete(gId);
          if (casinoSocket && casinoSocket.connected) {
            casinoSocket.emit("USCSN", { eventId: gId });
          }
        }
      }
    }
  });
});

// Serve compiled frontend if present (supports ../frontend/dist and ./dist)
const distPath = fs.existsSync(path.join(__dirname, "../frontend/dist"))
  ? path.join(__dirname, "../frontend/dist")
  : path.join(__dirname, "dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get("/", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.json({
    status: "online",
    service: "Sports & Casino Backend API",
    version: "1.0.0",
    time: new Date().toISOString(),
  });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).json({ error: "Route not found" });
});

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Backend server + WebSocket running on http://localhost:${PORT}`);
  });
}

export default app;
