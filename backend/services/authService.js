import axios from "axios";
import { TARGET_BASE, httpsAgent, httpAgent } from "../config/hosts.js";
import { telemetry } from "./telemetryService.js";

axios.defaults.httpsAgent = httpsAgent;
axios.defaults.httpAgent = httpAgent;

let cachedToken = null;
let cachedIntCasinoToken = null;
let cachedUserDetail = null;
let tokenExpiry = 0;
let tokenRetryTimer = null;

export const scheduleTokenRetry = () => {
  if (tokenRetryTimer) return;
  tokenRetryTimer = setTimeout(async () => {
    tokenRetryTimer = null;
    const t = await getDemoToken(true);
    if (t) {
      console.log("Nice444 session token successfully acquired on retry.");
    }
  }, 5000);
};

export const getDemoToken = async (forceRefresh = false) => {
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
      telemetry.recordAuthAttempt("nice444", true);
      return cachedToken;
    }
  } catch (err) {
    console.error("Error getting demo token:", err.message);
    telemetry.recordAuthAttempt("nice444", false, err.message);
    scheduleTokenRetry();
  }
  return cachedToken;
};

export const getCachedIntCasinoToken = () => cachedIntCasinoToken;
export const getCachedUserDetail = () => cachedUserDetail;

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

  if (cachedToken && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${cachedToken}`;
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
      return cachedStartexchToken;
    }
  } catch (err) {
    console.error("Error getting Startexch99 demo token:", err.message);
    telemetry.recordAuthAttempt("startexch99", false, err.message);
  }
  return cachedStartexchToken;
};

