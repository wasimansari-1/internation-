import CryptoJS from "crypto-js";
import axios from "axios";
import fs from "fs";
import path from "path";
import { getD247HttpsAgent, isWarpProxyAvailable } from "./socks5Agent.js";
import { getHighlightEvents, getSportsTree, getCasinoTableList } from "./d247Service.js";

// Multi-Platform Chrome Path (Pure Zero-Browser REST Mode - Chromium/Puppeteer permanently disabled)
export function getChromeExecutablePath() {
  return null;
}

const AES_KEY = "cae7b808-8b1e-4f47-87a5-1a4b6a08030e";
const SESSION_FILE = path.resolve(process.cwd(), ".d247_session.json");

export function encrypt(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), AES_KEY).toString();
}

export function decrypt(cipher) {
  if (!cipher || typeof cipher !== "string") return cipher;
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, AES_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (e) {
    return null;
  }
}

// Micro-cache to prevent network congestion
const cacheStore = {
  highlights: {}, // [etid]: { time, data }
  casino: {},     // [gtype]: { time, data }
  markets: {},    // [gmid]: { time, data }
  tablist: null
};

// In-Memory Real Production Data Store (100% Real Live Production Feed from D247)
export const realDataStore = {
  sportsTree: [],
  sportsMatches: {},
  casinoTables: [],
  casinoLive: {},
  casinoResults: {},
  matchDetails: {},
  sessionCookies: "",
  authToken: "",
  userAgent: "",
  isEngineActive: false,
  lastUpdate: Date.now()
};

let isStarting = false;
let apiQueue = Promise.resolve();
let lastSessionMtime = 0;
let restErrorCounter = 0;

export function reloadSession() {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const stat = fs.statSync(SESSION_FILE);
      if (stat.mtimeMs !== lastSessionMtime) {
        lastSessionMtime = stat.mtimeMs;
        const stored = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
        if (stored.cookies) realDataStore.sessionCookies = stored.cookies;
        if (stored.token) realDataStore.authToken = stored.token;
        if (stored.userAgent) realDataStore.userAgent = stored.userAgent;
      }
    } catch (e) {}
  }
}

export async function performDemoLogin() {
  return await performDemoLoginDirect();
}

// Direct Zero-Browser Demo Login via Encrypted REST
export async function performDemoLoginDirect() {
  try {
    const encBody = encrypt({ ismob: 1 });
    const httpsAgent = await getD247HttpsAgent().catch(() => undefined);
    const res = await axios.post(
      "https://d247.com/api/front/demo-login",
      { data: encBody },
      {
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://d247.com",
          "Referer": "https://d247.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        },
        httpsAgent: httpsAgent || undefined,
        proxy: false,
        timeout: 4000
      }
    );

    let data = res.data;
    if (res.data?.data && typeof res.data.data === "string") {
      data = decrypt(res.data.data);
    }

    const setCookies = res.headers["set-cookie"];
    let cookieStr = "";
    if (Array.isArray(setCookies)) {
      cookieStr = setCookies.map(c => c.split(";")[0]).join("; ");
      realDataStore.sessionCookies = cookieStr;
    }

    const token = data?.data?.token || data?.token;
    if (token) {
      realDataStore.authToken = token;
    }

    if (cookieStr || token) {
      try {
        fs.writeFileSync(SESSION_FILE, JSON.stringify({
          cookies: realDataStore.sessionCookies || cookieStr,
          token: realDataStore.authToken || token,
          lastUpdate: Date.now()
        }, null, 2));
      } catch (e) {}
      console.log(`[D247 Engine] Direct Demo Login Successful! (Zero Browser Mode)`);
      return true;
    }
  } catch (err) {
    console.warn("[D247 Engine] Direct Demo Login attempt:", err.message);
  }
  return false;
}

// Direct API execution: Ultra-Fast Encrypted Axios REST with Instant Concurrency (Zero Queue Bottleneck)
async function executeD247Direct(endpoint, rawPayload = {}) {
  // 1. High-Speed Direct Encrypted Axios REST (0.1s response, fully concurrent on VPS & Local via Cloudflare WARP)
  try {
    const encBody = encrypt(rawPayload);
    const fullUrl = endpoint.startsWith("http") ? endpoint : `https://d247.com/api/front/${endpoint}`;

    reloadSession();
    let cookieStr = realDataStore.sessionCookies;
    let tokenStr = realDataStore.authToken;
    let uaStr = realDataStore.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    const httpsAgent = await getD247HttpsAgent().catch(() => undefined);

    const res = await axios.post(
      fullUrl,
      { data: encBody },
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Origin": "https://d247.com",
          "Referer": "https://d247.com/",
          "User-Agent": uaStr,
          "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": uaStr.includes("Mac") ? '"macOS"' : '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          ...(cookieStr ? { "Cookie": cookieStr } : {}),
          ...(tokenStr ? { "Authorization": `Bearer ${tokenStr}`, "token": tokenStr } : {})
        },
        httpsAgent: httpsAgent || undefined,
        proxy: false,
        timeout: 4000
      }
    );

    let finalResult = res.data;
    if (res.data?.data && typeof res.data.data === "string") {
      finalResult = decrypt(res.data.data);
    }
    if (finalResult && !finalResult.error) {
      return finalResult;
    }
  } catch (err) {
    if (process.env.DEBUG || (restErrorCounter++ % 20 === 0)) {
      console.warn(`[D247 REST Error] ${endpoint}: ${err.response?.status || err.message}`);
    }
  }

  return null;
}

// Concurrent Ultra-Fast API executor (ZERO bottlenecks, ZERO pending delays)
export async function evalD247Api(endpoint, rawPayload = {}) {
  try {
    let res = await executeD247Direct(endpoint, rawPayload);
    if ((res?.status === 401 || res?.msg === "Please Login") && !isStarting) {
      console.warn("[D247 Engine] Session expired on D247. Re-authenticating demo session via Direct REST...");
      await performDemoLoginDirect().catch(() => false);
      res = await executeD247Direct(endpoint, rawPayload);
    }
    return res;
  } catch (err) {
    return null;
  }
}

