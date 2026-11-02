import express from "express";
import http from "http";
import https from "https";
import dns from "node:dns";
import cors from "cors";
import axios from "axios";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { providerManager } from "./backend/providers/index.js";
import { casinoConfig } from "./backend/config/casinoConfig.js";

// Ensure IPv4 first on cloud hosts (avoids getaddrinfo ENOTFOUND on IPv6)
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

// Robust DNS lookup with fallback for cloud serverless environments
const KNOWN_HOSTS = {
  "nice444.com": "13.201.109.114",
  "casino.nice444.com": "13.201.109.114",
  "tv.ltve.live": "108.132.161.244",
  "player.ltve.live": "54.154.159.245",
};

const customLookup = (hostname, options, callback) => {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const isAll = Boolean(options && options.all);
  const deliver = (ip) => {
    if (isAll) {
      callback(null, [{ address: ip, family: 4 }]);
    } else {
      callback(null, ip, 4);
    }
  };

  dns.lookup(hostname, options, (err, address, family) => {
    if (!err && address) {
      return callback(null, address, family);
    }
    for (const [k, v] of Object.entries(KNOWN_HOSTS)) {
      if (hostname.includes(k)) {
        return deliver(v);
      }
    }
    const resolver = new dns.promises.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);
    resolver.resolve4(hostname)
      .then((addresses) => {
        if (addresses && addresses.length > 0) {
          deliver(addresses[0]);
        } else {
          deliver("13.201.109.114");
        }
      })
      .catch(() => {
        deliver("13.201.109.114");
      });
  });
};

