import axios from "axios";
import { proxyRequest } from "./authService.js";

const projectId = "universe-score";

export async function getLiveScoreData(eventId, sportId = "4") {
  const coll =
    String(sportId) === "1"
      ? "soccerScore"
      : String(sportId) === "2"
        ? "tennisScore"
        : "cricketScore";
  const url =
    "https://firestore.googleapis.com/v1/projects/universe-score/databases/(default)/documents:runQuery";
  const query = {
    structuredQuery: {
      from: [{ collectionId: coll }],
      where: {
        fieldFilter: {
          field: { fieldPath: "eventId" },
          op: "EQUAL",
          value: { stringValue: String(eventId) },
        },
      },
      limit: 1,
    },
  };
  try {
    const res = await axios.post(url, query, { timeout: 4000 });
    const doc = res.data?.[0]?.document?.fields;
    if (!doc) return null;

    const slider0 =
      doc.sliderData?.arrayValue?.values?.[0]?.mapValue?.fields || {};
    const teams = (doc.teams?.arrayValue?.values || []).map((t) => {
      const tf = t.mapValue?.fields || {};
      const scoreRows = tf.scoreRows?.arrayValue?.values || [];

      let scoreVal = tf.score?.stringValue || "";
      let oversVal = tf.overs?.stringValue || "";
      let rrVal = tf.runrate?.stringValue || "";
      let foursVal = tf.fours?.stringValue || "";
      let sixesVal = tf.sixes?.stringValue || "";
      let goalVal = tf.goal?.stringValue || "";
      let htScoreVal = tf.htscore?.stringValue || "";
      let cornersVal = tf.corners?.stringValue || "";
      let yellowVal = tf.yellowCard?.stringValue || "";
      let redVal = tf.redCard?.stringValue || "";
      let setsVal = tf.sets?.stringValue || "";
      let s1Val = tf.set1?.stringValue || "";
      let s2Val = tf.set2?.stringValue || "";
      let s3Val = tf.set3?.stringValue || "";
      let ptsVal = tf.pts?.stringValue || "";

      scoreRows.forEach((row) => {
        const rf = row.mapValue?.fields || {};
        const colList = rf.colList?.arrayValue?.values || [];
        colList.forEach((c) => {
          const cf = c.mapValue?.fields || {};
          const dt = cf.displayText?.stringValue || "";
          const icon = (cf.iconName?.stringValue || "").toLowerCase();
          if (icon.includes("goal") && !goalVal) goalVal = dt || "0";
          if (icon.includes("ht") && !htScoreVal) htScoreVal = dt || "0";
          if (icon.includes("corner") && !cornersVal) cornersVal = dt || "0";
          if (icon.includes("yellow") && !yellowVal) yellowVal = dt || "0";
          if (icon.includes("red") && !redVal) redVal = dt || "0";
          if (icon.includes("sets") && !setsVal) setsVal = dt || "0";
          if (icon === "set1" && !s1Val) s1Val = dt || "0";
          if (icon === "set2" && !s2Val) s2Val = dt || "0";
          if (icon === "set3" && !s3Val) s3Val = dt || "0";
          if (icon.includes("point") || icon.includes("pts") && !ptsVal) ptsVal = dt || "0";
          if (icon.includes("score") && !scoreVal) scoreVal = dt;
          if (icon.includes("over") && !oversVal) oversVal = dt;
          if (icon.includes("runrate") && !rrVal) rrVal = dt;
        });
      });

      return {
        name: tf.name?.stringValue || "Team",
        score: scoreVal || "0",
        overs: oversVal || "0.0",
        rr: rrVal || "0.00",
        fours: foursVal || "0",
        sixes: sixesVal || "0",
        goal: goalVal || "0",
        htscore: htScoreVal || "0",
        corners: cornersVal || "0",
        yellowCard: yellowVal || "0",
        redCard: redVal || "0",
        sets: setsVal || "0",
        set1: s1Val || "0",
        set2: s2Val || "0",
        set3: s3Val || "0",
        pts: ptsVal || "0",
      };
    });

    return {
      eventId,
      statusCommentry:
        slider0.statusCommentry?.stringValue ||
        slider0.commentary?.stringValue ||
        doc.statusCommentry?.stringValue ||
        "",
      team1Name: doc.team1Name?.stringValue || teams[0]?.name || "Team 1",
      team2Name: doc.team2Name?.stringValue || teams[1]?.name || "Team 2",
      teams,
    };
  } catch (err) {
    return null;
  }
}