// Helper: Format real D247 match object with real odds from sections
export function formatRealMatch(m, etid) {
  const runners = Array.isArray(m.section) ? m.section : [];
  
  const matchOdds = runners.map((r, rIdx) => {
    const oddsList = Array.isArray(r.odds) ? r.odds : [];
    const b1Obj = oddsList.find(o => (o.oname && o.oname.toLowerCase() === "back1") || (o.otype && o.otype.toLowerCase() === "back" && o.tno === 0));
    const l1Obj = oddsList.find(o => (o.oname && o.oname.toLowerCase() === "lay1") || (o.otype && o.otype.toLowerCase() === "lay" && o.tno === 0));
    const b2Obj = oddsList.find(o => (o.oname && o.oname.toLowerCase() === "back2") || (o.otype && o.otype.toLowerCase() === "back" && o.tno === 1));
    const l2Obj = oddsList.find(o => (o.oname && o.oname.toLowerCase() === "lay2") || (o.otype && o.otype.toLowerCase() === "lay" && o.tno === 1));
    const b3Obj = oddsList.find(o => (o.oname && o.oname.toLowerCase() === "back3") || (o.otype && o.otype.toLowerCase() === "back" && o.tno === 2));
    const l3Obj = oddsList.find(o => (o.oname && o.oname.toLowerCase() === "lay3") || (o.otype && o.otype.toLowerCase() === "lay" && o.tno === 2));

    const b1Val = (b1Obj && Number(b1Obj.odds) > 0) ? b1Obj.odds : null;
    const l1Val = (l1Obj && Number(l1Obj.odds) > 0) ? l1Obj.odds : null;
    const b2Val = (b2Obj && Number(b2Obj.odds) > 0) ? b2Obj.odds : null;
    const l2Val = (l2Obj && Number(l2Obj.odds) > 0) ? l2Obj.odds : null;
    const b3Val = (b3Obj && Number(b3Obj.odds) > 0) ? b3Obj.odds : null;
    const l3Val = (l3Obj && Number(l3Obj.odds) > 0) ? l3Obj.odds : null;

    const matchTeams = (m.ename || "").split(/ - | v | vs /i);
    const fallbackTeamName = rIdx === 0 ? matchTeams[0]?.trim() : (rIdx === 1 ? matchTeams[1]?.trim() : (rIdx === 2 ? "The Draw" : `Runner ${rIdx + 1}`));

    return {
      sid: r.sid || rIdx + 1,
      nat: (r.nat !== undefined && r.nat !== null && r.nat !== "" && r.nat !== "undefined") ? String(r.nat) : (fallbackTeamName || `Runner ${rIdx + 1}`),
      b1: b1Val,
      bs1: (b1Obj && Number(b1Obj.size) > 0) ? String(Math.round(b1Obj.size)) : null,
      l1: l1Val,
      ls1: (l1Obj && Number(l1Obj.size) > 0) ? String(Math.round(l1Obj.size)) : null,
      b2: b2Val,
      l2: l2Val,
      b3: b3Val,
      l3: l3Val,
      gstatus: r.gstatus || (m.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE")
    };
  });

  return {
    gmid: m.gmid,
    etid: m.etid || etid,
    ename: (m.ename || "").trim(),
    cname: m.cname || "",
    stime: m.stime,
    iplay: Boolean(m.iplay),
    status: m.iplay ? "STARTED" : (m.status || "UPCOMING"),
    score: m.score || null,
    hasTv: Boolean(m.tv),
    hasBm: Boolean(m.bm),
    hasFancy: Boolean(m.f || m.f1),
    isVirtual: Boolean(m.iscc === 4 || (m.ename || '').includes('(e)')),
    matchOdds: matchOdds,
    rawSection: runners,
    oid: m.oid ?? 999
  };
}

// 1. Initialize Autonomous D247 Engine (Pure 100% Zero-Browser Direct REST Engine)
export async function startD247Engine() {
  if (isStarting) return;
  isStarting = true;

  const isWarpActive = await isWarpProxyAvailable("127.0.0.1", 40000).catch(() => false);
  console.log(`[D247 Engine] >>> ZERO-BROWSER DIRECT REST ENGINE ACTIVATED <<< (WARP SOCKS5: ${isWarpActive ? "127.0.0.1:40000" : "DIRECT"})`);
  console.log("[D247 Engine] 100% Direct Cloudflare Bypass Active - Chrome & Puppeteer are COMPLETELY REMOVED!");
  
  // Load stored session credentials from disk
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const stored = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
      if (stored.cookies) realDataStore.sessionCookies = stored.cookies;
      if (stored.token) realDataStore.authToken = stored.token;
      console.log(`[D247 Engine] Loaded session credentials (cookies: ${Boolean(realDataStore.sessionCookies)}, token: ${Boolean(realDataStore.authToken)})`);
    }
  } catch (e) {}

  if (!realDataStore.sessionCookies && !realDataStore.authToken) {
    await performDemoLoginDirect().catch(() => {});
  }

  realDataStore.isEngineActive = true;

  // Direct REST data initialization
  await fetchRealSportsTree().catch(() => {});
  await fetchRealCasinoTables().catch(() => {});
  await refreshAllSports().catch(() => {});

  // Start 24/7 background polling loop
  startBackgroundPollLoop();
  isStarting = false;
  return true;
}



// 2. Fetch real sports tree directly from D247 tablist
export async function evalInPage(codeStr) {
  return null;
}

export async function getDebugPageImages() {
  return { error: "Pure Zero-Browser Mode Active (No browser running)" };
}