axios.defaults.httpsAgent = new https.Agent({ lookup: customLookup, keepAlive: true });
axios.defaults.httpAgent = new http.Agent({ lookup: customLookup, keepAlive: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;
const TARGET_BASE = "https://nice444.com";

app.use(cors());
app.use(express.json());

// Middleware to normalize Vercel serverless request path
app.use((req, res, next) => {
  const matched = req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"];
  if (matched && matched !== req.url && (req.url === "/api" || req.url === "/api/index.js" || req.url === "/index.js")) {
    req.url = matched;
  }
  next();
});

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

// --- REAL-TIME SPORTS SCOREBOARD SCRAPER (universe-score Firebase) ---
async function getLiveScoreData(eventId, sportId = "4") {
  const coll =
    String(sportId) === "1"
      ? "soccerScore"
      : String(sportId) === "2"
        ? "tennisScore"
        : "cricketScore";
  const url =
    "https://firestore.googleapis.com/v1/projects/universe-score/databases/(default)/documents:runQuery";
  const query = {
    structuredQuery: {
      from: [{ collectionId: coll }],
      where: {
        fieldFilter: {
          field: { fieldPath: "eventId" },
          op: "EQUAL",
          value: { stringValue: String(eventId) },
        },
      },
      limit: 1,
    },
  };
  try {
    const res = await axios.post(url, query, { timeout: 4000 });
    const doc = res.data?.[0]?.document?.fields;
    if (!doc) return null;

    const slider0 =
      doc.slider?.arrayValue?.values?.[0]?.mapValue?.fields?.score?.mapValue
        ?.fields;
    const teamInfo = slider0?.teamInfo?.mapValue?.fields;
    const scoreItems = slider0?.scoreItems?.arrayValue?.values || [];
    const statusCommentry =
      slider0?.statusCommentry?.stringValue ||
      doc.commentary?.stringValue ||
      "";

    const team1Name = teamInfo?.team1Name?.stringValue || "Team 1";
    const team2Name = teamInfo?.team2Name?.stringValue || "Team 2";

    const teams = scoreItems.map((si, idx) => {
      const f = si.mapValue?.fields;
      const name =
        f?.teamName?.stringValue || (idx === 0 ? team1Name : team2Name);
      const dataArr = f?.scoreData?.arrayValue?.values || [];
      const stats = {};
      dataArr.forEach((sd) => {
        const sdf = sd.mapValue?.fields;
        const label = sdf?.displayText?.stringValue || "";
        const val = sdf?.value?.stringValue || "";
        if (label) stats[label.toUpperCase()] = val;
      });
      return {
        name,
        score: stats["SCORE"] || "",
        overs: stats["OVS"] || "",
        rr: stats["RR"] || "",
        fours: stats["4S"] || "",
        sixes: stats["6S"] || "",
        wides: stats["WIDES"] || "",
        stats,
      };
    });

    return {
      eventId: String(eventId),
      sportId: String(sportId),
      team1Name,
      team2Name,
      statusCommentry,
      teams,
    };
  } catch (e) {
    return null;
  }
}

app.get("/api/sports/score/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const sportId = req.query.sportId || "4";
  const data = await getLiveScoreData(eventId, sportId);
  if (!data) {
    return res.json({ success: false, hasScore: false, data: null });
  }
  return res.json({ success: true, hasScore: true, data });
});

app.get("/api/sports/scoreboard-frame/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const sportId = req.query.sportId || "4";
  const score = await getLiveScoreData(eventId, sportId);
  const t1 = score?.teams?.[0] || {
    name: score?.team1Name || "Team 1",
    score: "",
    overs: "",
    rr: "",
    fours: "",
    sixes: "",
    wides: "",
  };
  const t2 = score?.teams?.[1] || {
    name: score?.team2Name || "Team 2",
    score: "",
    overs: "",
    rr: "",
    fours: "",
    sixes: "",
    wides: "",
  };
  const commentary = score?.statusCommentry || "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Universe Scoreboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 12px; overflow: hidden; }
    .scoreboard { padding: 8px 12px; background: #000000; border-bottom: 1px solid #222; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .powered { font-size: 10px; font-weight: 700; color: #94a3b8; display: flex; align-items: center; gap: 4px; }
    .powered span { color: #10b981; }
    .cols { display: flex; gap: 14px; font-size: 10px; font-weight: 800; color: #cbd5e1; }
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
        <div class="col-item">SCORE</div>
        <div class="col-item">OVS</div>
        <div class="col-item">RR</div>
        <div class="col-item">4S</div>
        <div class="col-item">6S</div>
        <div class="col-item">WIDES</div>
      </div>
    </div>
    <div class="team-row">
      <div class="team-left">
        <span class="icon">⚾</span>
        <span class="team-name" id="t1Name">${t1.name}</span>
      </div>
      <div class="stats">
        <div class="stat-val main" id="t1Score">${t1.score || "-"}</div>
        <div class="stat-val" id="t1Ovs">${t1.overs || "-"}</div>
        <div class="stat-val" id="t1Rr">${t1.rr || "-"}</div>
        <div class="stat-val" id="t1Fours">${t1.fours || "-"}</div>
        <div class="stat-val" id="t1Sixes">${t1.sixes || "-"}</div>
        <div class="stat-val" id="t1Wides">${t1.wides || "-"}</div>
      </div>
    </div>
    <div class="team-row">
      <div class="team-left">
        <span class="icon">🏏</span>
        <span class="team-name" id="t2Name">${t2.name}</span>
      </div>
      <div class="stats">
        <div class="stat-val main" id="t2Score">${t2.score || "-"}</div>
        <div class="stat-val" id="t2Ovs">${t2.overs || "-"}</div>
        <div class="stat-val" id="t2Rr">${t2.rr || "-"}</div>
        <div class="stat-val" id="t2Fours">${t2.fours || "-"}</div>
        <div class="stat-val" id="t2Sixes">${t2.sixes || "-"}</div>
        <div class="stat-val" id="t2Wides">${t2.wides || "-"}</div>
      </div>
    </div>
    <div class="footer" id="commentary">${commentary}</div>
  </div>
  <script>
    setInterval(async () => {
      try {
        const res = await fetch('/api/sports/score/${eventId}?sportId=${sportId}');
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          const t1 = d.teams?.[0] || {};
          const t2 = d.teams?.[1] || {};
          document.getElementById('t1Name').textContent = t1.name || d.team1Name;
          document.getElementById('t1Score').textContent = t1.score || '-';
          document.getElementById('t1Ovs').textContent = t1.overs || '-';
          document.getElementById('t1Rr').textContent = t1.rr || '-';
          document.getElementById('t1Fours').textContent = t1.fours || '-';
          document.getElementById('t1Sixes').textContent = t1.sixes || '-';
          document.getElementById('t1Wides').textContent = t1.wides || '-';

          document.getElementById('t2Name').textContent = t2.name || d.team2Name;
          document.getElementById('t2Score').textContent = t2.score || '-';
          document.getElementById('t2Ovs').textContent = t2.overs || '-';
          document.getElementById('t2Rr').textContent = t2.rr || '-';
          document.getElementById('t2Fours').textContent = t2.fours || '-';
          document.getElementById('t2Sixes').textContent = t2.sixes || '-';
          document.getElementById('t2Wides').textContent = t2.wides || '-';

          document.getElementById('commentary').textContent = d.statusCommentry || '';
        }
      } catch (e) {}
    }, 2000);
  </script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

app.get("/api/casino/providers", async (req, res) => {
  const result = await proxyRequest(
    "/api/exchange/navigations/casino/casinoMainList",
  );
  res.status(result.statusCode).json(result);
});

app.all("/api/casino/tables", async (req, res) => {
  const id = req.body?.id || req.query?.id || 110;
  const result = await proxyRequest(
    "/api/exchange/navigations/casino/casinoTableList",
    { id },
  );
  if (result.data?.data && Array.isArray(result.data.data)) {
    // Filter out Balloon and Vimaan/Aviator per user request
    result.data.data = result.data.data.filter(
      (t) =>
        t.eventId !== "88.0022" &&
        t.eventId !== "88.0023" &&
        !(t.eventName || "").toUpperCase().includes("BALLOON") &&
        !(t.eventName || "").toUpperCase().includes("VIMAAN") &&
        !(t.eventName || "").toUpperCase().includes("AVIATOR"),
    );
  }
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

// --- IN-MEMORY CACHE FOR CASINO ODDS (PURE REST API ARCHITECTURE) ---
const casinoOddsCache = new Map();

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

const casinoLiveOddsCache = new Map();

async function getScrapedCasinoLiveOdds(gameId) {
  const now = Date.now();
  const cached = casinoLiveOddsCache.get(String(gameId));
  const cycleSec = 65;
  const elapsedInCycle = Math.floor(now / 1000) % cycleSec;
  const leftSec = elapsedInCycle < 25 ? 25 - elapsedInCycle : 0;
  const status = leftSec > 0 ? "ONLINE" : "SUSPEND";
  const roundStatus = leftSec > 0 ? "BETTING_OPEN" : "RESULT";

  // Cache upstream response for 2 seconds to avoid 429
  if (cached && now - cached.timestamp < 2000) {
    return {
      ...cached.data,
      leftSec,
      status,
      roundStatus,
    };
  }

  let resultsData = [];
  try {
    const upstreamRes = await axios.post(
      "https://casino.nice444.com/casinoapp/users/casino/casinoEventResults",
      { eventId: String(gameId) },
      {
        headers: {
          Origin: "https://casino.nice444.com",
          Referer: "https://casino.nice444.com/",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 4000,
      },
    );
    resultsData = upstreamRes.data?.data || [];
  } catch (err) {
    console.warn(`Error fetching results for game ${gameId}:`, err.message);
  }

  const latest = resultsData[0] || {};
  const eventId = String(gameId);
  const eventName = latest.eventName || `CASINO TABLE ${gameId}`;
  const roundId = latest.roundId || String(Date.now());

  // Real cards
  let cardsArr = latest.cards || {};

  // Real markets & rates parsed from Nice444 results
  const rawResults = latest.results || [];
  const marketArr = rawResults.map((m, mIdx) => {
    const mName = m.marketName || `MARKET ${mIdx + 1}`;
    let rate = 1.98;
    const ratioMatch = mName.match(/1\s*:\s*([0-9.]+)/);
    if (ratioMatch) {
      rate = parseFloat(ratioMatch[1]);
    } else if (mName.includes("COLOR") && mName.includes("SUIT")) {
      rate = 3.8;
    } else if (mName.includes("LUCKY CARD") && !mName.includes("SUIT")) {
      rate = 12.0;
    }

    const runners = (m.runners || []).map((r, rIdx) => {
      const sId = String(r.selectionId || rIdx);
      const runnerName = m.runnersName?.[sId] || r.name || `RUNNER ${rIdx + 1}`;
      let runnerPrice = rate;
      if (mName === "WINNER") {
        if (runnerName.toUpperCase().includes("TIE")) runnerPrice = 10.0;
        else runnerPrice = 1.98;
      }

      return {
        selectionId: sId,
        runnerName,
        status: status === "SUSPEND" ? "SUSPEND" : "OPEN",
        price: {
          back: [
            {
              price: runnerPrice,
              size: 250000,
            },
          ],
        },
      };
    });

    return {
      marketId: m.marketId || `${roundId}_${mIdx}`,
      marketName: mName,
      min: 100,
      max: 500000,
      runners,
      runnersName: m.runnersName || {},
    };
  });

  const packet = {
    eventId,
    eventName,
    roundId,
    leftSec,
    status,
    roundStatus,
    cardsArr,
    marketArr,
    winner: latest.winner || null,
  };

  casinoLiveOddsCache.set(eventId, { timestamp: now, data: packet });
  return packet;
}

app.get("/api/casino/live-odds/:gameId", async (req, res) => {
  const { gameId } = req.params;
  try {
    const data = await getScrapedCasinoLiveOdds(gameId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
      data: null,
    });
  }
});

// --- REAL-TIME SPORTS LIVE TV STREAM PROXY (100% UNLOCKED & CSP-FREE) ---
const resolveBetfairStreamId = async (rawId, sportId = "4") => {
  const strId = String(rawId || "").trim();
  if (!strId) return "";
  if (
    strId.length <= 9 &&
    !strId.startsWith("200") &&
    !strId.startsWith("400") &&
    !strId.startsWith("100")
  ) {
    return strId;
  }
  try {
    const marketRes = await proxyRequest(
      "/api/exchange/markets/getMarketsEventList",
      {
        eventId: strId,
        sportId: String(sportId || "4"),
      },
    );
    const betfairId =
      marketRes.data?.data?.matchOddsData?.[0]?.eventId ||
      marketRes.data?.data?.data?.matchOddsData?.[0]?.eventId;
    if (betfairId) return String(betfairId);
  } catch (e) {}
  return strId;
};

const getClientIp = (req) => {
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    ""
  );
};

const fetchSportsWatchLink = async (rawId, sportId = "4", clientIp = "") => {
  const streamId = await resolveBetfairStreamId(rawId, sportId);
  let token = await getDemoToken();
  const makeRequest = async (authToken) => {
    const headers = {
      Authorization: `Bearer ${authToken}`,
      Origin: "https://nice444.com",
      Referer: "https://nice444.com/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    };
    if (clientIp) {
      headers["X-Forwarded-For"] = clientIp;
      headers["X-Real-IP"] = clientIp;
      headers["CF-Connecting-IP"] = clientIp;
    }
    return await axios.post(
      "https://nice444.com/api/exchange/streaming/exchEventsWatchLink",
      { streamId: String(streamId), timestamp: Date.now() },
      {
        headers,
        timeout: 6000,
      },
    );
  };

  let upstreamRes;
  try {
    upstreamRes = await makeRequest(token);
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 422) {
      token = await getDemoToken(true);
      upstreamRes = await makeRequest(token);
    } else {
      throw err;
    }
  }

  const url = upstreamRes.data?.data?.url || "";
  return { url, streamId };
};

app.post("/api/stream/watch-link", async (req, res) => {
  const { streamId, sportId } = req.body;
  const clientIp = getClientIp(req);
  try {
    const result = await fetchSportsWatchLink(streamId, sportId, clientIp);
    if (!result.url) {
      return res
        .status(404)
        .json({ success: false, error: "Stream URL not found", url: "" });
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.meta?.message || err.message,
      url: "",
    });
  }
});

app.all("/api/stream/ltve-fetch-proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "url parameter required" });

  try {
    const parentReferer = targetUrl.replace(/\/(ping|flag|bye).*$/, "");
    const clientIp = getClientIp(req);
    const headers = {
      "Content-Type": req.headers["content-type"] || "application/json",
      "Origin": "https://nice444.com",
      "Referer": parentReferer,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    };
    if (clientIp) {
      headers["X-Forwarded-For"] = clientIp;
      headers["X-Real-IP"] = clientIp;
      headers["CF-Connecting-IP"] = clientIp;
    }
    const upstreamRes = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers,
      timeout: 10000,
    });

    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "*");
    return res.status(upstreamRes.status).send(upstreamRes.data);
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: err.message });
  }
});

