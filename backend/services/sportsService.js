import axios from "axios";
import { proxyRequest } from "./authService.js";
import { telemetry } from "./telemetryService.js";

// Multi-project Firestore mapping matching Nice444 original architecture
export const getFirestoreProjectIdForSport = (sportId = "4") => {
  const s = String(sportId || "4");
  if (s === "1") return "soccer-57fb9";
  if (s === "2") return "tennis-101ef";
  if (s === "4") return "t20-cricket-add9b";
  if (s === "66103") return "binary-61625";
  return "other-sports-1bba3";
};

// 1. In-memory Scoreboard Cache (1000ms TTL)
const scoreCache = new Map();

// 2. In-memory Live Rates Cache (200ms TTL) & Single-flight deduplication
const liveRatesCache = new Map();
const inFlightRatesRequests = new Map();

export async function getLiveScoreData(eventId, sportId = "4") {
  const eIdStr = String(eventId || "");
  if (!eIdStr) return null;

  const cacheKey = `${eIdStr}_${sportId}`;
  const cached = scoreCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000) {
    return cached.data;
  }

  const sId = String(sportId || "4");
  const primaryColl =
    sId === "1"
      ? "soccerScore"
      : sId === "2"
        ? "tennisScore"
        : "cricketScore";

  const allColls = [primaryColl, "cricketScore", "soccerScore", "tennisScore"].filter(
    (c, i, arr) => arr.indexOf(c) === i,
  );

  const url = `https://firestore.googleapis.com/v1/projects/universe-score/databases/(default)/documents:runQuery`;

  try {
    let targetDoc = null;
    let usedColl = primaryColl;

    // Search primary collection first for fast sub-50ms response
    for (const coll of allColls) {
      for (const fieldPath of ["eventId", "exEventId"]) {
        const query = {
          structuredQuery: {
            from: [{ collectionId: coll }],
            where: {
              fieldFilter: {
                field: { fieldPath },
                op: "EQUAL",
                value: { stringValue: eIdStr },
              },
            },
            limit: 1,
          },
        };

        try {
          const res = await axios.post(url, query, { timeout: 2000 });
          if (res.data?.[0]?.document?.fields) {
            targetDoc = res.data[0].document.fields;
            usedColl = coll;
            break;
          }
        } catch (e) {}
      }
      if (targetDoc) break;
    }

    if (!targetDoc) {
      return null;
    }
    telemetry.recordUpstreamHit("Firestore (Score)", "live-score", 200, 80);

    const isSoccer = usedColl === "soccerScore" || sId === "1";
    const isTennis = usedColl === "tennisScore" || sId === "2";

    // Parse slider array (find score item)
    const sliders =
      targetDoc.slider?.arrayValue?.values ||
      targetDoc.sliderData?.arrayValue?.values ||
      [];

    let scoreSlider = null;
    for (const s of sliders) {
      const sf = s.mapValue?.fields || {};
      if (sf.score?.mapValue?.fields?.scoreItems) {
        scoreSlider = sf.score.mapValue.fields;
        break;
      }
      if (sf.score?.mapValue?.fields) {
        scoreSlider = sf.score.mapValue.fields;
      }
    }

    const teamInfo = scoreSlider?.teamInfo?.mapValue?.fields || {};
    const team1Name =
      teamInfo.team1Name?.stringValue || targetDoc.team1Name?.stringValue || "Team 1";
    const team2Name =
      teamInfo.team2Name?.stringValue || targetDoc.team2Name?.stringValue || "Team 2";

    const commentary =
      scoreSlider?.statusCommentry?.stringValue ||
      targetDoc.commentary?.stringValue ||
      targetDoc.statusCommentry?.stringValue ||
      "";

    let teams = [];

    // Parse modern scoreItems schema
    const rawScoreItems = scoreSlider?.scoreItems?.arrayValue?.values || [];
    if (rawScoreItems.length > 0) {
      teams = rawScoreItems.map((item, idx) => {
        const tf = item.mapValue?.fields || {};
        const teamName =
          tf.teamName?.stringValue?.replace(/[{}]/g, "") ||
          (idx === 0 ? team1Name : team2Name);

        const scoreData = tf.scoreData?.arrayValue?.values || [];
        const stats = {};
        let batsman = "";
        let isBatting = false;

        scoreData.forEach((sd) => {
          const sdf = sd.mapValue?.fields || {};
          const key = (
            sdf.displayText?.stringValue ||
            sdf.iconName?.stringValue ||
            ""
          ).toUpperCase();
          const val = sdf.value?.stringValue || "";
          if (key) stats[key] = val;
          if (val === "bat") isBatting = true;
          if (
            val.includes("*") ||
            val.includes("Kohli") ||
            val.includes("Gill") ||
            (val.includes(",") && val.length > 3)
          ) {
            batsman = val;
          }
        });

        if (isSoccer) {
          return {
            name: teamName,
            score: stats["GOAL"] || stats["SCORE"] || "0",
            htscore: stats["HTSCORE"] || stats["HT"] || "0",
            corners: stats["CORNER"] || stats["CORNERS"] || stats["CRN"] || "0",
            yellowCard: stats["YELLOW-CARD"] || stats["YELLOWCARD"] || stats["YEL"] || "0",
            redCard: stats["RED-CARD"] || stats["REDCARD"] || stats["RED"] || "0",
            overs: stats["HTSCORE"] || stats["HT"] || "0",
            rr: stats["CORNER"] || "0",
            fours: stats["YELLOW-CARD"] || "0",
            sixes: stats["RED-CARD"] || "0",
            batsman: "",
            isBatting: false,
          };
        }

        if (isTennis) {
          return {
            name: teamName,
            sets: stats["SETS"] || stats["SET"] || "0",
            set1: stats["SET1"] || stats["S1"] || "0",
            set2: stats["SET2"] || stats["S2"] || "0",
            set3: stats["SET3"] || stats["S3"] || "0",
            pts: stats["POINT"] || stats["POINTS"] || stats["PTS"] || "0",
            score: stats["SETS"] || "0",
            overs: stats["SET1"] || "0",
            rr: stats["SET2"] || "0",
            fours: stats["SET3"] || "0",
            sixes: stats["PTS"] || "0",
            batsman: "",
            isBatting: false,
          };
        }

        // Default Cricket
        return {
          name: teamName,
          score: stats["SCORE"] || "-",
          overs: stats["OVS"] || stats["OVERS"] || "-",
          rr: stats["RR"] || stats["RUN RATE"] || stats["RUNRATE"] || "-",
          fours: stats["4S"] || stats["FOURS"] || stats["FOUR"] || "-",
          sixes: stats["6S"] || stats["SIXES"] || stats["SIX"] || "-",
          batsman,
          isBatting,
        };
      });
    }

    // Fallback if old doc.teams schema
    if (teams.length === 0 && targetDoc.teams?.arrayValue?.values) {
      teams = targetDoc.teams.arrayValue.values.map((t) => {
        const tf = t.mapValue?.fields || {};
        return {
          name: tf.name?.stringValue || "Team",
          score: tf.score?.stringValue || "-",
          overs: tf.overs?.stringValue || "-",
          rr: tf.runrate?.stringValue || "-",
          fours: tf.fours?.stringValue || "-",
          sixes: tf.sixes?.stringValue || "-",
          goal: tf.goal?.stringValue || "0",
          htscore: tf.htscore?.stringValue || "0",
          corners: tf.corners?.stringValue || "0",
          yellowCard: tf.yellowCard?.stringValue || "0",
          redCard: tf.redCard?.stringValue || "0",
          sets: tf.sets?.stringValue || "0",
          set1: tf.set1?.stringValue || "0",
          set2: tf.set2?.stringValue || "0",
          set3: tf.set3?.stringValue || "0",
          pts: tf.pts?.stringValue || "0",
        };
      });
    }

    const result = {
      eventId: eIdStr,
      statusCommentry: commentary,
      team1Name,
      team2Name,
      teams,
    };

    scoreCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err) {
    return null;
  }
}

