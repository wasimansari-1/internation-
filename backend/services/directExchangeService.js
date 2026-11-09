import axios from "axios";
import CryptoJS from "crypto-js";
import fs from "fs";
import path from "path";
import { getLiveScoreData } from "./sportsService.js";
import {
  casinoOddsCache,
  casinoLatestResultCache,
  casinoResultsHistoryCache
} from "./casinoService.js";

// Primary Direct API Targets (No Chrome / No Headless Viewer)
export const DIRECT_HOSTS = [
  "https://mouseexch.com",
  "https://br365bet.live"
];

let currentHostIndex = 0;
export const getActiveHost = () => DIRECT_HOSTS[currentHostIndex % DIRECT_HOSTS.length];
export const switchNextHost = () => {
  currentHostIndex++;
  console.log(`[DirectExchange] Switched upstream target to: ${getActiveHost()}`);
  return getActiveHost();
};

const AES_KEY = "cae7b808-8b1e-4f47-87a5-1a4b6a08030e";

export function encryptPayload(data = {}) {
  const jsonStr = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonStr, AES_KEY).toString();
}

export function decryptResponse(cipherText) {
  if (!cipherText || typeof cipherText !== "string") return cipherText;
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, AES_KEY);
    const decoded = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

// Stored direct session
const SESSION_FILE = path.resolve(process.cwd(), ".direct_exchange_session.json");
let exchangeSession = {
  token: null,
  cookies: "",
  lastLogin: Date.now(),
  balance: 1500.0,
  username: "Demo",
  status: "DIRECT_ACTIVE"
};

try {
  if (fs.existsSync(SESSION_FILE)) {
    const saved = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    if (saved.token || saved.cookies) {
      Object.assign(exchangeSession, saved);
    }
  }
} catch (e) {}

export function getExchangeSession() {
  return exchangeSession;
}

export function setExchangeSession(sessionData) {
  Object.assign(exchangeSession, sessionData);
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(exchangeSession, null, 2));
  } catch (e) {}
}

