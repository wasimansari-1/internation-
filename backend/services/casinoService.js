import axios from "axios";
import { httpsAgent, refreshHostIps } from "../config/hosts.js";
import { getDemoToken, getStartexchToken, proxyRequest } from "./authService.js";
import { telemetry } from "./telemetryService.js";

let ioClient = null;
try {
  const socketIoModule = await import("socket.io-client");
  ioClient = socketIoModule.io || socketIoModule.default?.io || socketIoModule.default;
} catch (e) {
  console.warn("Notice: socket.io-client not installed yet in node_modules. Running in resilient fallback mode.");
}

export const activeCasinoSubscribers = new Set([
  "99.0010", // 20-20 TEEN PATTI
  "99.0030", // LUCKY 7 - A
  "99.0013", // 1DAY TEEN PATTI
  "99.0016", // JOKER TEEN PATTI
  "99.0018", // DRAGON TIGER
  "99.0019", // 20-20 DRAGON TIGER
  "99.0020", // FAST DRAGON TIGER
  "99.0021", // 1 DAY DRAGON TIGER
  "99.0001", // BACCARAT
  "99.0002", // BACCARAT - A
  "99.0025", // ANDAR BAHAR - A
  "99.0034", // ANDAR BAHAR - C
  "99.0022", // 32 CARDS - A
  "99.0023", // 32 CARDS - B
  "99.0007", // 20-20 POKER - A
  "99.0008", // 20-20 POKER - B
  "99.0041", // DTL - A
  "99.0004", // DTL TEENPATTI
  "99.0014", // MUFLIS TEEN PATTI
  "99.0015", // POINT TEEN PATTI
  "99.0046", // 20-20 CARD RACE
  "99.0005", // AMAR AKBAR ANTHONY
  "99.0031", // LUCKY 7 - B
  "99.0032", // FAST LUCKY - 7
  "99.0040", // 3 CARD JUDGEMENT - A
  "99.0027", // CASINO WAR
  "99.0009", // INSTANT WORLI
  "99.0050", // BOLLYWOOD CASINO
  "99.0006", // INA MINA DIKA
]);
export const casinoOddsCache = new Map();
export const casinoLatestResultCache = new Map();
export const casinoResultsHistoryCache = new Map();
export const lastCelebratedWinnerCache = new Map();

/**
 * Extracts declared winner runner from Universe casino resultsArr
 * Works for Lucky 7, 32 Cards, Dragon Tiger, Baccarat, Amar Akbar Anthony, etc.
 */
export function extractWinnerFromResultsArr(resultsArr) {
  if (!Array.isArray(resultsArr) || resultsArr.length === 0) return null;
  const winnerMarket = resultsArr.find((m) => m.marketName === "WINNER" || m.index === 0) || resultsArr[0];
  if (!winnerMarket || !winnerMarket.runners) return null;

  if (Array.isArray(winnerMarket.runners)) {
    // 1. Check if TIE won on any table
    const tieWin = winnerMarket.runners.find(
      (r) =>
        (String(r.name || r.runnerName || "").toUpperCase().includes("TIE")) &&
        (r.result === "WINNER" || r.status === "WINNER" || r.result === "TIE" || r.status === "TIE")
    );
    if (tieWin) return "TIE";

    const allTie = winnerMarket.runners.every((r) => r.result === "TIE" || r.status === "TIE");
    if (winnerMarket.runners.length > 0 && allTie) return "TIE";

    const winRn = winnerMarket.runners.find((r) => r.result === "WINNER" || r.status === "WINNER");
    if (winRn) return winRn.name || winRn.runnerName || winRn.selectionId;
  } else if (typeof winnerMarket.runners === "object") {
    for (const [selectionId, status] of Object.entries(winnerMarket.runners)) {
      const runnerName = String(winnerMarket.runnersName?.[selectionId] || selectionId).toUpperCase();
      if ((status === "WINNER" || status === "TIE") && runnerName.includes("TIE")) {
        return "TIE";
      }
      if (status === "TIE") {
        return "TIE";
      }
      if (status === "WINNER") {
        return winnerMarket.runnersName?.[selectionId] || selectionId;
      }
    }
    const runnerStatuses = Object.values(winnerMarket.runners);
    if (runnerStatuses.length > 0 && runnerStatuses.every((s) => s === "TIE")) {
      return "TIE";
    }
  }
  return null;
}