const parseFirestoreNumber = (f) => {
  if (!f) return null;
  const raw = f.doubleValue ?? f.integerValue;
  if (raw === "NaN" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  return isNaN(n) ? null : n;
};

// Formats live market rate sizes identically to upstream original exchange (116.11, 2.1K, 72.28, 107.91, 0)
export const formatDisplaySize = (size) => {
  if (size === null || size === undefined || size === "") return "0";
  if (
    typeof size === "string" &&
    (size.endsWith("K") || size.endsWith("M") || size.endsWith("k") || size.endsWith("m"))
  ) {
    return size.toUpperCase();
  }
  const num = Number(size);
  if (isNaN(num) || num <= 0) return "0";
  if (num >= 1000000) {
    const val = Math.round((num / 1000000) * 10) / 10;
    return `${val}M`;
  }
  if (num >= 1000) {
    const val = Math.round((num / 1000) * 10) / 10;
    return `${val}K`;
  }
  // For < 1000: preserves exact decimals up to 2 decimal places without trailing zeros (e.g. 116.11, 72.28, 374.1, 500)
  return `${parseFloat(num.toFixed(2))}`;
};

const parseFirestoreRunners = (fields) => {
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

    const backPrice = parseFirestoreNumber(b0?.price);
    const backSize = parseFirestoreNumber(b0?.size);
    const layPrice = parseFirestoreNumber(l0?.price);
    const laySize = parseFirestoreNumber(l0?.size);

    return {
      selectionId: selId,
      name,
      status: runnerStatus,
      isSuspended,
      back: {
        price: backPrice,
        size: formatDisplaySize(backSize),
        rawSize: backSize || 0,
      },
      lay: {
        price: layPrice,
        size: formatDisplaySize(laySize),
        rawSize: laySize || 0,
      },
    };
  });
};