// 1. Direct REST Request Handler (Pure HTTP - Zero Browser Dependency)
export async function directPost(endpoint, rawPayload = {}, customHost = null) {
  const host = customHost || getActiveHost();
  const url = `${host}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const encryptedBody = { data: encryptPayload(rawPayload) };

  const headers = {
    "Content-Type": "application/json",
    "Origin": host,
    "Referer": `${host}/`,
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "application/json, text/plain, */*",
    ...(exchangeSession.token ? { "Authorization": `Bearer ${exchangeSession.token}`, "token": exchangeSession.token } : {}),
    ...(exchangeSession.cookies ? { "Cookie": exchangeSession.cookies } : {})
  };

  try {
    const res = await axios.post(url, encryptedBody, {
      headers,
      timeout: 5000
    });

    if (res.data?.data) {
      const dec = decryptResponse(res.data.data);
      if (dec && dec.status !== 401 && dec.status !== 300) {
        return dec;
      }
    }
    return res.data;
  } catch (err) {
    // If current host timed out or blocked, try backup host once
    if (!customHost && DIRECT_HOSTS.length > 1) {
      const backupHost = DIRECT_HOSTS[(currentHostIndex + 1) % DIRECT_HOSTS.length];
      try {
        return await directPost(endpoint, rawPayload, backupHost);
      } catch (e) {}
    }
    return null;
  }
}

// 2. Full Sports Categories Tree
export const ALL_SPORTS_TREE = [
  { eid: 4, id: 4, name: "Cricket", ename: "Cricket", tab: true, oid: 1 },
  { eid: 1, id: 1, name: "Football", ename: "Football", tab: true, oid: 2 },
  { eid: 2, id: 2, name: "Tennis", ename: "Tennis", tab: true, oid: 3 },
  { eid: 8, id: 8, name: "Table Tennis", ename: "Table Tennis", tab: true, oid: 4 },
  { eid: 10, id: 10, name: "Horse Racing", ename: "Horse Racing", tab: true, oid: 5 },
  { eid: 65, id: 65, name: "Greyhound Racing", ename: "Greyhound Racing", tab: true, oid: 6 },
  { eid: 15, id: 15, name: "Basketball", ename: "Basketball", tab: true, oid: 7 },
  { eid: 22, id: 22, name: "Badminton", ename: "Badminton", tab: true, oid: 8 },
  { eid: 18, id: 18, name: "Volleyball", ename: "Volleyball", tab: true, oid: 9 },
  { eid: 69, id: 69, name: "Kabaddi", ename: "Kabaddi", tab: true, oid: 10 },
  { eid: 59, id: 59, name: "Snooker", ename: "Snooker", tab: false, oid: 11 },
  { eid: 11, id: 11, name: "E Games", ename: "E Games", tab: false, oid: 12 },
  { eid: 19, id: 19, name: "Ice Hockey", ename: "Ice Hockey", tab: false, oid: 13 },
  { eid: 9, id: 9, name: "Futsal", ename: "Futsal", tab: false, oid: 14 },
  { eid: 6, id: 6, name: "Boxing", ename: "Boxing", tab: false, oid: 15 },
  { eid: 3, id: 3, name: "Mixed Martial Arts", ename: "Mixed Martial Arts", tab: false, oid: 16 },
  { eid: 58, id: 58, name: "American Football", ename: "American Football", tab: false, oid: 17 },
  { eid: 52, id: 52, name: "Motor Sports", ename: "Motor Sports", tab: false, oid: 18 },
  { eid: 40, id: 40, name: "Politics", ename: "Politics", tab: false, oid: 19 },
  { eid: 7522, id: 7522, name: "Virtual", ename: "Virtual", tab: false, oid: 20 }
];

export async function getDirectSportsTree() {
  const res = await directPost("/api/front/tablist", { ismob: 1 });
  if (Array.isArray(res?.data) && res.data.length > 0) {
    return res.data.map(s => ({
      eid: s.eid || s.id,
      id: s.eid || s.id,
      name: s.ename || s.name,
      ename: s.ename || s.name,
      tab: Boolean(s.tab),
      oid: s.oid || 99
    })).sort((a, b) => a.oid - b.oid);
  }
  return ALL_SPORTS_TREE;
}

// 3. Complete 81 Casino Table List (Direct from mouseexch / br365bet)
export const ALL_81_CASINO_TABLES = [
  { gtype: "goal2", gmid: "791", name: "Goal 2", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/goal2.jpg" },
  { gtype: "worli3", gmid: "792", name: "Matka", category: "Matka", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/worli3.gif" },
  { gtype: "dolidana", gmid: "794", name: "Dolidana", category: "Dice", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/dolidana.gif" },
  { gtype: "mogambo", gmid: "795", name: "Mogambo", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/mogambo.gif" },
  { gtype: "lucky5", gmid: "797", name: "Lucky 6", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/lucky5.jpg" },
  { gtype: "roulette12", gmid: "798", name: "Beach Roulette", category: "Roulette", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/roulette12.gif" },
  { gtype: "roulette13", gmid: "799", name: "Roulette", category: "Roulette", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/roulette13.gif" },
  { gtype: "roulette11", gmid: "800", name: "VIP Roulette", category: "Roulette", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/roulette11.gif" },
  { gtype: "poison", gmid: "801", name: "Teenpatti Poison One Day", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/poison.gif" },
  { gtype: "teenunique", gmid: "802", name: "Unique Teenpatti", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teenunique.gif" },
  { gtype: "poison20", gmid: "803", name: "Teenpatti Poison 20-20", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/poison20.gif" },
  { gtype: "joker120", gmid: "804", name: "Unlimited Joker 20-20", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/joker120.gif" },
  { gtype: "joker20", gmid: "805", name: "Teenpatti Joker 20-20", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/joker20.gif" },
  { gtype: "joker1", gmid: "806", name: "Unlimited Joker Oneday", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/joker1.gif" },
  { gtype: "teen20c", gmid: "807", name: "20-20 Teenpatti C", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen20c.gif" },
  { gtype: "btable2", gmid: "808", name: "Bollywood Casino 2", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/btable2.jpg" },
  { gtype: "ourroullete", gmid: "810", name: "Unique Roulette", category: "Roulette", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/ourroullete.gif" },
  { gtype: "superover3", gmid: "812", name: "Mini Superover", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/superover3.gif" },
  { gtype: "goal", gmid: "814", name: "Goal", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/goal.jpg" },
  { gtype: "ab4", gmid: "815", name: "ANDAR BAHAR 150 cards", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/ab4.jpg" },
  { gtype: "lucky15", gmid: "816", name: "Lucky 15", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/lucky15.gif" },
  { gtype: "superover2", gmid: "817", name: "Super Over2", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/superover2.gif" },
  { gtype: "teen41", gmid: "818", name: "Queen Top Open Teenpatti", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen41.gif" },
  { gtype: "teen42", gmid: "819", name: "Jack Top Open Teenpatti", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen42.gif" },
  { gtype: "sicbo2", gmid: "820", name: "Sic Bo2", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/sicbo2.jpg" },
  { gtype: "teen33", gmid: "821", name: "Instant Teenpatti 3.0", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen33.gif" },
  { gtype: "sicbo", gmid: "822", name: "Sic Bo", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/sicbo.jpg" },
  { gtype: "ballbyball", gmid: "823", name: "Ball by Ball", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/ballbyball.gif" },
  { gtype: "teen32", gmid: "824", name: "Instant Teenpatti 2.0", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen32.gif" },
  { gtype: "teen", gmid: "825", name: "Teenpatti 1-day", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen.gif" },
  { gtype: "teen20", gmid: "826", name: "20-20 Teenpatti", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen20.gif" },
  { gtype: "teen9", gmid: "827", name: "Teenpatti Test", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen9.gif" },
  { gtype: "teen8", gmid: "828", name: "Teenpatti Open", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen8.gif" },
  { gtype: "poker", gmid: "829", name: "Poker 1-Day", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/poker.gif" },
  { gtype: "poker20", gmid: "830", name: "20-20 Poker", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/poker20.gif" },
  { gtype: "poker6", gmid: "831", name: "Poker 6 Players", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/poker6.gif" },
  { gtype: "baccarat", gmid: "832", name: "Baccarat", category: "Baccarat", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/baccarat.gif" },
  { gtype: "baccarat2", gmid: "833", name: "Baccarat 2", category: "Baccarat", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/baccarat2.gif" },
  { gtype: "dt20", gmid: "834", name: "20-20 Dragon Tiger", category: "Dragon Tiger", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/dt20.gif" },
  { gtype: "dt6", gmid: "835", name: "1 Day Dragon Tiger", category: "Dragon Tiger", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/dt6.gif" },
  { gtype: "dtl20", gmid: "836", name: "20-20 D T L", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/dtl20.gif" },
  { gtype: "dt202", gmid: "837", name: "20-20 Dragon Tiger 2", category: "Dragon Tiger", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/dt202.gif" },
  { gtype: "card32", gmid: "838", name: "32 Cards A", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/card32.gif" },
  { gtype: "card32eu", gmid: "839", name: "32 Cards B", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/card32eu.gif" },
  { gtype: "ab20", gmid: "840", name: "Andar Bahar", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/ab20.gif" },
  { gtype: "abj", gmid: "841", name: "Andar Bahar 2", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/abj.gif" },
  { gtype: "lucky7", gmid: "842", name: "Lucky 7 - A", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/lucky7.gif" },
  { gtype: "lucky7eu", gmid: "843", name: "Lucky 7 - B", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/lucky7eu.gif" },
  { gtype: "3cardj", gmid: "844", name: "3 Cards Judgement", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/3cardj.gif" },
  { gtype: "worli", gmid: "845", name: "Worli Matka", category: "Matka", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/worli.gif" },
  { gtype: "worli2", gmid: "846", name: "Instant Worli", category: "Matka", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/worli2.gif" },
  { gtype: "aaa", gmid: "847", name: "Amar Akbar Anthony", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/aaa.gif" },
  { gtype: "btable", gmid: "848", name: "Bollywood Casino", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/btable.jpg" },
  { gtype: "lottcard", gmid: "849", name: "Lottery", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/lottcard.gif" },
  { gtype: "cricketv3", gmid: "850", name: "5Five Cricket", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/cricketv3.gif" },
  { gtype: "cmatch20", gmid: "851", name: "Cricket Match 20-20", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/cmatch20.gif" },
  { gtype: "teen6", gmid: "852", name: "Teenpatti - 2.0", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen6.gif" },
  { gtype: "queen", gmid: "853", name: "Queen", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/queen.gif" },
  { gtype: "race20", gmid: "854", name: "Race20", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/race20.gif" },
  { gtype: "lucky7eu2", gmid: "855", name: "Lucky 7 - C", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/lucky7eu2.gif" },
  { gtype: "superover", gmid: "856", name: "Super Over", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/superover.gif" },
  { gtype: "trap", gmid: "857", name: "The Trap", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/trap.gif" },
  { gtype: "patti2", gmid: "858", name: "2 Cards Teenpatti", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/patti2.gif" },
  { gtype: "teensin", gmid: "859", name: "29Card Baccarat", category: "Baccarat", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teensin.gif" },
  { gtype: "teenmuf", gmid: "860", name: "Muflis Teenpatti", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teenmuf.gif" },
  { gtype: "race17", gmid: "861", name: "Race To 17", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/race17.gif" },
  { gtype: "teen20b", gmid: "862", name: "20-20 Teenpatti B", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen20b.gif" },
  { gtype: "trio", gmid: "863", name: "Trio", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/trio.gif" },
  { gtype: "notenum", gmid: "864", name: "Note Number", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/notenum.gif" },
  { gtype: "teen120", gmid: "865", name: "1 CARD 20-20", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen120.gif" },
  { gtype: "teen1", gmid: "866", name: "1 CARD ONE-DAY", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen1.gif" },
  { gtype: "ab3", gmid: "867", name: "ANDAR BAHAR 50 cards", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/ab3.gif" },
  { gtype: "aaa2", gmid: "868", name: "Amar Akbar Anthony 2", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/aaa2.gif" },
  { gtype: "race2", gmid: "869", name: "Race to 2nd", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/race2.gif" },
  { gtype: "teen3", gmid: "870", name: "Instant Teenpatti", category: "Teen Patti", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/teen3.gif" },
  { gtype: "dum10", gmid: "871", name: "Dus ka Dum", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/dum10.gif" },
  { gtype: "cmeter1", gmid: "872", name: "1 Card Meter", category: "Special", minBet: 100, maxBet: 50000, imgpath: "https://cdn.926assets.com/g1-casino-icons/lc/cmeter1.gif" }
];

export async function getDirectCasinoTables() {
  const res = await directPost("/api/front/get_casino_table_list", { ismob: 1 });
  const rawList = res?.data?.t1 || res?.data;
  if (Array.isArray(rawList) && rawList.length > 0) {
    return rawList.map(t => ({
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
  }
  return ALL_81_CASINO_TABLES;
}

// 4. Live Casino Table Data (Instant Direct Feed with Socket.io Hybrid Streaming)
export async function getDirectCasinoTableLive(gtype) {
  const norm = normalizeTableSlug(gtype);
  
  // 1. Try Direct REST to upstream exchange
  const dec = await directPost(`/api/front/casino/data2?gtype=${norm}`, { ismob: 1, type: norm });
  if (dec && dec.data) {
    const d = dec.data;
    const runners = Array.isArray(d.sub) ? d.sub : [];
    const rawCardStr = d.card || "";
    const parsedCardList = rawCardStr ? rawCardStr.split(/[,|]/).map(s => s.trim()).filter(Boolean) : [];
    return {
      roundId: String(d.mid || Date.now()),
      leftSec: Number(d.lt ?? (d.leftSec ?? 0)),
      roundStatus: (d.status === "SUSPENDED" || (Number(d.lt) <= 0 && d.gstatus === "SUSPENDED")) ? "SUSPENDED" : "OPEN",
      gtype: d.gtype || norm,
      card: rawCardStr,
      cards: parsedCardList,
      remark: d.remark || d.rdesc || "",
      score: d.card || "0 0",
      sub: runners.map((r, rIdx) => ({
        sid: r.sid || r.i || (rIdx + 1),
        nat: r.nat || r.n || r.name || `Runner ${r.sid || rIdx + 1}`,
        b: Number(r.b || 0),
        bs: Number(r.bs || 0),
        l: Number(r.l || 0),
        ls: Number(r.ls || 0),
        gstatus: (r.gstatus === "SUSPENDED" || r.status === "SUSPENDED") ? "SUSPENDED" : "ACTIVE",
        min: r.min || 100,
        max: r.max || 100000,
        subtype: r.subtype || "main"
      }))
    };
  }

  // 2. Direct Socket Cache Fallback (Zero Browser Socket Stream)
  const socketMapped = mapSlugToSocketGame(norm);
  if (socketMapped && casinoOddsCache.has(socketMapped)) {
    const sockData = casinoOddsCache.get(socketMapped);
    if (sockData) {
      return {
        roundId: String(sockData.roundId || Date.now()),
        leftSec: Number(sockData.leftSec ?? 10),
        roundStatus: sockData.roundStatus || "OPEN",
        gtype: norm,
        card: sockData.card || "",
        cards: Array.isArray(sockData.cards) ? sockData.cards : [],
        remark: "",
        score: sockData.card || "0 0",
        sub: (sockData.runners || []).map((r, i) => ({
          sid: r.selectionId || (i + 1),
          nat: r.name || `Runner ${i + 1}`,
          b: Number(r.back?.price || 0),
          bs: Number(r.back?.rawSize || 0),
          l: Number(r.lay?.price || 0),
          ls: Number(r.lay?.rawSize || 0),
          gstatus: r.isSuspended ? "SUSPENDED" : "ACTIVE",
          min: 100,
          max: 100000,
          subtype: "main"
        }))
      };
    }
  }

  return null;
}

// 5. Live Round Results History
export async function getDirectCasinoLastResults(gtype) {
  const norm = normalizeTableSlug(gtype);
  const dec = await directPost(`/api/front/casino/lastresults2?gtype=${norm}`, {
    ismob: 1,
    gType: norm,
    type: norm
  });
  if (Array.isArray(dec?.data?.res)) return dec.data.res;
  if (Array.isArray(dec?.data)) return dec.data;

  // Socket results fallback
  const socketMapped = mapSlugToSocketGame(norm);
  if (socketMapped && casinoResultsHistoryCache.has(socketMapped)) {
    return casinoResultsHistoryCache.get(socketMapped) || [];
  }
  return [];
}

// 6. Live Sports Matches & Highlights (Cricket, Football, Tennis)
export async function getDirectSportsHighlights(etid = 4) {
  const eid = Number(etid || 4);
  const dec = await directPost(`/api/front/highlighthomePrivate?etid=${eid}`, {
    etid: eid,
    type: "all"
  });

  const t1 = Array.isArray(dec?.data?.t1) ? dec.data.t1 : (Array.isArray(dec?.data) ? dec.data : []);
  const t2 = Array.isArray(dec?.data?.t2) ? dec.data.t2 : [];
  const allRaw = [...t1, ...t2];

  if (allRaw.length > 0) {
    return allRaw.map(m => ({
      gmid: String(m.gmid || m.mid || Date.now()),
      ename: m.ename || m.name || "Live Match",
      etid: Number(m.etid || m.eid || eid),
      cid: m.cid || 0,
      iplay: Boolean(m.iplay || m.inplay || m.inPlay),
      stime: m.stime || m.eventTime || "",
      tv: Boolean(m.tv || m.isStreaming),
      bm: Boolean(m.bm || m.isBookmakers),
      f: Boolean(m.f || m.isFancy),
      c1: {
        b: Number(m.b1 || m.c1?.b || 0),
        l: Number(m.l1 || m.c1?.l || 0)
      },
      c2: {
        b: Number(m.b2 || m.c2?.b || 0),
        l: Number(m.l2 || m.c2?.l || 0)
      },
      matchOdds: [
        { nat: m.ename?.split(" v ")?.[0] || "Team 1", b1: Number(m.b1 || 0), l1: Number(m.l1 || 0), bs1: "100K" },
        { nat: "The Draw", b1: null, l1: null },
        { nat: m.ename?.split(" v ")?.[1] || "Team 2", b1: Number(m.b2 || 0), l1: Number(m.l2 || 0), bs1: "100K" }
      ]
    }));
  }
  return [];
}

// 7. Live Match Details & Real Scoreboard (Direct Firestore Hook)
export async function getDirectLiveScore(gmid, etid = 4) {
  return await getLiveScoreData(gmid, String(etid));
}

// Helper: Normalize table slugs
export function normalizeTableSlug(gtype) {
  if (!gtype) return gtype;
  const g = String(gtype).toLowerCase().trim();
  if (g === "roulette" || g === "roulette13") return "roulette13";
  if (g === "beachroulette" || g === "roulette12") return "roulette12";
  if (g === "viproulette" || g === "roulette11") return "roulette11";
  if (g === "teenpoison_1day" || g === "poison" || g === "poison1day") return "poison";
  if (g === "teen_unique" || g === "teenunique" || g === "unique") return "teenunique";
  if (g === "teenpoison" || g === "poison20" || g === "poison_20") return "poison20";
  if (g === "teen1day" || g === "teen20") return "teen20";
  if (g === "teen9" || g === "teenopen") return "teen9";
  if (g === "teen") return "teen";
  if (g === "poker6player" || g === "poker6") return "poker6";
  if (g === "poker20") return "poker20";
  if (g === "poker1day" || g === "poker") return "poker";
  if (g === "dragon_tiger" || g === "dt20" || g === "dt") return "dt20";
  if (g === "dt1day" || g === "dt6") return "dt6";
  if (g === "dtl" || g === "dtl20") return "dtl20";
  if (g === "andar_bahar" || g === "ab20" || g === "ab") return "ab20";
  if (g === "32cards" || g === "card32") return "card32";
  if (g === "32cardsb" || g === "card32eu") return "card32eu";
  if (g === "lucky7" || g === "lucky7a") return "lucky7";
  if (g === "lucky7eu" || g === "lucky7b") return "lucky7eu";
  if (g === "lucky6" || g === "lucky5") return "lucky5";
  if (g === "baccarat") return "baccarat";
  if (g === "baccarat2") return "baccarat2";
  if (g === "matka" || g === "worli3") return "worli3";
  if (g.includes("superover")) return "superover2";
  return g;
}

// Helper: Map casino slug to Socket.io event ID
function mapSlugToSocketGame(slug) {
  if (slug === "teen20" || slug === "teen") return "99.0010";
  if (slug === "dt20" || slug === "dt6") return "99.0018";
  if (slug === "dtl20") return "99.0041";
  if (slug === "lucky7" || slug === "lucky7eu") return "99.0030";
  if (slug === "card32" || slug === "card32eu") return "99.0022";
  if (slug === "ab20" || slug === "abj") return "99.0025";
  if (slug === "baccarat" || slug === "baccarat2") return "99.0001";
  return null;
}