export function resolveWinnerLabel(winner, runnerName, eventName = "", eventId = "") {
  const ev = (eventName || "").toUpperCase();
  const id = String(eventId || "");
  const w = String(winner || "").trim().toUpperCase();
  const rn = String(runnerName || "").trim().toUpperCase();

  // UNIVERSAL TIE: If any table has a Tie result, return "TIE" for badge display
  if (
    w === "TIE" ||
    w.includes("TIE") ||
    rn === "TIE" ||
    rn.includes("TIE") ||
    (w === "T" && (ev.includes("BACCARAT") || ev.includes("WAR") || ev.includes("TEEN")))
  ) {
    return "TIE";
  }

  // 1. Table specific overrides
  if (ev.includes("ANDAR") || id === "99.0025" || id === "99.0034") {
    if (w === "A" || w === "ANDAR") return "ANDAR";
    if (w === "B" || w === "BAHAR") return "BAHAR";
  }
  if (ev.includes("LUCKY") || id === "99.0030" || id === "99.0031" || id === "99.0032") {
    if (w === "L" || w === "LOW" || w === "LOW CARD") return "LOW CARD";
    if (w === "H" || w === "HIGH" || w === "HIGH CARD") return "HIGH CARD";
    if (w === "7" || w === "TIE" || w === "LUCKY 7") return "TIE";
  }
  if (ev.includes("BACCARAT") || id === "99.0001" || id === "99.0002") {
    if (w === "P" || w === "PLAYER") return "PLAYER";
    if (w === "B" || w === "BANKER") return "BANKER";
    if (w === "T" || w === "TIE") return "TIE";
  }
  if (ev.includes("AMAR") || id === "99.0005") {
    if (w === "A" || w === "AMAR") return "AMAR";
    if (w === "B" || w === "AKBAR") return "AKBAR";
    if (w === "C" || w === "ANTHONY") return "ANTHONY";
  }
  if (ev.includes("DRAGON") || id === "99.0018" || id === "99.0019" || id === "99.0020" || id === "99.0021") {
    if (w === "TIE") return "TIE";
    if (w === "D" || w === "DRAGON") return "DRAGON";
    if (w === "T" || w === "TIGER") return "TIGER";
  }
  if (ev.includes("DTL") || id === "99.0041" || id === "99.0004") {
    if (w === "TIE") return "TIE";
    if (w === "D" || w === "DRAGON") return "DRAGON";
    if (w === "T" || w === "TIGER") return "TIGER";
    if (w === "L" || w === "LION") return "LION";
  }
  if (ev.includes("32") || id === "99.0022" || id === "99.0023") {
    if (w.includes("TIE")) return "TIE";
    if (w.includes("8")) return "PLAYER 8";
    if (w.includes("9")) return "PLAYER 9";
    if (w.includes("10")) return "PLAYER 10";
    if (w.includes("11")) return "PLAYER 11";
  }
  if (ev.includes("WAR") || id === "99.0027") {
    if (w === "T" || w === "TIE") return "TIE";
    if (w === "R" || w.includes("RED")) return "RED";
    if (w === "B" || w.includes("BLACK")) return "BLACK";
  }

  // 2. Generic winner mappings
  if (w === "TIE" || w.includes("TIE")) return "TIE";
  if (w === "A" || w === "PLAYER_A" || w === "PLAYER A") return "PLAYER A";
  if (w === "B" || w === "PLAYER_B" || w === "PLAYER B") return "PLAYER B";
  if (w === "D" || w === "DRAGON") return "DRAGON";
  if (w === "T" || w === "TIGER") return "TIGER";
  if (w === "L" || w === "LOW" || w === "LOW CARD") return "LOW CARD";
  if (w === "H" || w === "HIGH" || w === "HIGH CARD") return "HIGH CARD";
  if (w === "7" || w === "LUCKY 7") return "LUCKY 7";

  if (runnerName) {
    const clean = runnerName.replace(/\(.*?\)/g, "").trim();
    if (clean.toUpperCase().includes("TIE")) return "TIE";
    if (clean) return clean;
  }

  if (w && w !== "WINNER" && w !== "DECLARED" && w !== "NULL" && w !== "UNDEFINED") {
    return String(winner).replace(/_/g, " ").trim();
  }
  return null;
}

let casinoSocket = null;
let startexchSocket = null;
let casinoSocketConnecting = false;
let casinoHeartbeatInterval = null;
let casinoWatchdogInterval = null;

// Fallback table cache to guarantee 200 OK even if network/upstream is momentarily unreachable
let cachedTableList = null;

// Template layout generator so every game always has cards face-down ('0') even before socket packets arrive
export function getDefaultCardsForTable(eventId = "", eventName = "") {
  const name = String(eventName || "").toUpperCase();
  const id = String(eventId || "");

  if (
    name.includes("DTL") ||
    id === "99.0041" ||
    id === "99.0004"
  ) {
    return {
      DRAGON: { card_1: "0" },
      TIGER: { card_1: "0" },
      LION: { card_1: "0" },
    };
  }
  if (
    name.includes("TEEN PATTI") ||
    id === "99.0010" ||
    id === "99.0013" ||
    id === "99.0014" ||
    id === "99.0015" ||
    id === "99.0016"
  ) {
    return {
      PLAYER_A: { card_1: "0", card_2: "0", card_3: "0" },
      PLAYER_B: { card_1: "0", card_2: "0", card_3: "0" },
    };
  }
  if (
    name.includes("DRAGON") ||
    id === "99.0018" ||
    id === "99.0019" ||
    id === "99.0020" ||
    id === "99.0021"
  ) {
    return {
      DRAGON: { card_1: "0" },
      TIGER: { card_1: "0" },
    };
  }
  if (
    name.includes("LUCKY") ||
    id === "99.0030" ||
    id === "99.0031" ||
    id === "99.0032"
  ) {
    return {
      CARD: { card_1: "0" },
    };
  }
  if (
    name.includes("32 CARDS") ||
    id === "99.0022" ||
    id === "99.0023"
  ) {
    return {
      PLAYER_8: { card_1: "0" },
      PLAYER_9: { card_1: "0" },
      PLAYER_10: { card_1: "0" },
      PLAYER_11: { card_1: "0" },
    };
  }
  if (
    name.includes("ANDAR") ||
    id === "99.0025" ||
    id === "99.0034"
  ) {
    return {
      ANDAR: { card_1: "0" },
      BAHAR: { card_1: "0" },
    };
  }
  if (
    name.includes("BACCARAT") ||
    id === "99.0001" ||
    id === "99.0002"
  ) {
    return {
      PLAYER: { card_1: "0", card_2: "0" },
      BANKER: { card_1: "0", card_2: "0" },
    };
  }
  return {
    PLAYER_A: { card_1: "0" },
    PLAYER_B: { card_1: "0" },
  };
}

