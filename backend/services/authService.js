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

export const proxyRequest = async (endpoint, payload = {}, method = "POST") => {
  const startTime = Date.now();
  const url = `${TARGET_BASE}${endpoint}`;
  try {
    const response = await axios({
      method,
      url,
      data: payload,
      headers: getStealthHeaders(),
      timeout: 10000,
    });
    telemetry.recordUpstreamHit("Nice444", endpoint, response.status, Date.now() - startTime);
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

// Startexch99 Integration (Dual-Provider Load Balancing)
export const STARTEXCH_BASE = "https://startexch99.com";
export const STARTEXCH_CASINO_BASE = "https://casino.startexch99.com";

let cachedStartexchToken = null;
let startexchTokenExpiry = 0;

export const getStartexchToken = async (forceRefresh = false) => {
  if (!forceRefresh && cachedStartexchToken && Date.now() < startexchTokenExpiry) {
    return cachedStartexchToken;
  }
  try {
    const res = await axios.post(
      `${STARTEXCH_BASE}/app/users/userLogin`,
      {
        userName: "smdemo",
        password: "Asdf12345",
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
      cachedStartexchToken = res.data.data.accessToken;
      startexchTokenExpiry = Date.now() + 30 * 60 * 1000;
      telemetry.recordAuthAttempt("startexch99", true);
      telemetry.recordUpstreamHit("Startexch99", "/app/users/userLogin", 200, 180);
      return cachedStartexchToken;
    }
  } catch (err) {
    console.error("Error getting Startexch99 demo token:", err.message);
    telemetry.recordAuthAttempt("startexch99", false, err.message);
  }
  return cachedStartexchToken;
};