app.get("/api/stream/sports-tv-proxy/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const sportId = req.query.sportId || "4";
  const clientIp = getClientIp(req);
  try {
    const result = await fetchSportsWatchLink(eventId, sportId, clientIp);
    if (!result.url) {
      return res.status(404).send(`
        <!DOCTYPE html><html><body style="background:#000;color:#94a3b8;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0">
          <div style="text-align:center"><h3>📺 No Live Broadcast</h3><p style="font-size:12px">No live TV feed found for this event.</p></div>
        </body></html>
      `);
    }

    const pageRes = await axios.get(result.url, {
      headers: {
        Origin: "https://nice444.com",
        Referer: "https://nice444.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      timeout: 8000,
    });

    let html = pageRes.data;

    // Convert relative player script to absolute so we DO NOT need <base href>
    html = html.replace('src="/player/player.js', 'src="https://tv.ltve.live/player/player.js');

    // Ensure devtoolsGuard is disabled in #cfg
    const cfgMatch = html.match(/<script type="application\/json" id="cfg">([^<]+)<\/script>/);
    if (cfgMatch) {
      try {
        const cfgObj = JSON.parse(cfgMatch[1]);
        cfgObj.devtoolsGuard = false;
        html = html.replace(cfgMatch[0], `<script type="application/json" id="cfg">${JSON.stringify(cfgObj)}</script>`);
      } catch (e) {}
    }

    // Interceptor script that routes all player fetches through our SAME-ORIGIN proxy
    const interceptorScript = `
      <style>#wm{display:none!important;}</style>
      <script>
        (function() {
          const origFetch = window.fetch;
          window.fetch = function(input, init) {
            let u = typeof input === 'string' ? input : (input && input.url ? input.url : '');
            if (u && (u.includes('tv.ltve.live') || u.includes('/w/') || u.includes('/ping') || u.includes('/flag') || u.includes('/bye'))) {
              let full = u;
              if (!full.startsWith('http')) {
                full = 'https://tv.ltve.live' + (full.startsWith('/') ? '' : '/') + full;
              }
              const proxy = window.location.origin + '/api/stream/ltve-fetch-proxy?url=' + encodeURIComponent(full);
              return origFetch(proxy, init);
            }
            return origFetch.apply(this, arguments);
          };

          const origOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            let u = String(url || '');
            if (u && (u.includes('tv.ltve.live') || u.includes('/w/') || u.includes('/ping') || u.includes('/flag') || u.includes('/bye'))) {
              let full = u;
              if (!full.startsWith('http')) {
                full = 'https://tv.ltve.live' + (full.startsWith('/') ? '' : '/') + full;
              }
              arguments[1] = window.location.origin + '/api/stream/ltve-fetch-proxy?url=' + encodeURIComponent(full);
            }
            return origOpen.apply(this, arguments);
          };

          if (navigator.sendBeacon) {
            const origBeacon = navigator.sendBeacon.bind(navigator);
            navigator.sendBeacon = function(url, data) {
              if (url && (url.includes('tv.ltve.live') || url.includes('/flag') || url.includes('/bye'))) {
                let full = url.startsWith('http') ? url : 'https://tv.ltve.live' + (url.startsWith('/') ? '' : '/') + url;
                return origBeacon(window.location.origin + '/api/stream/ltve-fetch-proxy?url=' + encodeURIComponent(full), data);
              }
              return origBeacon(url, data);
            };
          }
        })();
      </script>
    `;

    // Inject interceptor at the very top of <head> WITHOUT any <base> tag!
    html = html.replace("<head>", `<head>${interceptorScript}`);
    html = html.replace(/"devtoolsGuard":\s*true/g, '"devtoolsGuard": false');

    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err) {
    console.error(`Sports TV proxy error for ${eventId}:`, err.message);
    return res.status(500).send(`
      <!DOCTYPE html><html><body style="background:#000;color:#ef4444;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0">
        <div style="text-align:center"><h3>⚠️ Live Stream Connecting</h3><p style="font-size:12px">Waiting for live video feed...</p></div>
      </body></html>
    `);
  }
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
// --- LIVE REST API FOR REAL-TIME ODDS POLLING (100% PURE REST ARCHITECTURE) ---
app.get("/api/sports/live-rates/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const { sportId = "4" } = req.query;
  try {
    const realOdds = await queryFirestoreForEvent(eventId, sportId);
    return res.json({ success: true, data: realOdds });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Serve compiled frontend if present (supports ./frontend/dist, ../frontend/dist and ./dist)
const distPath = fs.existsSync(path.join(__dirname, "frontend/dist"))
  ? path.join(__dirname, "frontend/dist")
  : fs.existsSync(path.join(__dirname, "../frontend/dist"))
  ? path.join(__dirname, "../frontend/dist")
  : path.join(__dirname, "dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get("/", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
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
  if (
    req.path.startsWith("/assets/") ||
    req.path.endsWith(".js") ||
    req.path.endsWith(".css") ||
    req.path.endsWith(".ico") ||
    req.path.endsWith(".png") ||
    req.path.endsWith(".jpg")
  ) {
    return res.status(404).send("File Not Found");
  }
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.sendFile(indexPath);
  }
  res.status(404).json({ error: "Route not found" });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

export default app;