/**
 * Checks whether all cards on the table are closed ('0' / face-down)
 * Returns true if all cards are closed or uninitialized.
 */
export function areCardsClosed(cardsArr) {
  if (!cardsArr || typeof cardsArr !== "object") return true;
  for (const group of Object.values(cardsArr)) {
    if (typeof group === "object" && group !== null) {
      for (const cardVal of Object.values(group)) {
        if (
          cardVal &&
          cardVal !== "0" &&
          cardVal !== "null" &&
          cardVal !== "-" &&
          cardVal !== "undefined"
        ) {
          return false; // Found an open dealt card
        }
      }
    } else if (typeof group === "string") {
      if (
        group &&
        group !== "0" &&
        group !== "null" &&
        group !== "-" &&
        group !== "undefined"
      ) {
        return false;
      }
    }
  }
  return true; // All cards are face down ('0') / closed
}

let lastSocketConnectAttempt = 0;

export async function ensureNiceCasinoSocket(forceReconnect = false) {
  if (
    !forceReconnect &&
    ((casinoSocket && casinoSocket.connected) ||
      (startexchSocket && startexchSocket.connected))
  ) {
    return casinoSocket?.connected ? casinoSocket : startexchSocket;
  }
  const now = Date.now();
  if (casinoSocketConnecting || now - lastSocketConnectAttempt < 5000) {
    for (let i = 0; i < 20; i++) {
      if (
        (casinoSocket && casinoSocket.connected) ||
        (startexchSocket && startexchSocket.connected)
      ) {
        return casinoSocket?.connected ? casinoSocket : startexchSocket;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return casinoSocket?.connected ? casinoSocket : startexchSocket;
  }
  casinoSocketConnecting = true;
  lastSocketConnectAttempt = now;

  try {
    if (forceReconnect) {
      if (casinoSocket && !casinoSocket.connected) {
        try {
          casinoSocket.removeAllListeners();
          casinoSocket.disconnect();
        } catch (e) {}
        casinoSocket = null;
      }
      if (startexchSocket && !startexchSocket.connected) {
        try {
          startexchSocket.removeAllListeners();
          startexchSocket.disconnect();
        } catch (e) {}
        startexchSocket = null;
      }
      await refreshHostIps("casino.nice444.com");
      await refreshHostIps("nice444.com");
      await refreshHostIps("casino.startexch99.com");
      await refreshHostIps("startexch99.com");
    }

    const [niceToken, startexchToken] = await Promise.all([
      getDemoToken(forceReconnect),
      getStartexchToken(forceReconnect),
    ]);

    if (!niceToken && !startexchToken) {
      casinoSocketConnecting = false;
      return null;
    }

    if (!ioClient) {
      try {
        const socketIoModule = await import("socket.io-client");
        ioClient = socketIoModule.io || socketIoModule.default?.io || socketIoModule.default;
      } catch (e) {
        casinoSocketConnecting = false;
        return null;
      }
    }

    const resubscribeAll = () => {
      for (const gId of activeCasinoSubscribers) {
        if (casinoSocket && casinoSocket.connected) {
          casinoSocket.emit("SCSN", { eventId: String(gId) });
        }
        if (startexchSocket && startexchSocket.connected) {
          startexchSocket.emit("SCSN", { eventId: String(gId) });
        }
      }
    };

    // 1. Initialize Nice444 Socket
    if (niceToken && !casinoSocket) {
      casinoSocket = ioClient("https://casino.nice444.com", {
        path: "/universecasino",
        transports: ["websocket", "polling"],
        transportOptions: {
          websocket: { agent: httpsAgent },
          polling: { agent: httpsAgent },
        },
        extraHeaders: {
          Origin: "https://casino.nice444.com",
          Referer: "https://casino.nice444.com/",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        reconnection: true,
        reconnectionDelay: 3000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        auth: { token: niceToken, uType: "usr" },
      });

      casinoSocket.on("connect", () => {
        console.log("Connected to Real Nice444 Casino Socket (/universecasino)");
        resubscribeAll();
      });

      casinoSocket.on("disconnect", async (reason) => {
        console.warn("[Nice444 Socket] Disconnected:", reason);
        if (reason === "io server disconnect" || reason === "transport error") {
          try {
            const freshToken = await getDemoToken(true);
            if (freshToken && casinoSocket) {
              casinoSocket.auth = { token: freshToken, uType: "usr" };
            }
          } catch (e) {}
          setTimeout(() => {
            if (casinoSocket && !casinoSocket.connected) {
              casinoSocket.connect();
            }
          }, 4000);
        }
      });

      casinoSocket.on("connect_error", async (err) => {
        console.warn("Nice444 Casino socket error:", err.message);
        if (
          err.message &&
          (err.message.includes("TOKEN") ||
            err.message.includes("AUTH") ||
            err.message === "INVALID_TOKEN")
        ) {
          try {
            const freshToken = await getDemoToken(true);
            if (freshToken && casinoSocket) {
              casinoSocket.auth = { token: freshToken, uType: "usr" };
              setTimeout(() => {
                if (casinoSocket && !casinoSocket.connected) {
                  casinoSocket.connect();
                }
              }, 1000);
            }
          } catch (e) {}
        }
        refreshHostIps("casino.nice444.com").catch(() => {});
      });
    }

    // 2. Initialize Startexch99 Socket (isolated secondary socket)
    if (startexchToken && !startexchSocket) {
      startexchSocket = ioClient("https://casino.startexch99.com", {
        path: "/universecasino",
        transports: ["websocket", "polling"],
        transportOptions: {
          websocket: { agent: httpsAgent },
          polling: { agent: httpsAgent },
        },
        extraHeaders: {
          Origin: "https://casino.startexch99.com",
          Referer: "https://casino.startexch99.com/",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        reconnection: true,
        reconnectionDelay: 5000,
        reconnectionDelayMax: 15000,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        auth: { token: startexchToken, uType: "usr" },
      });

      startexchSocket.on("connect", () => {
        console.log("Connected to Real Startexch99 Casino Socket (/universecasino)");
        resubscribeAll();
      });

      startexchSocket.on("disconnect", async (reason) => {
        console.warn("[Startexch99 Socket] Disconnected:", reason);
        if (reason === "io server disconnect" || reason === "transport error") {
          try {
            const freshToken = await getStartexchToken(true);
            if (freshToken && startexchSocket) {
              startexchSocket.auth = { token: freshToken, uType: "usr" };
            }
          } catch (e) {}
          setTimeout(() => {
            if (startexchSocket && !startexchSocket.connected) {
              startexchSocket.connect();
            }
          }, 5000);
        }
      });

      startexchSocket.on("connect_error", async (err) => {
        console.warn("Startexch99 Casino socket error:", err.message);
        if (
          err.message &&
          (err.message.includes("TOKEN") ||
            err.message.includes("AUTH") ||
            err.message === "INVALID_TOKEN")
        ) {
          try {
            const freshToken = await getStartexchToken(true);
            if (freshToken && startexchSocket) {
              startexchSocket.auth = { token: freshToken, uType: "usr" };
              setTimeout(() => {
                if (startexchSocket && !startexchSocket.connected) {
                  startexchSocket.connect();
                }
              }, 1000);
            }
          } catch (e) {}
        }
        refreshHostIps("casino.startexch99.com").catch(() => {});
      });
    }

    if (!casinoHeartbeatInterval) {
      casinoHeartbeatInterval = setInterval(resubscribeAll, 8000);
    }

    if (!casinoWatchdogInterval) {
      casinoWatchdogInterval = setInterval(() => {
        const niceConnected = casinoSocket && casinoSocket.connected;
        const startConnected = startexchSocket && startexchSocket.connected;
        if (!niceConnected && !startConnected) {
          const timeSince = Date.now() - lastSocketConnectAttempt;
          if (timeSince > 30000) {
            if (casinoSocket && !casinoSocket.connected) {
              casinoSocket.connect();
            }
            if (startexchSocket && !startexchSocket.connected) {
              startexchSocket.connect();
            }
          }
        }
      }, 15000);
    }

      const handleCasinoPacket = (raw) => {
        try {
          let packet = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (!packet) return;

          if (Array.isArray(packet)) {
            packet = packet[0] || {};
          }

          let payload = packet.data;
          if (Array.isArray(payload)) {
            payload = payload[0] || {};
          }

          const eventId = String(
            packet.eventId || payload?.eventId || payload?._id || packet._id || "",
          );

          if (!eventId) return;

          const existing = casinoOddsCache.get(eventId) || {
            eventId,
            marketArr: [],
            cardsArr: getDefaultCardsForTable(eventId),
            leftSec: 45,
            initialLeftSec: 45,
            leftSecReceivedAt: Date.now(),
            roundId: "",
            status: "ONLINE",
            roundStatus: "PLACE_THE_BET",
          };

          const incomingRoundId = payload?.roundId || packet.roundId;
          const isNewRound = Boolean(
            incomingRoundId &&
              existing.roundId &&
              String(incomingRoundId) !== String(existing.roundId),
          );

          const roundId = incomingRoundId || existing.roundId;
          const eventName =
            payload?.eventName || packet.eventName || existing.eventName;

          // Status & RoundStatus management
          let status = existing.status || "ONLINE";
          let roundStatus = existing.roundStatus || "PLACE_THE_BET";
          let gameResult = existing.gameResult || null;

          if (isNewRound) {
            status = payload?.status || "ONLINE";
            roundStatus = payload?.roundStatus || "PLACE_THE_BET";
            gameResult = null; // Clear past round result on new round
            existing.winner = null;
            existing.gameResult = null;
            existing.badgeresult = null;
            existing.badgeResult = null;
            lastCelebratedWinnerCache.delete(eventId);
          } else {
            if (payload?.status !== undefined) status = payload.status;
            if (packet?.status !== undefined) status = packet.status;
            if (payload?.roundStatus !== undefined) roundStatus = payload.roundStatus;
            if (packet?.roundStatus !== undefined) roundStatus = packet.roundStatus;
            if (payload?.gameResult !== undefined) gameResult = payload.gameResult;
            if (packet?.gameResult !== undefined) gameResult = packet.gameResult;
          }

          // Timer management
          let initialLeftSec = existing.initialLeftSec ?? 45;
          let leftSecReceivedAt = existing.leftSecReceivedAt || Date.now();

          const incomingLeftSec =
            payload?.leftSec !== undefined ? payload.leftSec : packet?.leftSec;

          if (isNewRound) {
            initialLeftSec = Number(payload?.seconds || payload?.leftSec || 45);
            leftSecReceivedAt = Date.now();
          } else if (incomingLeftSec !== undefined) {
            initialLeftSec = Number(incomingLeftSec);
            leftSecReceivedAt = Date.now();
          }

          const isSuspended =
            status === "SUSPEND" ||
            status === "SUSPENDED" ||
            roundStatus === "SUSPEND" ||
            roundStatus === "SUSPENDED" ||
            roundStatus === "CARD_SCAN" ||
            roundStatus === "RESULT_DECLARED";

          const elapsedSec = Math.floor((Date.now() - leftSecReceivedAt) / 1000);
          const computedLeftSec = isSuspended
            ? 0
            : Math.max(0, initialLeftSec - elapsedSec);

          // Cards management (Case-insensitive merge for all table layouts)
          let currentCards;
          if (isNewRound || !existing.cardsArr || Object.keys(existing.cardsArr).length === 0) {
            currentCards = getDefaultCardsForTable(eventId, eventName);
          } else {
            currentCards = JSON.parse(JSON.stringify(existing.cardsArr));
          }

          const incomingCards =
            payload?.cardsArr || payload?.cards || packet.cardsArr || packet.cards;
          if (incomingCards && typeof incomingCards === "object") {
            for (const [rawK, v] of Object.entries(incomingCards)) {
              const k = rawK.toUpperCase();
              if (typeof v === "object" && v !== null && !Array.isArray(v)) {
                if (!currentCards[k] || typeof currentCards[k] !== "object") {
                  currentCards[k] = {};
                }
                Object.assign(currentCards[k], v);
              } else if (typeof v === "string") {
                if (!currentCards[k] || typeof currentCards[k] !== "object") {
                  currentCards[k] = { card_1: v };
                } else {
                  currentCards[k].card_1 = v;
                }
              } else if (Array.isArray(v)) {
                if (!currentCards[k] || typeof currentCards[k] !== "object") {
                  currentCards[k] = {};
                }
                v.forEach((val, idx) => {
                  currentCards[k][`card_${idx + 1}`] = val || "0";
                });
              }
            }
          }

          // Markets & Live Odds Updates
          let currentMarketArr = existing.marketArr
            ? JSON.parse(JSON.stringify(existing.marketArr))
            : [];

          if (Array.isArray(payload?.marketArr) && payload.marketArr.length > 0) {
            currentMarketArr = payload.marketArr;
          } else if (Array.isArray(packet?.marketArr) && packet.marketArr.length > 0) {
            currentMarketArr = packet.marketArr;
          }

          // Apply dotted live odds & status updates (e.g. marketArr.0.runners.1.price.back.0.size)
          const targetObj = payload && typeof payload === "object" ? payload : packet;
          if (targetObj && typeof targetObj === "object" && !Array.isArray(targetObj)) {
            for (const [key, val] of Object.entries(targetObj)) {
              if (key === "status") {
                status = val;
              } else if (key === "roundStatus") {
                roundStatus = val;
              } else if (key === "gameResult") {
                gameResult = val;
              } else if (key.startsWith("cardsArr.") || key.startsWith("cards.")) {
                const parts = key.split(".");
                if (parts.length === 3) {
                  const k = parts[1].toUpperCase();
                  if (!currentCards[k] || typeof currentCards[k] !== "object") {
                    currentCards[k] = {};
                  }
                  currentCards[k][parts[2]] = val;
                } else if (parts.length === 2) {
                  const k = parts[1].toUpperCase();
                  if (!currentCards[k] || typeof currentCards[k] !== "object") {
                    currentCards[k] = { card_1: val };
                  } else {
                    currentCards[k].card_1 = val;
                  }
                }
              } else if (key.startsWith("marketArr.")) {
                const parts = key.split(".");
                const mIdx = parseInt(parts[1], 10);
                if (currentMarketArr[mIdx]) {
                  if (parts.length === 3 && parts[2] === "status") {
                    currentMarketArr[mIdx].status = val;
                  } else if (parts[2] === "runners") {
                    const rIdx = parseInt(parts[3], 10);
                    if (
                      currentMarketArr[mIdx].runners &&
                      currentMarketArr[mIdx].runners[rIdx]
                    ) {
                      const runner = currentMarketArr[mIdx].runners[rIdx];
                      if (parts.length === 5 && parts[4] === "status") {
                        runner.status = val;
                      } else if (parts[4] === "price") {
                        const backIdx = parseInt(parts[6] || 0, 10);
                        const prop = parts[parts.length - 1];
                        if (!runner.price)
                          runner.price = { back: [{ price: 0, size: 0 }] };
                        if (!runner.price.back)
                          runner.price.back = [{ price: 0, size: 0 }];
                        if (!runner.price.back[backIdx])
                          runner.price.back[backIdx] = { price: 0, size: 0 };
                        runner.price.back[backIdx][prop] = Number(val);
                      }
                    }
                  }
                }
              }
            }
          }

          const cardsClosed = areCardsClosed(currentCards);
          const isRoundReset = isNewRound || cardsClosed || roundStatus === "PLACE_THE_BET";

          const merged = {
            eventId,
            eventName,
            roundId,
            leftSec: computedLeftSec,
            initialLeftSec,
            leftSecReceivedAt,
            roundStatus,
            status: isSuspended ? "SUSPEND" : status,
            cardsArr: currentCards,
            marketArr: currentMarketArr,
            gameResult: isRoundReset ? null : gameResult,
            badgeresult: isRoundReset ? null : (existing.badgeresult || null),
            badgeResult: isRoundReset ? null : (existing.badgeResult || null),
            winner: isRoundReset ? null : (existing.winner || null),
            lastUpdated: Date.now(),
          };

          if (isRoundReset) {
            lastCelebratedWinnerCache.delete(eventId);
          }

          casinoOddsCache.set(eventId, merged);

          // Instant Result Recording for the Dedicated Results API (<1ms latency)
          const incomingResultsArr = payload?.resultsArr || packet?.resultsArr;
          let resultsArrWinner = null;
          if (incomingResultsArr && !isRoundReset) {
            resultsArrWinner = extractWinnerFromResultsArr(incomingResultsArr);
          }

          let declaredWinner = isRoundReset
            ? null
            : (resultsArrWinner ||
               gameResult ||
               payload?.gameResult ||
               packet?.gameResult ||
               payload?.winner ||
               packet?.winner);

          if (
            !isRoundReset &&
            (declaredWinner ||
              roundStatus === "RESULT_DECLARED" ||
              payload?.roundStatus === "RESULT_DECLARED")
          ) {
            if (declaredWinner) {
              const resolved = resolveWinnerLabel(declaredWinner, null, merged.eventName, eventId);
              if (resolved && resolved !== "WINNER" && resolved !== "DECLARED") {
                merged.winner = resolved;
                merged.gameResult = resolved;
                merged.badgeresult = resolved;
                merged.badgeResult = resolved;
                merged.roundStatus = "RESULT_DECLARED";
                merged.status = "SUSPEND";

                const resultPayload = {
                  eventId,
                  eventName: merged.eventName,
                  roundId,
                  winner: resolved,
                  gameResult: resolved,
                  badgeresult: resolved,
                  badgeResult: resolved,
                  status: "RESULT_DECLARED",
                  roundStatus: "RESULT_DECLARED",
                  cardsArr: JSON.parse(JSON.stringify(currentCards)),
                  timestamp: Date.now(),
                  declaredAt: new Date().toISOString(),
                };
                casinoLatestResultCache.set(eventId, resultPayload);
                lastCelebratedWinnerCache.set(eventId, {
                  label: resolved,
                  roundId,
                  declaredAt: Date.now(),
                });

                const history = casinoResultsHistoryCache.get(eventId) || [];
                if (!history.find((h) => h.roundId === roundId)) {
                  history.unshift(resultPayload);
                  if (history.length > 50) history.pop();
                  casinoResultsHistoryCache.set(eventId, history);
                }
              }
            } else {
              // Asynchronously query actual winner if socket payload omitted it
              getDedicatedCasinoResult(eventId)
                .then((resObj) => {
                  if (resObj?.data?.winner) {
                    const resolved = resolveWinnerLabel(resObj.data.winner, null, merged.eventName, eventId);
                    if (resolved && resolved !== "WINNER" && resolved !== "DECLARED") {
                      const live = casinoOddsCache.get(eventId);
                      if (live && String(live.roundId) === String(roundId)) {
                        live.winner = resolved;
                        live.gameResult = resolved;
                        live.badgeresult = resolved;
                        live.badgeResult = resolved;
                        lastCelebratedWinnerCache.set(eventId, {
                          label: resolved,
                          roundId,
                          declaredAt: Date.now(),
                        });
                      }
                    }
                  }
                })
                .catch(() => {});
            }
          }
        } catch (err) {
          console.warn("Casino packet parse error:", err.message);
        }
      };

      if (casinoSocket) {
        casinoSocket.on("casino_odds", handleCasinoPacket);
        casinoSocket.on("message", handleCasinoPacket);
        casinoSocket.on("connect_error", (err) => {
          console.warn("Nice444 Casino socket error:", err.message);
        });
      }

      if (startexchSocket) {
        startexchSocket.on("casino_odds", handleCasinoPacket);
        startexchSocket.on("message", handleCasinoPacket);
        startexchSocket.on("connect_error", (err) => {
          console.warn("Startexch99 Casino socket error:", err.message);
        });
      }

    // Await actual socket connection (up to 3 seconds)
    for (let i = 0; i < 30; i++) {
      if (
        (casinoSocket && casinoSocket.connected) ||
        (startexchSocket && startexchSocket.connected)
      ) {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  } finally {
    casinoSocketConnecting = false;
  }

  return casinoSocket?.connected ? casinoSocket : startexchSocket;
}

// Pre-connect casino socket
setTimeout(() => {
  ensureNiceCasinoSocket().catch(() => {});
}, 1000);

export async function getScrapedCasinoLiveOdds(gameId) {
  const gId = String(gameId);
  activeCasinoSubscribers.add(gId);
  if (casinoSocket && casinoSocket.connected) {
    casinoSocket.emit("SCSN", { eventId: gId });
  }
  if (startexchSocket && startexchSocket.connected) {
    startexchSocket.emit("SCSN", { eventId: gId });
  }
  if (!casinoSocket?.connected && !startexchSocket?.connected) {
    ensureNiceCasinoSocket().catch(() => {});
  }

  // If cache is empty, wait up to 400ms for incoming socket packet
  let cached = casinoOddsCache.get(gId);
  if (!cached || !cached.roundId) {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 50));
      cached = casinoOddsCache.get(gId);
      if (cached && cached.roundId) break;
    }
  }

  const now = Date.now();
  const timeSinceLastUpdate = now - (cached?.lastUpdated || 0);

  if (cached && timeSinceLastUpdate > 15000) {
    // Force reconnect socket with fresh token if silent for > 15 seconds
    ensureNiceCasinoSocket(true).catch(() => {});
  }

  // Use fast live socket cache only if fresh (< 20 seconds). If older, fall through to fresh REST fetch!
  if (cached && cached.roundId && timeSinceLastUpdate < 20000) {
    const elapsed = Math.floor(
      (now - (cached.leftSecReceivedAt || cached.lastUpdated || now)) / 1000,
    );
    const isSuspended =
      cached.roundStatus === "RESULT_DECLARED" ||
      cached.roundStatus === "CARD_SCAN" ||
      cached.roundStatus === "SUSPEND" ||
      cached.status === "SUSPEND";

    const isDeclared =
      cached.roundStatus === "RESULT_DECLARED" || Boolean(cached.gameResult);

    // Auto-advance out of declared result screen after 7 seconds so UI never gets stuck
    if (isDeclared && elapsed > 7) {
      return {
        ...cached,
        roundStatus: "PLACE_THE_BET",
        status: "ONLINE",
        winner: null,
        gameResult: null,
        badgeresult: null,
        badgeResult: null,
        cardsArr: getDefaultCardsForTable(gId, cached.eventName),
        leftSec: Math.max(0, 45 - (elapsed - 7)),
      };
    }

    const liveLeftSec = isSuspended
      ? 0
      : Math.max(0, (cached.initialLeftSec ?? cached.leftSec ?? 0) - elapsed);

    // CRITICAL: When cards are closed ('0') or new active round has started,
    // NEVER return badgeresult/winner! Badge MUST immediately close!
    const cardsClosed = areCardsClosed(cached.cardsArr);
    const isActiveRound = cached.roundStatus === "PLACE_THE_BET" || (liveLeftSec > 0 && !isSuspended);

    if (cardsClosed || isActiveRound) {
      return {
        ...cached,
        status: isSuspended && !cardsClosed ? "SUSPEND" : cached.status,
        leftSec: liveLeftSec,
        winner: null,
        gameResult: null,
        badgeresult: null,
        badgeResult: null,
      };
    }

    return {
      ...cached,
      status: isSuspended ? "SUSPEND" : cached.status,
      leftSec: liveLeftSec,
    };
  }

  try {
    const token = await getDemoToken();
    const upstreamRes = await axios.post(
      "https://casino.nice444.com/casinoapp/users/casino/casinoEventResults",
      { eventId: gId },
      {
        headers: {
          Origin: "https://casino.nice444.com",
          Referer: "https://casino.nice444.com/",
          Authorization: `Bearer ${token}`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 4000,
      },
    );
    const resultsData = upstreamRes.data?.data || [];
    const latest = resultsData[0] || {};

    const rawResults = latest.results || [];
    const scrapedMarkets = rawResults.map((m, mIdx) => {
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
          status: "OPEN",
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
        marketId: m.marketId || `${latest.roundId || Date.now()}_${mIdx}`,
        marketName: mName,
        min: m.min ?? m.minBet ?? m.minStake ?? null,
        max: m.max ?? m.maxBet ?? m.maxStake ?? null,
        runners,
        runnersName: m.runnersName || {},
      };
    });

    const resolvedWinner = resolveWinnerLabel(latest.winner || latest.gameResult, null, latest.eventName, gId);
    const seeded = {
      eventId: gId,
      eventName: latest.eventName || `CASINO TABLE ${gId}`,
      roundId: latest.roundId || String(Date.now()),
      leftSec: 0,
      initialLeftSec: 0,
      leftSecReceivedAt: Date.now(),
      status: "SUSPEND",
      roundStatus: "RESULT_DECLARED",
      cardsArr: latest.cards || getDefaultCardsForTable(gId, latest.eventName),
      marketArr: scrapedMarkets,
      winner: resolvedWinner,
      gameResult: resolvedWinner,
      badgeresult: resolvedWinner,
      badgeResult: resolvedWinner,
      lastUpdated: Date.now(),
    };
    casinoOddsCache.set(gId, seeded);
    return seeded;
  } catch (err) {
    return (
      cached || {
        eventId: gId,
        roundId: "",
        leftSec: 0,
        status: "SUSPEND",
        roundStatus: "SUSPEND",
        cardsArr: getDefaultCardsForTable(gId),
        marketArr: [],
      }
    );
  }
}

/**
 * Dedicated, ultra-fast casino round result API
 * Returns declared winner, round ID, and cards with <1ms in-memory speed
 */
export async function getDedicatedCasinoResult(gameId) {
  const gId = String(gameId);
  activeCasinoSubscribers.add(gId);
  ensureNiceCasinoSocket().catch(() => {});

  // 1. Instant declared result from live WebSocket stream RAM cache (<1ms latency)
  const latest = casinoLatestResultCache.get(gId);
  if (latest && latest.roundId) {
    return {
      success: true,
      data: latest,
      source: "live_socket_stream",
    };
  }

  // 2. Check if current live odds in RAM has a declared winner
  const liveOdds = casinoOddsCache.get(gId);
  if (liveOdds && (liveOdds.gameResult || liveOdds.winner || liveOdds.roundStatus === "RESULT_DECLARED")) {
    const rawWinner = liveOdds.winner || liveOdds.gameResult;
    if (rawWinner) {
      const resolved = resolveWinnerLabel(rawWinner, null, liveOdds.eventName, gId);
      const res = {
        eventId: gId,
        eventName: liveOdds.eventName,
        roundId: liveOdds.roundId,
        winner: resolved,
        gameResult: resolved,
        badgeresult: resolved,
        badgeResult: resolved,
        status: "RESULT_DECLARED",
        roundStatus: "RESULT_DECLARED",
        cardsArr: liveOdds.cardsArr,
        timestamp: Date.now(),
        declaredAt: new Date().toISOString(),
      };
      casinoLatestResultCache.set(gId, res);
      return { success: true, data: res, source: "live_odds_cache" };
    }
  }

  // 3. Upstream results API fallback
  try {
    const token = await getDemoToken();
    const upstreamRes = await axios.post(
      "https://casino.nice444.com/casinoapp/users/casino/casinoEventResults",
      { eventId: gId },
      {
        headers: {
          Origin: "https://casino.nice444.com",
          Referer: "https://casino.nice444.com/",
          Authorization: `Bearer ${token}`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        timeout: 4000,
      },
    );
    const resultsData = upstreamRes.data?.data || [];
    const first = resultsData[0];
    if (first) {
      const mainMkt = first.results?.find((m) => m.marketName === "WINNER" || m.index === 0);
      const winRunner = mainMkt?.runners?.find((rn) => rn.result === "WINNER");
      const runnerName = winRunner && mainMkt?.runnersName ? mainMkt.runnersName[winRunner.selectionId] : null;

      const resolved = resolveWinnerLabel(first.winner || first.gameResult, runnerName, first.eventName, gId);

      const formatted = {
        eventId: gId,
        eventName: first.eventName,
        roundId: first.roundId,
        winner: resolved,
        gameResult: resolved,
        badgeresult: resolved,
        badgeResult: resolved,
        status: "RESULT_DECLARED",
        roundStatus: "RESULT_DECLARED",
        cardsArr: first.cards || getDefaultCardsForTable(gId, first.eventName),
        results: first.results || [],
        timestamp: Date.now(),
        declaredAt: new Date().toISOString(),
      };
      casinoLatestResultCache.set(gId, formatted);
      return { success: true, data: formatted, source: "upstream_results" };
    }
  } catch (e) {}

  return {
    success: false,
    message: "No declared result available yet for this game round",
    data: null,
  };
}

export async function getCasinoTableList(id = 110) {
  return telemetry.deduplicateOrFetch(`casino_tables_${id}`, 2500, async () => {
    try {
      const result = await proxyRequest(
        "/api/exchange/navigations/casino/casinoTableList",
        { id },
      );
      if (result.success && result.data?.data && Array.isArray(result.data.data)) {
        const filtered = result.data.data.filter(
          (t) =>
            t.eventId !== "88.0022" &&
            t.eventId !== "88.0023" &&
            !(t.eventName || "").toUpperCase().includes("BALLOON") &&
            !(t.eventName || "").toUpperCase().includes("VIMAAN") &&
            !(t.eventName || "").toUpperCase().includes("AVIATOR"),
        );
        cachedTableList = filtered;
        return { success: true, statusCode: 200, data: filtered };
      }
    } catch (err) {
      console.warn("Error fetching casino tables from upstream:", err.message);
    }

    // If cached list is available, return it
    if (cachedTableList && cachedTableList.length > 0) {
      return { success: true, statusCode: 200, data: cachedTableList };
    }

    // Default initial table list to prevent 500 error under sandbox or network interruption
    const fallbackList = [
      { eventId: "99.0010", eventName: "20-20 TEEN PATTI", companyName: "UNIVERSE" },
      { eventId: "99.0030", eventName: "LUCKY 7 - A", companyName: "UNIVERSE" },
      { eventId: "99.0013", eventName: "1DAY TEEN PATTI", companyName: "UNIVERSE" },
      { eventId: "99.0016", eventName: "JOKER TEEN PATTI", companyName: "UNIVERSE" },
      { eventId: "99.0018", eventName: "DRAGON TIGER", companyName: "UNIVERSE" },
      { eventId: "99.0001", eventName: "BACCARAT", companyName: "UNIVERSE" },
      { eventId: "99.0002", eventName: "BACCARAT - A", companyName: "UNIVERSE" },
      { eventId: "99.0025", eventName: "ANDAR BAHAR - A", companyName: "UNIVERSE" },
      { eventId: "99.0022", eventName: "32 CARDS - A", companyName: "UNIVERSE" },
      { eventId: "99.0007", eventName: "20-20 POKER - A", companyName: "UNIVERSE" },
      { eventId: "99.0041", eventName: "DTL - A", companyName: "UNIVERSE" },
      { eventId: "99.0021", eventName: "1 DAY DRAGON TIGER", companyName: "UNIVERSE" },
      { eventId: "99.0014", eventName: "MUFLIS TEEN PATTI", companyName: "UNIVERSE" },
      { eventId: "99.0046", eventName: "20-20 CARD RACE", companyName: "UNIVERSE" },
      { eventId: "99.0005", eventName: "AMAR AKBAR ANTHONY", companyName: "UNIVERSE" },
      { eventId: "99.0019", eventName: "20-20 DRAGON TIGER", companyName: "UNIVERSE" },
      { eventId: "99.0031", eventName: "LUCKY 7 - B", companyName: "UNIVERSE" },
      { eventId: "99.0032", eventName: "FAST LUCKY - 7", companyName: "UNIVERSE" },
      { eventId: "99.0020", eventName: "FAST DRAGON TIGER", companyName: "UNIVERSE" },
      { eventId: "99.0023", eventName: "32 CARDS - B", companyName: "UNIVERSE" },
      { eventId: "99.0034", eventName: "ANDAR BAHAR - C", companyName: "UNIVERSE" },
      { eventId: "99.0008", eventName: "20-20 POKER - B", companyName: "UNIVERSE" },
      { eventId: "99.0015", eventName: "POINT TEEN PATTI", companyName: "UNIVERSE" },
      { eventId: "99.0004", eventName: "DTL TEENPATTI", companyName: "UNIVERSE" },
      { eventId: "99.0040", eventName: "3 CARD JUDGEMENT - A", companyName: "UNIVERSE" },
      { eventId: "99.0027", eventName: "CASINO WAR", companyName: "UNIVERSE" },
      { eventId: "99.0009", eventName: "INSTANT WORLI", companyName: "UNIVERSE" },
      { eventId: "99.0050", eventName: "BOLLYWOOD CASINO", companyName: "UNIVERSE" },
      { eventId: "99.0006", eventName: "INA MINA DIKA", companyName: "UNIVERSE" },
    ];
    return { success: true, statusCode: 200, data: fallbackList };
  });
}