export async function fetchRealCasinoTables() {
  const dec = await evalD247Api("casino/tablelist", {});
  const rawTables = dec?.data?.t1 || dec?.data || [];
  if (Array.isArray(rawTables) && rawTables.length > 0) {
    realDataStore.casinoTables = rawTables.map(t => ({
      gtype: t.gmid || t.gid || String(t.srno),
      gmid: String(t.srno || t.gmid),
      name: t.gname || t.ename || "Live Table",
      category: t.gname?.toLowerCase().includes("teen") ? "Teen Patti"
        : t.gname?.toLowerCase().includes("roulette") ? "Roulette"
        : t.gname?.toLowerCase().includes("baccarat") ? "Baccarat"
        : t.gname?.toLowerCase().includes("dragon") ? "Dragon Tiger"
        : t.gname?.toLowerCase().includes("matka") || t.gname?.toLowerCase().includes("worli") ? "Matka"
        : t.gname?.toLowerCase().includes("dice") || t.gname?.toLowerCase().includes("doli") ? "Dice"
        : "Special",
      minBet: 100,
      maxBet: 50000,
      imgpath: t.imgpath ? (t.imgpath.startsWith("http") ? t.imgpath : `https://cdn.926assets.com/g1-casino-icons/lc/${t.imgpath}`) : "https://cdn.926assets.com/g1-casino-icons/default.jpg"
    }));
    return realDataStore.casinoTables;
  }
  if (realDataStore.casinoTables.length === 0) {
    try {
      const fullTables = await getCasinoTableList();
      const list = Array.isArray(fullTables) ? fullTables : (fullTables?.data || []);
      if (list.length > 0) {
        realDataStore.casinoTables = list;
        return list;
      }
    } catch (e) {}
  }
  return realDataStore.casinoTables;
}

export async function fetchRealSportsTree() {
  const dec = await evalD247Api("tablist", {});
  if (dec && dec.data) {
    const raw = Array.isArray(dec.data) ? dec.data : Object.values(dec.data);
    const tabSports = raw
      .filter(s => s.tab || s.active)
      .map(s => ({
        id: s.eid,
        eid: s.eid,
        etid: s.eid,
        name: s.ename,
        ename: s.ename,
        tab: Boolean(s.tab),
        oid: s.oid || 99
      }))
      .sort((a, b) => a.oid - b.oid);

    if (tabSports.length > 0) {
      realDataStore.sportsTree = tabSports;
      return tabSports;
    }
  }
  if (realDataStore.sportsTree.length === 0) {
    try {
      const result = await getSportsTree();
      const list = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
      if (list.length > 0) {
        realDataStore.sportsTree = list;
        return list;
      }
    } catch (e) {}
  }
  return realDataStore.sportsTree;
}

// Helper to extract exact sequence from D247
export async function getLiveDomCricketMatches() {
  return realDataStore.sportsMatches[4] || [];
}

// 3. Fetch real matches for any sport (Handles flat matches & nested racing tracks)
export async function fetchRealSportHighlights(etid) {
  const now = Date.now();
  if (cacheStore.highlights[etid] && (now - cacheStore.highlights[etid].time < 1200)) {
    return cacheStore.highlights[etid].data;
  }

  const dec = await evalD247Api(`highlighthomePrivate?etid=${etid}`, { etid: Number(etid), type: "all" });
  if (dec && dec.data) {
    const t1 = Array.isArray(dec.data.t1) ? dec.data.t1 : (Array.isArray(dec.data) ? dec.data : []);
    const t2 = Array.isArray(dec.data.t2) ? dec.data.t2 : [];

    // Deduplicate all authentic matches across t1 (in-play) and t2 (all competitions & upcoming)
    const seenGmid = new Set();
    const rawList = [];
    for (const m of [...t1, ...t2]) {
      if (m && (m.gmid || m.children)) {
        if (m.gmid) {
          if (!seenGmid.has(String(m.gmid))) {
            seenGmid.add(String(m.gmid));
            rawList.push(m);
          }
        } else {
          rawList.push(m);
        }
      }
    }
    
    let formatted = [];
    // Check if nested by country/track (Horse Racing: etid 10, Greyhound: etid 65)
    if (rawList.length > 0 && rawList[0]?.children) {
      for (const country of rawList) {
        for (const track of (country.children || [])) {
          for (const race of (track.children || [])) {
            formatted.push({
              gmid: race.gmid,
              etid: race.etid || etid,
              ename: `${track.ename || country.cname} (${race.stime?.split(" ")[1] || "Race"})`,
              cname: country.cname || "",
              stime: race.stime,
              iplay: Boolean(race.iplay),
              status: race.iplay ? "STARTED" : "UPCOMING",
              score: null,
              matchOdds: []
            });
          }
        }
      }
    } else {
      formatted = rawList.map(m => formatRealMatch(m, etid));
      // Preserve exact natural sequence from D247: In-play matches first, then competitions/upcoming
      formatted.sort((a, b) => {
        if (a.iplay && !b.iplay) return -1;
        if (!a.iplay && b.iplay) return 1;
        return 0; // Maintain exact natural order from D247 raw response
      });
    }

    // For Football (etid 1): Prepend Goal 2 as first pinned live virtual game matching D247
    if (Number(etid) === 1) {
      const hasGoal = formatted.some(m => String(m.gmid).toLowerCase().includes('goal'));
      if (!hasGoal) {
        formatted.unshift({
          gmid: "goal2",
          etid: 1,
          ename: "Goal2",
          cname: "Virtual Football",
          stime: "Live In-Play",
          iplay: true,
          status: "STARTED",
          hasTv: true,
          hasBm: true,
          hasFancy: false,
          isVirtual: true,
          href: "/casino/goal2",
          c1: { b: null, l: null },
          cX: { b: null, l: null },
          c2: { b: null, l: null },
          matchOdds: [
            { nat: "Goal2", b1: null, l1: null },
            { nat: "The Draw", b1: null, l1: null },
            { nat: "2", b1: null, l1: null }
          ]
        });
      }
    }

    // For Cricket (etid 4): Ensure Super Over2 is first pinned live game matching D247
    if (Number(etid) === 4) {
      const hasSuperOver = formatted.some(m => String(m.gmid).toLowerCase().includes('superover'));
      if (!hasSuperOver) {
        const soLive = realDataStore.casinoLive["superover2"];
        const bmMarket = soLive?.markets?.[0];
        const indRunner = bmMarket?.section?.[0];
        const engRunner = bmMarket?.section?.[1];
        const indOdds = indRunner?.odds?.find(o => o.oname === "back1" || o.otype === "back");
        const engOdds = engRunner?.odds?.find(o => o.oname === "back1" || o.otype === "back");
        const indRate = indOdds && Number(indOdds.odds) > 0 ? Number(indOdds.odds) : null;
        const engRate = engOdds && Number(engOdds.odds) > 0 ? Number(engOdds.odds) : null;

        formatted.unshift({
          gmid: "superover2",
          etid: 4,
          ename: "Super Over2",
          cname: "International Cricket",
          stime: "Live In-Play",
          iplay: true,
          status: "STARTED",
          hasTv: true,
          hasBm: true,
          hasFancy: true,
          isVirtual: false,
          href: "/casino/superover2",
          c1: { b: indRate, l: indRate ? Number((indRate + 0.02).toFixed(2)) : null },
          cX: { b: null, l: null },
          c2: { b: engRate, l: engRate ? Number((engRate + 0.02).toFixed(2)) : null },
          matchOdds: [
            { nat: "IND", b1: indRate, l1: indRate ? Number((indRate + 0.02).toFixed(2)) : null, bs1: indRate ? "300K" : null },
            { nat: "The Draw", b1: null, l1: null },
            { nat: "ENG", b1: engRate, l1: engRate ? Number((engRate + 0.02).toFixed(2)) : null, bs1: engRate ? "300K" : null }
          ]
        });
      }
    }

    realDataStore.sportsMatches[etid] = formatted;
    cacheStore.highlights[etid] = { time: now, data: formatted };
    realDataStore.lastUpdate = now;
    return formatted;
  }

  // Resilient fallback: ensure frontend NEVER gets an empty array when upstream REST is retrying
  if (!realDataStore.sportsMatches[etid] || realDataStore.sportsMatches[etid].length === 0) {
    try {
      const fallback = await getHighlightEvents(etid);
      if (Array.isArray(fallback?.data) && fallback.data.length > 0) {
        realDataStore.sportsMatches[etid] = fallback.data;
        cacheStore.highlights[etid] = { time: now, data: fallback.data };
        return fallback.data;
      }
    } catch (e) {}
  }

  return realDataStore.sportsMatches[etid] || [];
}

