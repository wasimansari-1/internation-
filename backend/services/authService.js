import axios from "axios";
import { TARGET_BASE, httpsAgent, httpAgent } from "../config/hosts.js";
import { telemetry } from "./telemetryService.js";

axios.defaults.httpsAgent = httpsAgent;
axios.defaults.httpAgent = httpAgent;

// Multi-account load balancing pool for Nice444 (50% traffic sharing between demo52 and rio001)
export const NICE444_ACCOUNTS = [
  { userName: "demo52", password: "Asdf1234" },
  { userName: "rio001", password: "Asdf1234" },
];

const nice444Sessions = NICE444_ACCOUNTS.map((acc) => ({
  userName: acc.userName,
  password: acc.password,
  token: null,
  intCasino: null,
  userDetail: null,
  tokenExpiry: 0,
  failedAttempts: 0,
}));

let currentNiceAccountIndex = 0;
let tokenRetryTimer = null;

// Helper to log in a specific Nice444 user session
async function loginNiceAccount(session) {
  try {
    const res = await axios.post(
      `${TARGET_BASE}/app/users/userLogin`,
      {
        userName: session.userName,
        password: session.password,
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
      session.token = res.data.data.accessToken;
      session.intCasino = res.data.data.intCasino || null;
      session.userDetail = res.data.data.userDetail || null;
      session.tokenExpiry = Date.now() + 30 * 60 * 1000;
      session.failedAttempts = 0;
      telemetry.recordAuthAttempt("nice444", true);
      telemetry.recordUpstreamHit("Nice444", `/app/users/userLogin (${session.userName})`, 200, 180);
      return session.token;
    }
  } catch (err) {
    session.failedAttempts++;
    console.error(`Error getting Nice444 token for ${session.userName}:`, err.message);
    telemetry.recordAuthAttempt("nice444", false, err.message);
  }
  return null;
}

export const scheduleTokenRetry = () => {
  if (tokenRetryTimer) return;
  tokenRetryTimer = setTimeout(async () => {
    tokenRetryTimer = null;
    for (const session of nice444Sessions) {
      if (!session.token || Date.now() >= session.tokenExpiry) {
        await loginNiceAccount(session);
      }
    }
  }, 5000);
};

// 50% Load balanced getDemoToken between demo52 and rio001
export const getDemoToken = async (forceRefresh = false) => {
  const primaryIdx = currentNiceAccountIndex % nice444Sessions.length;
  currentNiceAccountIndex = (currentNiceAccountIndex + 1) % nice444Sessions.length;
  const secondaryIdx = (primaryIdx + 1) % nice444Sessions.length;

  const primary = nice444Sessions[primaryIdx];
  const secondary = nice444Sessions[secondaryIdx];

  // 1. If primary account has an active unexpired token and no forceRefresh
  if (!forceRefresh && primary.token && Date.now() < primary.tokenExpiry) {
    return primary.token;
  }

  // 2. Perform fresh login for primary account
  const token = await loginNiceAccount(primary);
  if (token) {
    return token;
  }

  // 3. Fallback: If primary login failed, use secondary account immediately
  if (!forceRefresh && secondary.token && Date.now() < secondary.tokenExpiry) {
    return secondary.token;
  }
  const fallbackToken = await loginNiceAccount(secondary);
  if (fallbackToken) {
    return fallbackToken;
  }

  // Schedule retry if both fail
  scheduleTokenRetry();
  return primary.token || secondary.token || null;
};

export const getCachedIntCasinoToken = () => {
  const active = nice444Sessions.find((s) => s.token && Date.now() < s.tokenExpiry) || nice444Sessions[0];
  return active?.intCasino || null;
};

export const getCachedUserDetail = () => {
  const active = nice444Sessions.find((s) => s.token && Date.now() < s.tokenExpiry) || nice444Sessions[0];
  return active?.userDetail || null;
};

export const getStealthHeaders = (customHeaders = {}) => {
  const persona = telemetry?.getCurrentPersona ? telemetry.getCurrentPersona() : {
    ip: "103.21.124.5",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    secPlatform: '"Windows"',
  };

  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    "Origin": TARGET_BASE,
    "Referer": `${TARGET_BASE}/`,
    "User-Agent": persona.userAgent,
    "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    "sec-ch-ua-mobile": persona.secPlatform.includes("Android") ? "?1" : "?0",
    "sec-ch-ua-platform": persona.secPlatform,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "Priority": "u=1, i",
    "X-Forwarded-For": persona.ip,
    "CF-Connecting-IP": persona.ip,
    "X-Real-IP": persona.ip,
    "True-Client-IP": persona.ip,
    ...customHeaders,
  };

  // Rotate between available tokens for 50/50 outbound traffic distribution
  const validSessions = nice444Sessions.filter((s) => s.token && Date.now() < s.tokenExpiry);
  let activeToken = null;
  if (validSessions.length > 0) {
    const session = validSessions[currentNiceAccountIndex % validSessions.length];
    currentNiceAccountIndex = (currentNiceAccountIndex + 1) % validSessions.length;
    activeToken = session.token;
  } else {
    activeToken = nice444Sessions[0]?.token || nice444Sessions[1]?.token || null;
  }

  if (activeToken && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${activeToken}`;
  }
  return headers;
};

// Startexch99 Multi-Account Pool (Load Balanced across 3 accounts)
export const STARTEXCH_BASE = "https://startexch99.com";
export const STARTEXCH_CASINO_BASE = "https://casino.startexch99.com";

export const STARTEXCH_ACCOUNTS = [
  { userName: "smdemo", password: "Asdf12345" },
  { userName: "suraj01s", password: "Asdf12345" },
  { userName: "santosh01s", password: "Asdf12345" },
];

const startexchSessions = STARTEXCH_ACCOUNTS.map((acc) => ({
  userName: acc.userName,
  password: acc.password,
  token: null,
  tokenExpiry: 0,
  lastLoginTime: 0,
  failedAttempts: 0,
  loginPromise: null,
}));

let currentStartexchAccountIndex = 0;

// Helper to log in a specific Startexch session with 60s cooldown and promise lock
async function loginStartexchAccount(session, forceRefresh = false) {
  // If account was disabled due to password change or ban, check if cooldown passed
  if (session.disabledUntil && Date.now() < session.disabledUntil) {
    return null;
  }
  if (!forceRefresh && session.token && Date.now() < session.tokenExpiry) {
    return session.token;
  }
  // Cooldown: if logged in within 60s, reuse token
  if (session.token && Date.now() - session.lastLoginTime < 60000) {
    return session.token;
  }
  if (session.loginPromise) {
    return session.loginPromise;
  }

  session.loginPromise = (async () => {
    try {
      const res = await axios.post(
        `${STARTEXCH_BASE}/app/users/userLogin`,
        {
          userName: session.userName,
          password: session.password,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Origin: STARTEXCH_BASE,
            Referer: `${STARTEXCH_BASE}/`,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
          timeout: 8000,
        },
      );
      if (res.data?.data?.accessToken) {
        session.token = res.data.data.accessToken;
        session.tokenExpiry = Date.now() + 30 * 60 * 1000;
        session.lastLoginTime = Date.now();
        session.failedAttempts = 0;
        session.disabledUntil = 0;
        telemetry.recordAuthAttempt("startexch99", true);
        telemetry.recordUpstreamHit("Startexch99", `/app/users/userLogin (${session.userName})`, 200, 180);
        return session.token;
      }
    } catch (err) {
      session.failedAttempts = (session.failedAttempts || 0) + 1;
      const status = err.response?.status;
      const msg = err.response?.data?.meta?.message || err.message;
      console.error(`Error logging in Startexch account ${session.userName} (Status ${status}): ${msg}`);
      
      // If password changed (401/422) or banned, isolate this account for 15 minutes
      if (status === 401 || status === 422 || session.failedAttempts >= 3) {
        session.disabledUntil = Date.now() + 15 * 60 * 1000;
        session.token = null;
        console.warn(`[Auto-Isolation] Startexch account ${session.userName} disabled for 15 mins (password change/ban detected). Switching to backup accounts.`);
        if (telemetry?.addBrainAlert) {
          telemetry.addBrainAlert({
            level: "WARNING",
            title: `Account Isolated: ${session.userName}`,
            message: `Startexch login failed (${msg}). Auto-failover using remaining healthy accounts!`,
            timestamp: Date.now(),
          });
        }
      }
      telemetry.recordAuthAttempt("startexch99", false, msg);
    } finally {
      session.loginPromise = null;
    }
    return session.token;
  })();

  return session.loginPromise;
}

// 3-Way Round-Robin Load Balanced getStartexchToken with Auto-Banned Account Skip
export const getStartexchToken = async (forceRefresh = false) => {
  // 1. Get currently active (non-disabled) accounts
  const activeSessions = startexchSessions.filter(
    (s) => !s.disabledUntil || Date.now() >= s.disabledUntil
  );

  const pool = activeSessions.length > 0 ? activeSessions : startexchSessions;
  const primaryIdx = currentStartexchAccountIndex % pool.length;
  currentStartexchAccountIndex = (currentStartexchAccountIndex + 1) % pool.length;

  const primary = pool[primaryIdx];
  // 2. If primary account has an active unexpired token and no forceRefresh
  if (!forceRefresh && primary.token && Date.now() < primary.tokenExpiry) {
    return primary.token;
  }

  // 3. Perform login for primary account
  const token = await loginStartexchAccount(primary, forceRefresh);
  if (token) {
    return token;
  }

  // 4. Fallback: If primary failed/banned, immediately try remaining accounts in pool
  for (let i = 1; i < pool.length; i++) {
    const backup = pool[(primaryIdx + i) % pool.length];
    if (backup.token && Date.now() < backup.tokenExpiry) {
      return backup.token;
    }
    const backupToken = await loginStartexchAccount(backup, false);
    if (backupToken) {
      return backupToken;
    }
  }

  return primary.token || null;
};

// CBTFexchange Integration (3rd Provider in Multi-Provider Mesh)
export const CBTF_BASE = "https://cbtfexchange.com";
export const CBTF_ACCOUNT = {
  userName: "8292463648",
  password: "Asdf1234",
  siteKey: "2",
};

let cachedCbtfToken = null;
let cbtfTokenExpiry = 0;

export const getCbtfToken = async (forceRefresh = false) => {
  if (!forceRefresh && cachedCbtfToken && Date.now() < cbtfTokenExpiry) {
    return cachedCbtfToken;
  }
  try {
    const res = await axios.post(
      `${CBTF_BASE}/app/users/userLogin`,
      {
        userName: CBTF_ACCOUNT.userName,
        password: CBTF_ACCOUNT.password,
        siteKey: CBTF_ACCOUNT.siteKey,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Origin: CBTF_BASE,
          Referer: `${CBTF_BASE}/`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 8000,
      },
    );
    if (res.data?.data?.accessToken) {
      cachedCbtfToken = res.data.data.accessToken;
      cbtfTokenExpiry = Date.now() + 30 * 60 * 1000;
      telemetry.recordAuthAttempt("cbtfexchange", true);
      telemetry.recordUpstreamHit("CBTFexchange", "/app/users/userLogin", 200, 180);
      return cachedCbtfToken;
    }
  } catch (err) {
    console.error("Error getting CBTFexchange token:", err.message);
    telemetry.recordAuthAttempt("cbtfexchange", false, err.message);
  }
  return cachedCbtfToken;
};

// 3-Way Load Balancing Provider Pointer (Nice444, Startexch99, CBTFexchange)
let globalProviderIndex = 0;

export const proxyRequest = async (endpoint, payload = {}, method = "POST") => {
  const persona = telemetry?.getCurrentPersona ? telemetry.getCurrentPersona() : {
    ip: "103.21.124.5",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    secPlatform: '"Windows"',
  };

  const configured = (telemetry?.routingConfig?.sportsProvider || "AUTO").toUpperCase();

  // Define the 3 providers
  const providers = [
    {
      id: "NICE444",
      name: "Nice444",
      base: TARGET_BASE,
      getToken: () => getDemoToken(),
      buildHeaders: (tok) => ({
        ...getStealthHeaders(),
        Origin: TARGET_BASE,
        Referer: `${TARGET_BASE}/`,
        Authorization: tok ? `Bearer ${tok}` : undefined,
      }),
      buildPayload: (p) => ({ key: "2", ...p }),
    },
    {
      id: "STARTEXCH99",
      name: "Startexch99",
      base: STARTEXCH_BASE,
      getToken: () => getStartexchToken(),
      buildHeaders: (tok) => ({
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        Origin: STARTEXCH_BASE,
        Referer: `${STARTEXCH_BASE}/`,
        "User-Agent": persona.userAgent,
        "X-Forwarded-For": persona.ip,
        Authorization: tok ? `Bearer ${tok}` : undefined,
      }),
      buildPayload: (p) => ({ key: "2", ...p }),
    },
    {
      id: "CBTFEXCHANGE",
      name: "CBTFexchange",
      base: CBTF_BASE,
      getToken: () => getCbtfToken(),
      buildHeaders: (tok) => ({
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        Origin: CBTF_BASE,
        Referer: `${CBTF_BASE}/`,
        "User-Agent": persona.userAgent,
        "X-Forwarded-For": persona.ip,
        Authorization: tok ? `Bearer ${tok}` : undefined,
      }),
      buildPayload: (p) => ({ key: "2", ...p }),
    },
  ];

  // Determine provider execution order based on routing config & health
  let executionOrder = [];
  if (configured === "CBTFEXCHANGE") {
    executionOrder = [providers[2], providers[1], providers[0]];
  } else if (configured === "STARTEXCH99") {
    executionOrder = [providers[1], providers[2], providers[0]];
  } else if (configured === "NICE444") {
    executionOrder = [providers[0], providers[2], providers[1]];
  } else {
    // AUTO: 3-way smooth round-robin distribution
    const startIdx = globalProviderIndex % providers.length;
    globalProviderIndex = (globalProviderIndex + 1) % providers.length;

    executionOrder = [
      providers[startIdx],
      providers[(startIdx + 1) % providers.length],
      providers[(startIdx + 2) % providers.length],
    ];

    // Deprioritize any currently blocked or degraded providers to the back of the queue
    executionOrder.sort((a, b) => {
      const aBlocked = telemetry?.providerHealth?.[a.id.toLowerCase()]?.isBlocked ? 1 : 0;
      const bBlocked = telemetry?.providerHealth?.[b.id.toLowerCase()]?.isBlocked ? 1 : 0;
      return aBlocked - bBlocked;
    });
  }

  let lastError = null;
  let lastStatus = 500;

  // Execute with Instant Auto-Failover across the 3 providers
  for (let i = 0; i < executionOrder.length; i++) {
    const p = executionOrder[i];
    const startTime = Date.now();
    try {
      const token = await p.getToken();
      const headers = p.buildHeaders(token);
      const data = p.buildPayload(payload);
      const url = `${p.base}${endpoint}`;

      const response = await axios({
        method,
        url,
        data,
        headers,
        timeout: 7000,
      });

      if (response.status >= 200 && response.status < 400 && response.data) {
        telemetry.recordUpstreamHit(p.name, endpoint, response.status, Date.now() - startTime);
        return {
          success: true,
          statusCode: response.status,
          latency: Date.now() - startTime,
          provider: p.name,
          data: response.data,
        };
      }
    } catch (err) {
      lastStatus = err.response?.status || 500;
      lastError = err.response?.data || err.message;
      const isBlocked = lastStatus === 422 || lastStatus === 403;

      console.warn(`[ProxyRequest] ${p.name} failed on ${endpoint} (Status: ${lastStatus}): ${err.message}. Trying next provider...`);

      if (telemetry?.providerHealth?.[p.id.toLowerCase()]) {
        telemetry.providerHealth[p.id.toLowerCase()].consecutiveErrors++;
        if (isBlocked) {
          telemetry.providerHealth[p.id.toLowerCase()].isBlocked = true;
          telemetry.providerHealth[p.id.toLowerCase()].status = "BLOCKED";
          telemetry.triggerAutoFailover(p.id.toLowerCase(), `${p.name} returned HTTP ${lastStatus}`);
        }
      }
      // Continue to next provider in loop (Zero user disruption)
    }
  }

  // If all 3 providers failed
  return {
    success: false,
    statusCode: lastStatus,
    error: lastError || "All providers (Nice444, Startexch99, CBTFexchange) timed out",
  };
};

