import crypto from "crypto";
import axios from "axios";

const CDN_BASE = "https://draw.ar-lottery06.com/WinGo";
const API_BASE = "https://h5.ar-lottery06.com/api";

export const WINGO_GAMES = {
  "WinGo_30S": { name: "WinGo 30s", intervalSec: 30 },
  "WinGo_1M": { name: "WinGo 1 Min", intervalSec: 60 },
  "WinGo_3M": { name: "WinGo 3 Min", intervalSec: 180 },
  "WinGo_5M": { name: "WinGo 5 Min", intervalSec: 300 }
};

// Cached state in memory
const cache = {
  info: {},
  history: {},
  lastFetch: {}
};

// Signing algorithm matching 91 Club frontend
export function signLotteryParams(params) {
  const pow = Math.pow(10, 12);
  let random = Math.floor(Math.random() * pow);
  while (random < pow / 10 && random !== 0) {
    random = Math.floor(Math.random() * pow);
  }

  const p = { ...params, random };
  const keys = Object.keys(p).filter(
    k => p[k] !== null && p[k] !== "" && k !== "signature" && typeof p[k] !== "object"
  ).sort();

  const sortedObj = {};
  keys.forEach(k => {
    sortedObj[k] = p[k] === 0 ? 0 : p[k];
  });

  const jsonStr = JSON.stringify(sortedObj);
  const signature = crypto.createHash("md5").update(jsonStr).digest("hex").toUpperCase();

  p.signature = signature;
  p.timestamp = Math.floor(Date.now() / 1000);
  return p;
}

/**
 * Fetch real-time countdown & period info
 */
export async function getGameInfo(gameCode = "WinGo_30S") {
  const now = Date.now();
  const cached = cache.info[gameCode];
  if (cached && now - (cache.lastFetch[`info_${gameCode}`] || 0) < 1000) {
    const remainingSeconds = Math.max(0, Math.round((cached.current.endTime - now) / 1000));
    return {
      success: true,
      gameCode,
      ...cached,
      remainingSeconds
    };
  }

  try {
    const url = `${CDN_BASE}/${gameCode}.json?ts=${now}`;
    const res = await axios.get(url, { timeout: 4000 });
    const data = res.data;

    cache.info[gameCode] = data;
    cache.lastFetch[`info_${gameCode}`] = now;

    const remainingSeconds = Math.max(0, Math.round((data.current.endTime - now) / 1000));

    return {
      success: true,
      gameCode,
      ...data,
      remainingSeconds
    };
  } catch (err) {
    console.error(`[WinGo] Error fetching info for ${gameCode}:`, err.message);
    if (cached) {
      return {
        success: true,
        gameCode,
        ...cached,
        remainingSeconds: Math.max(0, Math.round((cached.current.endTime - now) / 1000))
      };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Fetch draw history (past winning numbers, colors, size)
 */
export async function getGameHistory(gameCode = "WinGo_30S") {
  const now = Date.now();
  const cached = cache.history[gameCode];
  if (cached && now - (cache.lastFetch[`hist_${gameCode}`] || 0) < 1500) {
    return { success: true, gameCode, list: cached };
  }

  try {
    const url = `${CDN_BASE}/${gameCode}/GetHistoryIssuePage.json?ts=${now}`;
    const res = await axios.get(url, { timeout: 4000 });
    const rawList = res.data?.data?.list || [];

    // Augment with Big/Small and formatted colors
    const formattedList = rawList.map(item => {
      const num = parseInt(item.number, 10);
      const isBig = num >= 5;
      return {
        ...item,
        isBig,
        size: isBig ? "Big" : "Small",
        colorType: item.color // 'green' | 'red' | 'red,violet' | 'green,violet'
      };
    });

    cache.history[gameCode] = formattedList;
    cache.lastFetch[`hist_${gameCode}`] = now;

    return {
      success: true,
      gameCode,
      list: formattedList
    };
  } catch (err) {
    console.error(`[WinGo] Error fetching history for ${gameCode}:`, err.message);
    if (cached) {
      return { success: true, gameCode, list: cached };
    }
    return { success: false, error: err.message, list: [] };
  }
}

/**
 * Place a Bet on WinGo
 */
export async function placeWinGoBet({ gameCode, issueNumber, amount, betMultiple = 1, betContent, token }) {
  if (!token) {
    return { success: false, error: "Authentication token required for placing bet" };
  }

  try {
    const payload = {
      gameCode,
      issueNumber,
      amount: Number(amount),
      betMultiple: Number(betMultiple),
      betContent: Array.isArray(betContent) ? betContent : [betContent]
    };

    const res = await axios.post(`${API_BASE}/Lottery/WinGoBet`, payload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Origin": "https://www.kanpur91.com",
        "Referer": "https://www.kanpur91.com/"
      },
      timeout: 6000
    });

    return {
      success: res.data?.code === 0,
      data: res.data
    };
  } catch (err) {
    return { success: false, error: err.response?.data?.msg || err.message };
  }
}