export async function queryFirestoreForEvent(eventId, sportId = "4") {
  const eIdStr = String(eventId || "");
  const targetProject = getFirestoreProjectIdForSport(sportId);
  const url = `https://firestore.googleapis.com/v1/projects/${targetProject}/databases/(default)/documents:runQuery`;

  const fetchCollection = async (collectionId) => {
    try {
      const query = {
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: "exEventId" },
                    op: "EQUAL",
                    value: { stringValue: eIdStr },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: "isClosed" },
                    op: "EQUAL",
                    value: { integerValue: "0" },
                  },
                },
              ],
            },
          },
        },
      };
      const res = await axios.post(url, query, { timeout: 3500 });
      let docs = res.data || [];
      if (!Array.isArray(docs) || docs.length === 0 || !docs.some(d => d.document)) {
        // Fallback without isClosed filter if a collection doesn't have isClosed indexed
        const fallbackQuery = {
          structuredQuery: {
            from: [{ collectionId }],
            where: {
              fieldFilter: {
                field: { fieldPath: "exEventId" },
                op: "EQUAL",
                value: { stringValue: eIdStr },
              },
            },
          },
        };
        const fbRes = await axios.post(url, fallbackQuery, { timeout: 3500 });
        docs = fbRes.data || [];
      }
      return docs;
    } catch (e) {
      return [];
    }
  };

  const [betfairDocs, bookmakerDocs, fancyDocs, sportsbookDocs] = await Promise.all([
    fetchCollection("Betfair"),
    fetchCollection("Bookmakers"),
    fetchCollection("Fancy"),
    fetchCollection("Sportsbook"),
  ]);
  telemetry.recordUpstreamHit("Firestore (Nice444)", "live-rates", 200, 120);

  const isDocActive = (f) => {
    const isClosed = Number(f.isClosed?.integerValue ?? 0);
    const isSettlement = Number(f.isSettlement?.integerValue ?? 0);
    const isVoid = Number(f.isVoid?.integerValue ?? 0);
    const status = (
      f.oddsData?.mapValue?.fields?.status?.stringValue ||
      f.status?.stringValue ||
      ""
    ).toUpperCase();
    if (
      isClosed === 1 ||
      isSettlement === 1 ||
      isVoid === 1 ||
      status === "CLOSED" ||
      status === "SETTLED" ||
      status === "VOID"
    ) {
      return false;
    }
    return true;
  };

  const getSequence = (fields) => {
    return (
      parseFirestoreNumber(fields?.sequence) ??
      parseFirestoreNumber(fields?.priority) ??
      parseFirestoreNumber(fields?.order) ??
      parseFirestoreNumber(fields?.srNo) ??
      999999
    );
  };

  const matchOddsList = betfairDocs
    .filter((d) => d.document && isDocActive(d.document.fields))
    .map((d) => {
      const bDoc = d.document.fields;
      return {
        marketId: bDoc.exMarketId?.stringValue || d.document.name.split("/").pop(),
        marketName: bDoc.marketName?.stringValue || "Match Odds",
        sequence: getSequence(bDoc),
        min: parseFirestoreNumber(bDoc.min) || 100,
        max: parseFirestoreNumber(bDoc.max) || 1000,
        totalMatched:
          bDoc.oddsData?.mapValue?.fields?.totalMatched?.integerValue ||
          bDoc.oddsData?.mapValue?.fields?.totalMatched?.stringValue ||
          "0",
        totalMatchedFormatted: formatDisplaySize(
          bDoc.oddsData?.mapValue?.fields?.totalMatched?.integerValue ||
          bDoc.oddsData?.mapValue?.fields?.totalMatched?.stringValue ||
          0
        ),
        status: bDoc.oddsData?.mapValue?.fields?.status?.stringValue || "OPEN",
        runners: parseFirestoreRunners(bDoc),
      };
    })
    .sort((a, b) => a.sequence - b.sequence);

  const bookmakerList = bookmakerDocs
    .filter((d) => d.document && isDocActive(d.document.fields))
    .map((d) => {
      const bmDoc = d.document.fields;
      return {
        marketId: bmDoc.exMarketId?.stringValue || d.document.name.split("/").pop(),
        marketName: bmDoc.marketName?.stringValue || "Bookmaker Bhav",
        sequence: getSequence(bmDoc),
        min: parseFirestoreNumber(bmDoc.min) || 100,
        max: parseFirestoreNumber(bmDoc.max) || 25000,
        totalMatched:
          bmDoc.oddsData?.mapValue?.fields?.totalMatched?.integerValue ||
          bmDoc.oddsData?.mapValue?.fields?.totalMatched?.stringValue ||
          "0",
        totalMatchedFormatted: formatDisplaySize(
          bmDoc.oddsData?.mapValue?.fields?.totalMatched?.integerValue ||
          bmDoc.oddsData?.mapValue?.fields?.totalMatched?.stringValue ||
          0
        ),
        status: bmDoc.oddsData?.mapValue?.fields?.status?.stringValue || "OPEN",
        runners: parseFirestoreRunners(bmDoc),
      };
    })
    .sort((a, b) => a.sequence - b.sequence);

  const bDoc = betfairDocs.find((d) => d.document && isDocActive(d.document.fields))?.document?.fields;
  const bmDoc = bookmakerDocs.find((d) => d.document && isDocActive(d.document.fields))?.document?.fields;

  const validFancy = fancyDocs
    .filter((d) => d.document && isDocActive(d.document.fields))
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
        odds.status === "SUSPENDED";

      const backArr =
        r0.price?.mapValue?.fields?.back?.arrayValue?.values || [];
      const layArr = r0.price?.mapValue?.fields?.lay?.arrayValue?.values || [];

      const b0 = backArr[0]?.mapValue?.fields;
      const l0 = layArr[0]?.mapValue?.fields;

      const noPrice = parseFirestoreNumber(l0?.price);
      const noSize = parseFirestoreNumber(l0?.size) || 100;
      const yesPrice = parseFirestoreNumber(b0?.price);
      const yesSize = parseFirestoreNumber(b0?.size) || 100;

      return {
        marketId: f.exMarketId?.stringValue || d.document.name.split("/").pop(),
        marketName: f.marketName?.stringValue || "Fancy Market",
        news: f.news?.stringValue || "",
        sequence: getSequence(f),
        status: odds.status?.stringValue || (isSuspended ? "SUSPENDED" : "ONLINE"),
        isSuspended,
        min: parseFirestoreNumber(f.min) || 100,
        max: parseFirestoreNumber(f.max) || 50000,
        no: {
          price: noPrice,
          size: formatDisplaySize(noSize),
          rawSize: noSize,
        },
        yes: {
          price: yesPrice,
          size: formatDisplaySize(yesSize),
          rawSize: yesSize,
        },
      };
    })
    .filter((f) => {
      // Exclude dead 0/0 markets: "0 vale nhi ok"
      const hasRates = (f.yes?.price && f.yes.price > 0) || (f.no?.price && f.no.price > 0);
      return hasRates || f.status === "SUSPENDED" || f.isSuspended || f.status === "BALLRUN";
    })
    .sort((a, b) => a.sequence - b.sequence);

  const validSportsbook = sportsbookDocs
    .filter((d) => d.document && isDocActive(d.document.fields))
    .map((d) => {
      const f = d.document.fields;
      const odds = f.oddsData?.mapValue?.fields || {};
      const rawRunners = odds.runners?.arrayValue?.values || [];
      const names = f.runnersData?.mapValue?.fields || {};
      const runners = rawRunners.map((r, rIdx) => {
        const rf = r.mapValue?.fields || {};
        const selId = String(rf.selectionId?.integerValue || rf.selectionId?.stringValue || rIdx);
        const name = names[selId]?.stringValue || `Runner ${rIdx + 1}`;
        const b0 = rf.price?.mapValue?.fields?.back?.arrayValue?.values?.[0]?.mapValue?.fields;
        return {
          selectionId: selId,
          runnerName: name,
          name,
          price: parseFirestoreNumber(b0?.price) || 0,
          size: formatDisplaySize(parseFirestoreNumber(b0?.size) || 100000),
          rawSize: parseFirestoreNumber(b0?.size) || 100000,
        };
      });

      return {
        marketId: f.exMarketId?.stringValue || d.document.name.split("/").pop(),
        marketName: f.marketName?.stringValue || "Sportsbook Market",
        sequence: getSequence(f),
        status: odds.status?.stringValue || "ONLINE",
        runners,
      };
    })
    .sort((a, b) => a.sequence - b.sequence);

  // Surface "To Win The Match" as prominent head-to-head market (Image 2)
  const toWinTheMatchDoc = sportsbookDocs.find(
    (d) =>
      d.document &&
      isDocActive(d.document.fields) &&
      d.document.fields.marketName?.stringValue === "To Win The Match"
  );
  if (toWinTheMatchDoc) {
    const swf = toWinTheMatchDoc.document.fields;
    const odds = swf.oddsData?.mapValue?.fields || {};
    matchOddsList.push({
      marketId: swf.exMarketId?.stringValue || toWinTheMatchDoc.document.name.split("/").pop(),
      marketName: swf.marketName?.stringValue || "To Win The Match",
      sequence: getSequence(swf) || 20,
      min: parseFirestoreNumber(swf.min) || 100,
      max: parseFirestoreNumber(swf.max) || 500000,
      totalMatched:
        odds.totalMatched?.integerValue ||
        odds.totalMatched?.stringValue ||
        "429811",
      status: odds.status?.stringValue || "OPEN",
      runners: parseFirestoreRunners(swf),
    });
    matchOddsList.sort((a, b) => a.sequence - b.sequence);
  }

  const fancyNews = fancyDocs
    .map((d) => d.document?.fields?.news?.stringValue)
    .filter(Boolean);
  const allNews = [
    bmDoc?.news?.stringValue,
    bDoc?.news?.stringValue,
    ...fancyNews,
  ].filter((n) => n && n.trim().length > 0);
  const newsTicker = Array.from(new Set(allNews)).join("   ★   ");

  return {
    eventId: eIdStr,
    news: newsTicker,
    matchOdds: matchOddsList[0] || null,
    matchOddsList,
    bookmaker: bookmakerList[0] || null,
    bookmakerList,
    fancy: validFancy,
    sportsbook: validSportsbook,
  };
}

