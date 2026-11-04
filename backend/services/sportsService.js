import axios from "axios";
import { proxyRequest } from "./authService.js";

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

    // Search across relevant collections and id fields
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
          const res = await axios.post(url, query, { timeout: 3500 });
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
        scoreData.forEach((sd) => {
          const sdf = sd.mapValue?.fields || {};
          const key = (
            sdf.displayText?.stringValue ||
            sdf.iconName?.stringValue ||
            ""
          ).toUpperCase();
          const val = sdf.value?.stringValue || "";
          if (key) stats[key] = val;
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
      isSuspended:
        isSuspended ||
        (backPrice === null && layPrice === null && backSize === null && laySize === null),
      back: {
        price: isSuspended || backPrice === 0 ? null : backPrice,
        size: backSize || 0,
      },
      lay: {
        price: isSuspended || layPrice === 0 ? null : layPrice,
        size: laySize || 0,
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
            fieldFilter: {
              field: { fieldPath: "exEventId" },
              op: "EQUAL",
              value: { stringValue: eIdStr },
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

  const [betfairDocs, bookmakerDocs, fancyDocs, sportsbookDocs] = await Promise.all([
    fetchCollection("Betfair"),
    fetchCollection("Bookmakers"),
    fetchCollection("Fancy"),
    fetchCollection("Sportsbook"),
  ]);

  const matchOddsList = betfairDocs
    .filter((d) => d.document)
    .map((d) => {
      const bDoc = d.document.fields;
      return {
        marketId: bDoc.exMarketId?.stringValue || d.document.name.split("/").pop(),
        marketName: bDoc.marketName?.stringValue || "Match Odds",
        min: parseFirestoreNumber(bDoc.min) || 100,
        max: parseFirestoreNumber(bDoc.max) || 1000,
        totalMatched:
          bDoc.oddsData?.mapValue?.fields?.totalMatched?.integerValue ||
          bDoc.oddsData?.mapValue?.fields?.totalMatched?.stringValue ||
          "0",
        status: bDoc.oddsData?.mapValue?.fields?.status?.stringValue || "OPEN",
        runners: parseFirestoreRunners(bDoc),
      };
    });

  const bookmakerList = bookmakerDocs
    .filter((d) => d.document)
    .map((d) => {
      const bmDoc = d.document.fields;
      return {
        marketId: bmDoc.exMarketId?.stringValue || d.document.name.split("/").pop(),
        marketName: bmDoc.marketName?.stringValue || "Bookmaker Bhav",
        min: parseFirestoreNumber(bmDoc.min) || 100,
        max: parseFirestoreNumber(bmDoc.max) || 25000,
        totalMatched:
          bmDoc.oddsData?.mapValue?.fields?.totalMatched?.integerValue ||
          bmDoc.oddsData?.mapValue?.fields?.totalMatched?.stringValue ||
          "0",
        status: bmDoc.oddsData?.mapValue?.fields?.status?.stringValue || "OPEN",
        runners: parseFirestoreRunners(bmDoc),
      };
    });

  const bDoc = betfairDocs[0]?.document?.fields;
  const bmDoc = bookmakerDocs[0]?.document?.fields;

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
        odds.status === "SUSPENDED";

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
        min: parseFirestoreNumber(f.min) || 100,
        max: parseFirestoreNumber(f.max) || 50000,
        no: {
          price: isSuspended ? null : parseFirestoreNumber(l0?.price),
          size: parseFirestoreNumber(l0?.size) || 100,
        },
        yes: {
          price: isSuspended ? null : parseFirestoreNumber(b0?.price),
          size: parseFirestoreNumber(b0?.size) || 100,
        },
      };
    });

  const newsTicker = bmDoc?.news?.stringValue || bDoc?.news?.stringValue || "";

  return {
    eventId: eIdStr,
    news: newsTicker,
    matchOdds: matchOddsList[0] || null,
    matchOddsList,
    bookmaker: bookmakerList[0] || null,
    bookmakerList,
    fancy: validFancy,
    sportsbook: sportsbookDocs.filter((d) => d.document).map((d) => d.document.fields),
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

  // Return fresh cache if within 200ms
  if (cached && Date.now() - cached.timestamp < 200) {
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
              price: isSusp ? null : (b0.price ?? null),
              size: b0.size || 0,
            },
            lay: {
              price: isSusp ? null : (l0.price ?? null),
              size: l0.size || 0,
            },
          };
        });
      };

      const matchOddsList = (data.matchOddsData || []).map((mo) => ({
        marketId: String(mo.marketId || mo.exMarketId || ""),
        marketName: mo.marketName || "Match Odds",
        min: mo.min || 100,
        max: mo.max || 1000,
        totalMatched: mo.oddsData?.totalMatched || "0",
        status: mo.oddsData?.status || "OPEN",
        runners: parseRunners(mo.oddsData?.runners, mo.runnersData),
      }));

      const bookmakerList = (data.bookmakersData || []).map((bm) => ({
        marketId: String(bm.marketId || bm.exMarketId || ""),
        marketName: bm.marketName || "Bookmaker Bhav",
        min: bm.min || 100,
        max: bm.max || 25000,
        totalMatched: bm.oddsData?.totalMatched || "0",
        status: bm.oddsData?.status || "OPEN",
        runners: parseRunners(bm.oddsData?.runners, bm.runnersData),
      }));

      const fancy = (data.fancyData || []).map((f) => {
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
          status: odds.status || "ONLINE",
          isSuspended: isSusp,
          min: f.min || 100,
          max: f.max || 50000,
          no: {
            price: isSusp ? null : (l0.price ?? null),
            size: l0.size || 100,
          },
          yes: {
            price: isSusp ? null : (b0.price ?? null),
            size: b0.size || 100,
          },
        };
      });

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