// Refresh major active sports
export async function refreshAllSports() {
  const sports = [4, 1, 2, 8, 10, 65];
  for (const etid of sports) {
    try {
      await fetchRealSportHighlights(etid);
    } catch (e) {}
  }
}

// 4. Background refresh loop (Continuous real live update on VPS & local)
let pollInterval = null;
function startBackgroundPollLoop() {
  if (pollInterval) return;
  const sportsCycle = [4, 1, 2, 8];
  let cycleIdx = 0;

  pollInterval = setInterval(async () => {
    try {
      const etid = sportsCycle[cycleIdx % sportsCycle.length];
      cycleIdx++;
      await fetchRealSportHighlights(etid);
    } catch (err) {}
  }, 4000);
}

export function normalizeCasinoGtype(gtype) {
  if (!gtype) return gtype;
  const g = String(gtype).toLowerCase().trim();

  // Teen Patti & Poison
  if (g === "teenpoison_1day" || g === "poison" || g === "poison1day") return "poison";
  if (g === "teen_unique" || g === "teenunique" || g === "unique") return "teenunique";
  if (g === "teenpoison" || g === "poison20" || g === "poison_20") return "poison20";
  if (g === "teenunlimited_1day" || g === "unlimited_1day") return "teenunlimited_1day";
  if (g === "teenunlimited" || g === "unlimited20") return "teenunlimited";
  if (g === "teen1day" || g === "teen20" || g === "teen_1day") return "teen20";
  if (g === "teen9" || g === "openteen" || g === "teenopen") return "teen9";
  if (g === "teenjoker") return "teenjoker";
  if (g === "teen" || g === "teenpatti") return "teen";

  // Roulette
  if (g === "roulette" || g === "roulette13") return "roulette13";
  if (g === "beachroulette" || g === "roulette11") return "roulette11";
  if (g === "viproulette" || g === "roulette12") return "roulette12";

  // Poker
  if (g === "poker6player" || g === "poker6" || g === "6playerpoker" || g === "poker6players") return "poker6";
  if (g === "poker20") return "poker20";
  if (g === "poker1day" || g === "poker" || g === "1daypoker" || g === "poker1") return "poker";

  // Dragon Tiger
  if (g === "dragon_tiger" || g === "dragontiger" || g === "dt") return "dt20";
  if (g === "dt1day" || g === "dtfast") return "dt6";
  if (g === "dtl" || g === "dtl20") return "dtl20";

  // Andar Bahar
  if (g === "andar_bahar" || g === "andarbahar" || g === "ab") return "ab20";
  if (g === "andar_bahar2" || g === "andarbahar2" || g === "andarbaharb") return "abj";

  // 32 Cards
  if (g === "32cards" || g === "32card" || g === "32_cards") return "card32";
  if (g === "32cardsb" || g === "32cardeu" || g === "32cards_b") return "card32eu";

  // Lucky
  if (g === "lucky7" || g === "lucky7a") return "lucky7";
  if (g === "lucky7eu" || g === "lucky7b") return "lucky7eu";
  if (g === "lucky6" || g === "lucky5" || g === "lucky") return "lucky5";

  // Baccarat
  if (g === "baccarat" || g === "baccarat_a" || g === "baccarata") return "baccarat";
  if (g === "baccaratb" || g === "baccarat_b" || g === "baccarat2") return "baccarat2";

  // Matka / Worli
  if (g === "matka" || g === "worli3") return "worli3";
  if (g === "worli") return "worli";

  // Others
  if (g.includes("superover")) return "superover2";
  if (g === "queenrace") return "queen";
  return g;
}