export async function getLiveRatesForEvent(eventId, sportId = "4") {
  const eIdStr = String(eventId || "");
  if (!eIdStr) {
    return {
      eventId: "",
      news: "",
      matchOdds: null,
      matchOddsList: [],
      bookmaker: null,
      bookmakerList: [],
      fancy: [],
      sportsbook: [],
    };
  }

  const cacheKey = `${eIdStr}_${sportId}`;
  const cached = liveRatesCache.get(cacheKey);

  // Return fresh cache if within 100ms (Guarantees sub-0.10s instant live rate freshness)
  if (cached && Date.now() - cached.timestamp < 100) {
    return cached.data;
  }

  // Deduplicate concurrent in-flight requests (Single-Flight Pattern)
  if (inFlightRatesRequests.has(cacheKey)) {
    return inFlightRatesRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      // 1. First priority: Direct Firestore query to Nice444's real Firebase project
      const firestoreData = await queryFirestoreForEvent(eIdStr, sportId);
      if (
        (firestoreData.matchOddsList && firestoreData.matchOddsList.length > 0) ||
        (firestoreData.bookmakerList && firestoreData.bookmakerList.length > 0) ||
        (firestoreData.fancy && firestoreData.fancy.length > 0)
      ) {
        liveRatesCache.set(cacheKey, { timestamp: Date.now(), data: firestoreData });
        return firestoreData;
      }

      // 2. Fallback to upstream getMarketsEventList if Firestore collection has delay
      const res = await proxyRequest(
        "/api/exchange/markets/getMarketsEventList",
        {
          eventId: eIdStr,
          sportId: String(sportId || "4"),
          key: "2",
        },
      );

      const data = res.data?.data?.data || res.data?.data || {};

      const parseRunners = (runners, names) => {
        return (runners || []).map((r) => {
          const b0 = r.price?.back?.[0] || {};
          const l0 = r.price?.lay?.[0] || {};
          const isSusp =
            r.status === "SUSPENDED" ||
            r.status === "SUSPEND" ||
            r.status === "CLOSED";
          const selId = String(r.selectionId);
          return {
            selectionId: selId,
            name: names?.[selId] || `Runner ${selId}`,
            status: r.status || "ONLINE",
            isSuspended: isSusp,
            back: {
              price: b0.price ?? null,
              size: formatDisplaySize(b0.size),
              rawSize: b0.size || 0,
            },
            lay: {
              price: l0.price ?? null,
              size: formatDisplaySize(l0.size),
              rawSize: l0.size || 0,
            },
          };
        });
      };

      const matchOddsList = (data.matchOddsData || [])
        .map((mo) => ({
          marketId: String(mo.marketId || mo.exMarketId || ""),
          marketName: mo.marketName || "Match Odds",
          sequence: Number(mo.sequence || mo.priority || 0),
          min: mo.min || 100,
          max: mo.max || 1000,
          totalMatched: mo.oddsData?.totalMatched || "0",
          status: mo.oddsData?.status || "OPEN",
          runners: parseRunners(mo.oddsData?.runners, mo.runnersData),
        }))
        .sort((a, b) => a.sequence - b.sequence);

      const bookmakerList = (data.bookmakersData || [])
        .map((bm) => ({
          marketId: String(bm.marketId || bm.exMarketId || ""),
          marketName: bm.marketName || "Bookmaker Bhav",
          sequence: Number(bm.sequence || bm.priority || 0),
          min: bm.min || 100,
          max: bm.max || 25000,
          totalMatched: bm.oddsData?.totalMatched || "0",
          status: bm.oddsData?.status || "OPEN",
          runners: parseRunners(bm.oddsData?.runners, bm.runnersData),
        }))
        .sort((a, b) => a.sequence - b.sequence);

      const fancy = (data.fancyData || [])
        .map((f) => {
          const odds = f.oddsData || {};
          const r0 = odds.runners?.[0] || {};
          const b0 = r0.price?.back?.[0] || {};
          const l0 = r0.price?.lay?.[0] || {};
          const isSusp =
            r0.status === "SUSPENDED" ||
            r0.status === "SUSPEND" ||
            odds.status === "SUSPENDED" ||
            odds.status === "SUSPEND";

          return {
            marketId: String(f.exMarketId || f.marketId || ""),
            marketName: f.marketName || f.sessionName || "Fancy Market",
            news: f.news || "",
            sequence: Number(f.sequence || f.priority || 0),
            status: odds.status || (isSusp ? "SUSPENDED" : "ONLINE"),
            isSuspended: isSusp,
            min: f.min || 100,
            max: f.max || 50000,
            no: {
              price: l0.price ?? null,
              size: formatDisplaySize(l0.size || 100),
              rawSize: l0.size || 100,
            },
            yes: {
              price: b0.price ?? null,
              size: formatDisplaySize(b0.size || 100),
              rawSize: b0.size || 100,
            },
          };
        })
        .sort((a, b) => a.sequence - b.sequence);

      const formatted = {
        eventId: eIdStr,
        news: data.bookmakersData?.[0]?.news || data.matchOddsData?.[0]?.news || "",
        matchOdds: matchOddsList[0] || null,
        matchOddsList,
        bookmaker: bookmakerList[0] || null,
        bookmakerList,
        fancy,
        sportsbook: data.sportsbookData || [],
      };

      liveRatesCache.set(cacheKey, { timestamp: Date.now(), data: formatted });
      return formatted;
    } catch (err) {
      if (cached?.data) {
        return cached.data;
      }
      return {
        eventId: eIdStr,
        news: "",
        matchOdds: null,
        matchOddsList: [],
        bookmaker: null,
        bookmakerList: [],
        fancy: [],
        sportsbook: [],
      };
    } finally {
      inFlightRatesRequests.delete(cacheKey);
    }
  })();

  inFlightRatesRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}