export const queryFirestoreForEvent = async (eventId, sportId = "4") => {
  const fetchCollection = async (collectionId) => {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
      const query = {
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: "exEventId" },
              op: "EQUAL",
              value: { stringValue: String(eventId) },
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

  const [betfairDocs, bookmakerDocs, fancyDocs] = await Promise.all([
    fetchCollection("Betfair"),
    fetchCollection("Bookmakers"),
    fetchCollection("Fancy"),
  ]);

  const parseNumber = (f) => {
    if (!f) return 0;
    const raw = f.doubleValue ?? f.integerValue;
    if (raw === "NaN" || raw === null || raw === undefined) return 0;
    const n = Number(raw);
    return isNaN(n) ? 0 : n;
  };

  const parseRunners = (fields) => {
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

      const backPrice = parseNumber(b0?.price);
      const backSize = parseNumber(b0?.size);
      const layPrice = parseNumber(l0?.price);
      const laySize = parseNumber(l0?.size);

      return {
        selectionId: selId,
        name,
        status: runnerStatus,
        isSuspended:
          isSuspended ||
          (backPrice === 0 &&
            layPrice === 0 &&
            backSize === 0 &&
            laySize === 0) ||
          isNaN(backPrice) ||
          isNaN(layPrice),
        back: {
          price:
            isSuspended || backPrice === 0 || isNaN(backPrice)
              ? null
              : backPrice,
          size: isNaN(backSize) ? 0 : backSize,
        },
        lay: {
          price: isSuspended || isNaN(layPrice) ? 0 : layPrice,
          size: isNaN(laySize) ? 0 : laySize,
        },
      };
    });
  };

  const matchOddsList = betfairDocs
    .filter((d) => d.document)
    .map((d) => {
      const bDoc = d.document.fields;
      return {
        marketId: bDoc.exMarketId?.stringValue || d.document.name.split("/").pop(),
        marketName: bDoc.marketName?.stringValue || "Match Odds",
        min: parseNumber(bDoc.min) || 100,
        max: parseNumber(bDoc.max) || 1000,
        totalMatched:
          bDoc.oddsData?.mapValue?.fields?.totalMatched?.integerValue ||
          bDoc.oddsData?.mapValue?.fields?.totalMatched?.stringValue ||
          "0",
        status: bDoc.oddsData?.mapValue?.fields?.status?.stringValue || "OPEN",
        runners: parseRunners(bDoc),
      };
    });

  const bookmakerList = bookmakerDocs
    .filter((d) => d.document)
    .map((d) => {
      const bmDoc = d.document.fields;
      return {
        marketId: bmDoc.exMarketId?.stringValue || d.document.name.split("/").pop(),
        marketName: bmDoc.marketName?.stringValue || "Bookmaker Bhav",
        min: parseNumber(bmDoc.min) || 100,
        max: parseNumber(bmDoc.max) || 25000,
        totalMatched:
          bmDoc.oddsData?.mapValue?.fields?.totalMatched?.integerValue ||
          bmDoc.oddsData?.mapValue?.fields?.totalMatched?.stringValue ||
          "0",
        status: bmDoc.oddsData?.mapValue?.fields?.status?.stringValue || "OPEN",
        runners: parseRunners(bmDoc),
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
        odds.status?.stringValue === "SUSPENDED";

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
        min: parseNumber(f.min) || 100,
        max: parseNumber(f.max) || 50000,
        no: {
          price: parseNumber(l0?.price),
          size: parseNumber(l0?.size) || 100,
        },
        yes: {
          price: parseNumber(b0?.price),
          size: parseNumber(b0?.size) || 100,
        },
      };
    });

  const newsTicker = bmDoc?.news?.stringValue || bDoc?.news?.stringValue || "";

  return {
    eventId,
    news: newsTicker,
    matchOdds: matchOddsList[0] || null,
    matchOddsList,
    bookmaker: bookmakerList[0] || null,
    bookmakerList,
    fancy: validFancy,
  };
};