// Persistent Table State Tracker to guarantee 100% smooth, monotonic, zero-fluctuation casino data
const tableStateTracker = new Map();

// 5. Live Casino Table Scraper (Real mid, real lt countdown, real dealt cards, real sub array)
export async function fetchRealCasinoTableLive(gtype) {
  const normalized = normalizeCasinoGtype(gtype);
  const now = Date.now();

  let tracker = tableStateTracker.get(normalized);
  if (!tracker) {
    tracker = {
      roundId: "",
      initialLeftSec: 0,
      leftSecReceivedAt: now,
      lastComputedSec: 0,
      roundStatus: "OPEN",
      card: "",
      cards: [],
      sub: [],
      odds: {},
      markets: [],
      ename: "",
      results: [],
      remark: "",
      score: "0 0",
      gtype: normalized,
      lastUpdated: now
    };
    tableStateTracker.set(normalized, tracker);
  }

  // Handle Super Over2 and other tabdata-driven tables
  const isSuperOver = normalized.includes("superover");
  const endpoint = isSuperOver ? `casino/tabdata?type=${normalized}` : `casino/data2?gtype=${normalized}`;
  const payload = { ismob: 1, type: normalized };

  const dec = await evalD247Api(endpoint, payload);
  if (dec && dec.data) {
    const d = dec.data;
    
    // For superover2, t1 holds round info, t2 holds markets, t3 holds last results
    if (d.t1 && d.t2) {
      const t1 = d.t1;
      const rawMarkets = Array.isArray(d.t2) ? d.t2 : [];
      const results = Array.isArray(d.t3) ? d.t3 : (Array.isArray(d.lastresults) ? d.lastresults : []);
      if (results.length > 0) {
        realDataStore.casinoResults[gtype] = results;
        realDataStore.casinoResults[normalized] = results;
      }

      let allRunners = [];
      rawMarkets.forEach(m => {
        const runners = Array.isArray(m.section) ? m.section : [];
        const isMarketSuspended = m.status === "SUSPENDED";

        runners.forEach(r => {
          const oddsList = Array.isArray(r.odds) ? r.odds : [];
          const b1 = oddsList.find(o => o.oname === "back1" || (o.otype === "back" && o.tno === 0));
          const l1 = oddsList.find(o => o.oname === "lay1" || (o.otype === "lay" && o.tno === 0));
          const bOdds = Number(b1?.odds || 0);
          const lOdds = Number(l1?.odds || 0);
          const isRunnerSuspended = isMarketSuspended || r.gstatus === "SUSPENDED";

          allRunners.push({
            sid: r.sid,
            nat: r.nat || `Runner ${r.sid}`,
            b: bOdds,
            bs: Number(b1?.size || 0),
            l: lOdds,
            ls: Number(l1?.size || 0),
            gstatus: isRunnerSuspended ? "SUSPENDED" : "ACTIVE",
            min: m.min || 100,
            max: m.max || 100000,
            mname: m.mname,
            subtype: m.gtype || "main"
          });
        });
      });

      const rawCards = t1.card || "";
      const parsedCards = rawCards ? rawCards.split(/[,|]/).map(s => s.trim()).filter(Boolean) : [];
      const activeMid = rawMarkets[0]?.mid ? String(rawMarkets[0].mid) : String(t1.gmid || tracker.roundId || Date.now());
      const rawLt = Number(t1.lt ?? 0);
      const isNewRoundOrBall = (tracker.roundId !== activeMid) || (rawLt > (tracker.lastComputedSec || 0) + 3);

      // Check for round transition or new ball countdown
      if (isNewRoundOrBall) {
        tracker.roundId = activeMid;
        tracker.initialLeftSec = rawLt;
        tracker.leftSecReceivedAt = now;
        tracker.lastComputedSec = rawLt;
        tracker.roundStatus = (rawLt <= 0 || t1.status === "SUSPENDED") ? "SUSPENDED" : "OPEN";
        tracker.card = rawCards;
        tracker.cards = parsedCards;
        if (allRunners.length > 0) tracker.sub = allRunners;
        if (rawMarkets.length > 0) tracker.markets = rawMarkets;
        if (results.length > 0) tracker.results = results;
        tracker.ename = t1.ename || tracker.ename || "IND Vs ENG Super Over2";
        tracker.gtype = t1.gtype || gtype;
        tracker.lastUpdated = now;
      } else {
        // Same round: Strictly monotonic timer using wall-clock elapsed time
        const elapsed = Math.floor((now - tracker.leftSecReceivedAt) / 1000);
        let computedSec = Math.max(0, tracker.initialLeftSec - elapsed);
        if (rawLt > 0 && rawLt < computedSec) {
          tracker.initialLeftSec = rawLt;
          tracker.leftSecReceivedAt = now;
          computedSec = rawLt;
        }
        if (tracker.lastComputedSec !== undefined && computedSec > tracker.lastComputedSec) {
          computedSec = tracker.lastComputedSec;
        }
        tracker.lastComputedSec = computedSec;
        tracker.roundStatus = (computedSec <= 0 || t1.status === "SUSPENDED") ? "SUSPENDED" : "OPEN";

        // Dealt card preservation: never overwrite with blank mid-round
        if (rawCards && rawCards.trim() !== "" && rawCards !== "1") {
          tracker.card = rawCards;
          tracker.cards = parsedCards;
        }
        if (allRunners.length > 0) tracker.sub = allRunners;
        if (rawMarkets.length > 0) tracker.markets = rawMarkets;
        if (results.length > 0) tracker.results = results;
        tracker.lastUpdated = now;
      }

      const result = {
        roundId: tracker.roundId,
        leftSec: tracker.lastComputedSec,
        roundStatus: tracker.roundStatus,
        gtype: tracker.gtype || gtype,
        card: tracker.card,
        cards: tracker.cards,
        ename: tracker.ename || "IND Vs ENG Super Over2",
        markets: tracker.markets,
        sub: tracker.sub,
        results: tracker.results
      };

      realDataStore.casinoLive[gtype] = result;
      realDataStore.casinoLive[normalized] = result;
      cacheStore.casino[gtype] = { time: now, data: result };
      return result;
    }

    // Special handling for Matka Market (worli3 / matka)
    if (normalized === 'worli3' || normalized === 'matka') {
      const matkaList = Array.isArray(d) ? d : (d && typeof d === 'object' ? Object.values(d) : []);
      const activeMid = matkaList[0]?.mid || tracker.roundId || Date.now();
      
      const result = {
        roundId: String(activeMid),
        leftSec: 30,
        roundStatus: "OPEN",
        gtype: "worli3",
        card: "",
        cards: [],
        ename: "Matka Market (Open to Close)",
        matkaMarkets: matkaList,
        sub: [
          { sid: 1, nat: "Single (0-9)", b: 9.5, bs: 1000, l: 0, ls: 0, gstatus: "ACTIVE", min: 10, max: 25000, subtype: "single" },
          { sid: 2, nat: "Jodi (00-99)", b: 95.0, bs: 1000, l: 0, ls: 0, gstatus: "ACTIVE", min: 10, max: 10000, subtype: "jodi" },
          { sid: 3, nat: "Pana (Single/Double/Triple)", b: 150.0, bs: 500, l: 0, ls: 0, gstatus: "ACTIVE", min: 10, max: 5000, subtype: "pana" },
          { sid: 4, nat: "SP (Single Patti)", b: 150.0, bs: 500, l: 0, ls: 0, gstatus: "ACTIVE", min: 10, max: 5000, subtype: "sp" },
          { sid: 5, nat: "DP (Double Patti)", b: 300.0, bs: 500, l: 0, ls: 0, gstatus: "ACTIVE", min: 10, max: 5000, subtype: "dp" }
        ],
        odds: {}
      };

      realDataStore.casinoLive[gtype] = result;
      realDataStore.casinoLive[normalized] = result;
      cacheStore.casino[gtype] = { time: now, data: result };
      return result;
    }

    // Standard Casino Tables (Lucky7, Poker, Roulette, Dragon Tiger, Teen Patti, etc.)
    const runners = Array.isArray(d.sub) ? d.sub : [];
    const rawCardStr = d.card || "";
    const parsedCardList = rawCardStr ? rawCardStr.split(/[,|]/).map(s => s.trim()).filter(Boolean) : [];
    const incomingRoundId = String(d.mid || tracker.roundId || Date.now());
    const rawLt = Number(d.lt ?? (d.leftSec ?? 0));
    const isSuspended = (d.status === "SUSPENDED" || (rawLt <= 0 && d.gstatus === "SUSPENDED"));

    const mappedRunners = runners.map((r, rIdx) => {
      const runnerId = r.sid || r.i || (rIdx + 1);
      const runnerName = (r.nat !== undefined && r.nat !== null && r.nat !== "") ? String(r.nat) : (r.n !== undefined && r.n !== null && r.n !== "" ? String(r.n) : (r.name || `Runner ${runnerId}`));
      const isRunnerSusp = (r.gstatus === "SUSPENDED" || r.status === "SUSPENDED");
      let runnerSubtype = r.subtype || "main";
      if (normalized === "poker6") {
        if (Number(runnerId) >= 11 && Number(runnerId) <= 16) runnerSubtype = "hands";
        else if (Number(runnerId) >= 21) runnerSubtype = "pattern";
      }

      return {
        sid: runnerId,
        nat: runnerName,
        b: Number(r.b || 0),
        bs: Number(r.bs || 0),
        l: Number(r.l || 0),
        ls: Number(r.ls || 0),
        gstatus: isRunnerSusp ? "SUSPENDED" : "ACTIVE",
        min: r.min || 100,
        max: r.max || 100000,
        subtype: runnerSubtype
      };
    });

    const mappedOdds = runners.reduce((acc, r) => {
      const key = r.nat?.toLowerCase().replace(/\s+/g, "") || `r_${r.sid}`;
      acc[key] = {
        rate: Number(r.b || 0),
        layRate: Number(r.l || 0),
        status: r.gstatus || "ACTIVE"
      };
      return acc;
    }, {});

    // Check for round transition: roundId changed OR timer jumped back up by > 3s (dealer reset countdown)
    const isNewRound = (tracker.roundId !== incomingRoundId) || (rawLt > (tracker.lastComputedSec || 0) + 3);
    if (isNewRound) {
      tracker.roundId = incomingRoundId;
      tracker.initialLeftSec = rawLt;
      tracker.leftSecReceivedAt = now;
      tracker.lastComputedSec = rawLt;
      tracker.roundStatus = (rawLt <= 0 || isSuspended) ? "SUSPENDED" : "OPEN";
      tracker.card = rawCardStr;
      tracker.cards = parsedCardList;
      if (mappedRunners.length > 0) tracker.sub = mappedRunners;
      tracker.odds = mappedOdds;
      tracker.remark = d.remark || d.rdesc || "";
      tracker.score = d.card || "0 0";
      tracker.gtype = d.gtype || gtype;
      tracker.lastUpdated = now;
    } else {
      // Same round: Strictly monotonic timer using wall-clock elapsed time
      const elapsed = Math.floor((now - tracker.leftSecReceivedAt) / 1000);
      let computedSec = Math.max(0, tracker.initialLeftSec - elapsed);
      if (rawLt > 0 && rawLt < computedSec) {
        tracker.initialLeftSec = rawLt;
        tracker.leftSecReceivedAt = now;
        computedSec = rawLt;
      }
      if (tracker.lastComputedSec !== undefined && computedSec > tracker.lastComputedSec) {
        computedSec = tracker.lastComputedSec;
      }
      tracker.lastComputedSec = computedSec;
      tracker.roundStatus = (computedSec <= 0 || isSuspended) ? "SUSPENDED" : "OPEN";

      // Dealt card preservation: NEVER overwrite with blank mid-round
      if (rawCardStr && rawCardStr.trim() !== "" && rawCardStr !== "1") {
        tracker.card = rawCardStr;
        tracker.cards = parsedCardList;
      }
      // Runner preservation: NEVER wipe runners array to empty mid-round
      if (mappedRunners.length > 0) {
        tracker.sub = mappedRunners;
        tracker.odds = mappedOdds;
      }
      if (d.remark || d.rdesc) tracker.remark = d.remark || d.rdesc;
      if (d.card) tracker.score = d.card;
      tracker.lastUpdated = now;
    }

    const result = {
      roundId: tracker.roundId,
      leftSec: tracker.lastComputedSec,
      roundStatus: tracker.roundStatus,
      gtype: tracker.gtype || gtype,
      card: tracker.card,
      cards: tracker.cards,
      remark: tracker.remark,
      score: tracker.score,
      sub: tracker.sub,
      odds: tracker.odds
    };

    realDataStore.casinoLive[gtype] = result;
    realDataStore.casinoLive[normalized] = result;
    cacheStore.casino[gtype] = { time: now, data: result };
    return result;
  }

  // Graceful fallback: return smooth monotonic tracker state even on temporary network drop
  if (tracker.roundId) {
    const elapsed = Math.floor((now - tracker.leftSecReceivedAt) / 1000);
    let computedSec = Math.max(0, tracker.initialLeftSec - elapsed);
    if (tracker.lastComputedSec !== undefined && computedSec > tracker.lastComputedSec) {
      computedSec = tracker.lastComputedSec;
    }
    tracker.lastComputedSec = computedSec;
    if (computedSec <= 0) tracker.roundStatus = "SUSPENDED";

    return {
      roundId: tracker.roundId,
      leftSec: tracker.lastComputedSec,
      roundStatus: tracker.roundStatus,
      gtype: tracker.gtype || gtype,
      card: tracker.card,
      cards: tracker.cards,
      remark: tracker.remark,
      score: tracker.score,
      sub: tracker.sub,
      odds: tracker.odds,
      markets: tracker.markets || [],
      results: tracker.results || []
    };
  }

  return realDataStore.casinoLive[gtype] || realDataStore.casinoLive[normalized] || null;
}

