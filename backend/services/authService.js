import axios from "axios";
import { TARGET_BASE, httpsAgent, httpAgent } from "../config/hosts.js";

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
      return cachedToken;
    }
  } catch (err) {
    console.error("Error getting demo token:", err.message);
    scheduleTokenRetry();
  }
  return cachedToken;
};

export const getCachedIntCasinoToken = () => cachedIntCasinoToken;
export const getCachedUserDetail = () => cachedUserDetail;

export const proxyRequest = async (endpoint, payload = {}, method = "POST") => {
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