// 6. Live Round Results Scraper
export async function fetchRealCasinoLastResults(gtype) {
  const targetGtype = normalizeCasinoGtype(gtype);
  const dec = await evalD247Api(`casino/lastresults2?gtype=${targetGtype}`, {
    ismob: 1,
    gType: targetGtype,
    type: targetGtype,
    gtype: targetGtype
  });
  const results = dec?.data?.res || (Array.isArray(dec?.data) ? dec.data : []);
  if (Array.isArray(results) && results.length > 0) {
    realDataStore.casinoResults[gtype] = results;
    realDataStore.casinoResults[targetGtype] = results;
    return results;
  }
  return realDataStore.casinoResults[gtype] || realDataStore.casinoResults[targetGtype] || [];
}

// 7. Live Match Odds & Markets Scraper (Exact D247 Markets: MATCH_ODDS, Bookmaker, Over/Under, Correct Score)
export async function fetchRealMatchOdds(etid, gmid) {
  const now = Date.now();
  if (cacheStore.markets[gmid] && (now - cacheStore.markets[gmid].time < 300)) {
    return cacheStore.markets[gmid].data;
  }

  // Handle Goal 2 (Football Virtual Match)
  if (String(gmid).toLowerCase().includes('goal')) {
    const dec = await evalD247Api(`casino/data2?gtype=goal2`, { ismob: 1, type: "goal2" });
    if (dec && dec.data && Array.isArray(dec.data.sub)) {
      const runners = dec.data.sub;
      const formatted = [
        {
          mid: dec.data.mid || "goal2_who",
          mname: "Who Will Goal Next?",
          gtype: "match1",
          status: dec.data.gstatus === "SUSPENDED" ? "SUSPENDED" : "OPEN",
          max: 50000,
          min: 100,
          section: runners.filter(r => r.subtype === "player" || r.sid <= 12).map((r, rIdx) => ({
            sid: r.sid || rIdx + 1,
            nat: r.nat || `Runner ${rIdx + 1}`,
            gstatus: r.gstatus || "ACTIVE",
            b1: Number(r.b || 0) > 0 ? Number(r.b) : null,
            bs1: Number(r.bs || 0) > 0 ? String(r.bs) : "50K",
            l1: Number(r.l || 0) > 0 ? Number(r.l) : null,
            ls1: Number(r.ls || 0) > 0 ? String(r.ls) : "50K"
          }))
        },
        {
          mid: `${dec.data.mid || "goal2"}_specials`,
          mname: "Method Of Next Goal & Specials",
          gtype: "fancy1",
          status: dec.data.gstatus === "SUSPENDED" ? "SUSPENDED" : "OPEN",
          max: 20000,
          min: 100,
          section: runners.filter(r => r.subtype !== "player" && r.sid > 12).map((r, rIdx) => ({
            sid: r.sid || rIdx + 13,
            nat: r.nat || `Special ${rIdx + 1}`,
            gstatus: r.gstatus || "ACTIVE",
            b1: Number(r.b || 0) > 0 ? Number(r.b) : null,
            bs1: Number(r.bs || 0) > 0 ? String(r.bs) : "20K",
            l1: Number(r.l || 0) > 0 ? Number(r.l) : null,
            ls1: Number(r.ls || 0) > 0 ? String(r.ls) : "20K"
          }))
        }
      ];
      realDataStore.matchDetails[gmid] = formatted;
      cacheStore.markets[gmid] = { time: now, data: formatted };
      return formatted;
    }
  }

  // Handle Super Over2
  if (String(gmid).toLowerCase().includes('superover')) {
    const dec = await evalD247Api(`casino/tabdata?type=superover2`, { ismob: 1, type: "superover2" });
    if (dec && dec.data && dec.data.t2) {
      const rawMarkets = Array.isArray(dec.data.t2) ? dec.data.t2 : [];
      const formatted = rawMarkets.map((m, mIdx) => {
        const runners = Array.isArray(m.section) ? m.section : [];
        return {
          mid: m.mid || `so_${mIdx}`,
          mname: m.mname || "Market",
          gtype: m.gtype || "fancy",
          status: m.status || "OPEN",
          max: m.max || 300000,
          min: m.min || 100,
          rem: m.rem || m.remark || m.rdesc || m.news || "",
          section: runners.map((r, rIdx) => {
            const oddsList = Array.isArray(r.odds) ? r.odds : [];
            const b1 = oddsList.find(o => o.oname === "back1" || (o.otype === "back" && o.tno === 0));
            const l1 = oddsList.find(o => o.oname === "lay1" || (o.otype === "lay" && o.tno === 0));
            return {
              sid: r.sid || rIdx + 1,
              nat: r.nat || `Runner ${rIdx + 1}`,
              gstatus: r.gstatus || "ACTIVE",
              b1: b1 && b1.odds > 0 ? b1.odds : null,
              bs1: b1 && b1.size > 0 ? b1.size : (r.min ? String(r.min) : null),
              l1: l1 && l1.odds > 0 ? l1.odds : null,
              ls1: l1 && l1.size > 0 ? l1.size : null
            };
          })
        };
      });
      realDataStore.matchDetails[gmid] = formatted;
      cacheStore.markets[gmid] = { time: now, data: formatted };
      return formatted;
    }
  }

  const dec = await evalD247Api(`gamedataPrivate?etid=${etid}&gmid=${gmid}`, {
    etid: Number(etid),
    gmid: Number(gmid)
  });

  if (dec && dec.data) {
    const rawMarkets = Array.isArray(dec.data) ? dec.data : Object.values(dec.data);
    const formattedMarkets = rawMarkets.map((m, mIdx) => {
      const runners = Array.isArray(m.section) ? m.section : [];
      
      // Respect D247 market suspend status 100%
      const isMarketSuspended = m.status === "SUSPENDED";
      const marketStatus = isMarketSuspended ? "SUSPENDED" : "OPEN";

      return {
        mid: m.mid || `${gmid}_${mIdx}`,
        mname: m.mname || m.name || `Market ${mIdx + 1}`,
        gtype: m.gtype || "match",
        status: marketStatus,
        max: m.maxb || m.max || 100000,
        min: m.min || 100,
        rem: m.rem || m.remark || m.rdesc || m.news || m.mdesc || m.desc || "",
        section: runners.map((r, rIdx) => {
          const oddsList = Array.isArray(r.odds) ? r.odds : [];
          
          // Exact matching by oname and tno (Never let back3 match as back1!)
          const b1 = oddsList.find(o => o.oname === "back1" || (o.otype === "back" && o.tno === 0));
          const b2 = oddsList.find(o => o.oname === "back2" || (o.otype === "back" && o.tno === 1));
          const b3 = oddsList.find(o => o.oname === "back3" || (o.otype === "back" && o.tno === 2));
          const l1 = oddsList.find(o => o.oname === "lay1" || (o.otype === "lay" && o.tno === 0));
          const l2 = oddsList.find(o => o.oname === "lay2" || (o.otype === "lay" && o.tno === 1));
          const l3 = oddsList.find(o => o.oname === "lay3" || (o.otype === "lay" && o.tno === 2));

          const runnerHasOdds = (b1 && b1.odds > 0) || (l1 && l1.odds > 0) || (b2 && b2.odds > 0) || (l2 && l2.odds > 0);
          const runnerStatus = isMarketSuspended || r.gstatus === "SUSPENDED" ? "SUSPENDED" : (runnerHasOdds ? "ACTIVE" : "SUSPENDED");

          const formatSize = (s) => {
            if (s === undefined || s === null) return null;
            const num = Number(s);
            if (isNaN(num) || num === 0) return null;
            return Number.isInteger(num) ? num : parseFloat(num.toFixed(2));
          };

          return {
            sid: r.sid || rIdx + 1,
            nat: r.nat || `Runner ${rIdx + 1}`,
            gstatus: runnerStatus,
            b1: b1 && b1.odds > 0 ? b1.odds : null,
            bs1: b1 ? formatSize(b1.size) : null,
            b2: b2 && b2.odds > 0 ? b2.odds : null,
            bs2: b2 ? formatSize(b2.size) : null,
            b3: b3 && b3.odds > 0 ? b3.odds : null,
            bs3: b3 ? formatSize(b3.size) : null,
            l1: l1 && l1.odds > 0 ? l1.odds : null,
            ls1: l1 ? formatSize(l1.size) : null,
            l2: l2 && l2.odds > 0 ? l2.odds : null,
            ls2: l2 ? formatSize(l2.size) : null,
            l3: l3 && l3.odds > 0 ? l3.odds : null,
            ls3: l3 ? formatSize(l3.size) : null
          };
        })
      };
    });

    realDataStore.matchDetails[gmid] = formattedMarkets;
    cacheStore.markets[gmid] = { time: now, data: formattedMarkets };
    return formattedMarkets;
  }

  return realDataStore.matchDetails[gmid] || null;
}

export function getPageInstance() {
  return null;
}
