import axios from "axios";
import { getDirectCasinoStreamUrl, CASINO_GAME_MAP } from "./casinoDirectStream.js";
import { getDirectSportsStreamUrl } from "./sportsDirectStream.js";
import { nativeHttpsAgent } from "../services/streamService.js";

// Stream slug map for failover relay - Full 30+ Universe & Exchange Casino Tables Supported
const GAME_SLUG_MAP = {
  // Teen Patti 20-20
  "3030": "teen20",
  "teen20": "teen20",
  "99.0010": "teen20",

  // 1 Day Teen Patti
  "3031": "teen",
  "teen": "teen",
  "99.0013": "teen",

  // Muflis & Other Teen Patti
  "3048": "teen9",
  "3049": "teen8",
  "3078": "teen33",
  "3080": "teen32",
  "99.0014": "teen",
  "99.0015": "teen",

  // Joker Teen Patti
  "3065": "joker120",
  "joker120": "joker120",
  "99.0016": "joker120",

  // Dragon Tiger 20-20
  "3035": "dt20",
  "dt20": "dt20",
  "99.0018": "dt20",
  "99.0019": "dt20",
  "99.0020": "dt20",

  // Dragon Tiger 2
  "3059": "dt202",
  "dt202": "dt202",

  // 1 Day Dragon Tiger
  "3057": "dt6",
  "dt6": "dt6",
  "99.0021": "dt6",

  // Dragon Tiger Lion
  "3047": "dtl20",
  "dtl20": "dtl20",
  "99.0041": "dtl20",
  "99.0004": "dtl20",

  // Lucky 7 EU (A)
  "3032": "lucky7eu",
  "lucky7eu": "lucky7eu",
  "99.0030": "lucky7eu",
  "99.0032": "lucky7eu",

  // Lucky 7 B
  "3058": "lucky7",
  "lucky7": "lucky7",
  "99.0031": "lucky7",

  // Andar Bahar
  "3053": "ab20",
  "3055": "ab20",
  "ab20": "ab20",
  "andarbahar": "ab20",
  "andar-bahar": "ab20",
  "andarBahar": "ab20",
  "99.0025": "ab20",

  // Andar Bahar 2 (ABJ)
  "3043": "abj",
  "abj": "abj",
  "99.0034": "abj",

  // 32 Cards EU (A)
  "3034": "card32eu",
  "card32eu": "card32eu",
  "card32": "card32eu",
  "99.0022": "card32eu",

  // 32 Cards B
  "99.0023": "card32",

  // Baccarat (A)
  "3044": "baccarat",
  "baccarat": "baccarat",
  "99.0001": "baccarat",

  // Baccarat 2
  "3033": "baccarat2",
  "baccarat2": "baccarat2",
  "99.0002": "baccarat2",

  // 20-20 Poker A
  "3051": "poker",
  "poker": "poker",
  "99.0007": "poker",
  "99.0027": "poker",

  // 20-20 Poker B
  "3052": "poker20",
  "poker20": "poker20",
  "99.0008": "poker20",

  // Amar Akbar Anthony
  "3056": "aaa",
  "3040": "aaa",
  "aaa": "aaa",
  "99.0005": "aaa",
  "99.0029": "aaa",

  // Worli Matka
  "3054": "worli",
  "worli": "worli",
  "99.0009": "worli2",

  // Bollywood Table
  "3041": "btable",
  "btable": "btable",
  "99.0050": "btable",

  // Card Race
  "3036": "race20",
  "race20": "race20",
  "99.0046": "race20",

  // Queen / Ina Mina Dika
  "3037": "queen",
  "queen": "queen",
  "99.0006": "queen",

  // Casino War
  "3038": "war",
  "war": "war",

  // 3 Cards Judgement
  "3039": "3cardj",
  "3cardj": "3cardj",
  "99.0040": "3cardj",

  // Roulette
  "3066": "roulette12",
  "roulette12": "roulette12",

  // Casino Meter
  "3046": "cmeter",
  "cmeter": "cmeter",
  "99.0051": "cmeter",
  "99.0055": "cmeter",

  // 1 Card 20-20
  "3045": "cmatch20",
  "cmatch20": "cmatch20",
  "99.0057": "cmatch20",

  // Lottery / Super Over
  "3060": "superover",
  "superover": "superover",
  "99.0058": "superover",
  "99.0059": "superover"
};

/**
 * Render Casino Live Player HTML (Dual-Engine: Direct WebRTC + Instant Failover Relay)
 */
export async function renderCasinoPlayerHtml(gameId, req, res) {
  const cleanId = String(gameId || "").trim().toLowerCase();
  const slug = GAME_SLUG_MAP[cleanId] || cleanId;

  // Set response headers to allow seamless iframe embedding and suppress unload violation
  res.removeHeader("Content-Security-Policy");
  res.removeHeader("X-Frame-Options");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Permissions-Policy", "unload=*");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  // Attempt 1: Fetch live stream from direct relay player
  try {
    const relayUrl = `https://stream.trubets365.com/?id=${encodeURIComponent(slug)}`;
    const relayRes = await axios.get(relayUrl, {
      headers: {
        "User-Agent":
          req.headers["user-agent"] ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://casino.diamondcricketid.com/"
      },
      httpsAgent: nativeHttpsAgent,
      timeout: 4000
    });

    if (relayRes.status === 200 && typeof relayRes.data === "string" && relayRes.data.includes("<html")) {
      let html = relayRes.data;

      // Fix base and asset URLs to point directly to reliable CDN
      html = html.replace('<base href="/stream-assets/">', '<base href="https://stream.trubets365.com/stream-assets/">');
      html = html.replace(/href="player\//g, 'href="https://stream.trubets365.com/stream-assets/player/');
      html = html.replace(/src="newplayer\.min\.js/g, 'src="https://stream.trubets365.com/stream-assets/newplayer.min.js');
      html = html.replace(/src="player\/player\.bundle\.js/g, 'src="https://stream.trubets365.com/stream-assets/player/player.bundle.js');

      // Inject robust runtime script & responsive CSS
      const injectedHeader = `
        <script>
          // Silence Chrome unload permissions-policy violation by mapping to pagehide
          try {
            var _origAddEvent = window.addEventListener;
            window.addEventListener = function(t, l, o) {
              if (t === 'unload') {
                return _origAddEvent.call(this, 'pagehide', l, o);
              }
              return _origAddEvent.call(this, t, l, o);
            };
            // Filter benign playback suspension on tab switch (code 1007)
            var _origLog = console.log;
            console.log = function() {
              var s = Array.prototype.join.call(arguments, ' ');
              if (s.indexOf('Playback suspended') !== -1 || s.indexOf('1007') !== -1) {
                return;
              }
              return _origLog.apply(console, arguments);
            };
          } catch (_) {}
          try {
            if (!window.location.search || !window.location.search.includes('id=')) {
              var _u = new URL(window.location.href);
              _u.searchParams.set('id', '${slug}');
              _u.searchParams.set('gameType', '${slug}');
              window.history.replaceState({}, '', _u.toString());
            }
          } catch (_) {}
          try {
            var _streamSettings = {
              videoPlayerId: "stream-player",
              groupId: "e89f0ed4-b154-457f-9726-9ee50f4487f9",
              ptype: "nano",
              gameType: "${slug}",
              wsid: "${slug}",
              type: "front",
              backgroundUrl: "https://stream.trubets365.com/stream-assets/player/assets/videobg.jpg?v=1"
            };
            Object.defineProperty(window, 'STREAM_PLAYER_SETTINGS', {
              configurable: true,
              get: function() { return _streamSettings; },
              set: function(v) { Object.assign(_streamSettings, v, { gameType: "${slug}", wsid: "${slug}" }); }
            });
          } catch (_) {}
        </script>
        <style>
          html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }
          #stream-player, #middleView-playerDiv, video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
        </style>
      `;
      html = html.replace("<head>", `<head>${injectedHeader}`);

      return res.status(200).send(html);
    }
  } catch (relayErr) {
    console.warn(`[DirectStreamEngine] Relay fetch failed for ${slug}:`, relayErr.message);
  }

  // Attempt 2: Direct Universe Studio WebRTC Player
  try {
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.headers["cf-connecting-ip"] ||
      "49.36.142.88";

    const streamInfo = await getDirectCasinoStreamUrl(gameId, false, clientIp);
    if (streamInfo.success && streamInfo.url) {
      const providerOrigin =
        streamInfo.provider === "Startexch99"
          ? "https://casino.startexch99.com"
          : "https://casino.nice444.com";

      const streamRes = await axios.get(streamInfo.url, {
        headers: {
          Origin: providerOrigin,
          Referer: `${providerOrigin}/`,
          "User-Agent":
            req.headers["user-agent"] ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        httpsAgent: nativeHttpsAgent,
        timeout: 4000
      });

      if (streamRes.status === 200 && typeof streamRes.data === "string" && !streamRes.data.includes("Access blocked")) {
        let html = streamRes.data;
        let streamHost = "https://live.livecdnplatin.com";
        try { streamHost = new URL(streamInfo.url).origin; } catch (_) {}

        html = html.replace(/src="\/player\//g, `src="${streamHost}/player/`);
        html = html.replace(/href="\/player\//g, `href="${streamHost}/player/`);
        html = html.replace(/"enforce"\s*:\s*true/g, '"enforce":false');
        html = html.replace(/"devtoolsGuard"\s*:\s*true/g, '"devtoolsGuard":false');

        return res.status(200).send(html);
      }
    }
  } catch (webrtcErr) {
    console.warn(`[DirectStreamEngine] WebRTC fetch failed for ${gameId}:`, webrtcErr.message);
  }

  // Fallback: If both are momentarily syncing, provide auto-refreshing loading frame
  return res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { margin:0; padding:0; background:#070b14; color:#38bdf8; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center; }
        .spinner { width:32px; height:32px; border:3px solid #1e293b; border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 12px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div>
        <div class="spinner"></div>
        <div style="font-size:12px; font-weight:700; letter-spacing:0.5px;">CONNECTING TO DEALER STUDIO...</div>
        <script>setTimeout(function(){ window.location.reload(); }, 2000);</script>
      </div>
    </body>
    </html>
  `);
}

/**
 * Render Sports Live Match Player HTML
 */
export async function renderSportsPlayerHtml(eventId, sportId = "4", req, res) {
  try {
    const streamInfo = await getDirectSportsStreamUrl(eventId, sportId);
    if (!streamInfo.success || !streamInfo.url) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Live Match Stream</title>
          <style>
            body { margin:0; padding:0; background:#070b14; color:#94a3b8; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center; }
            .msg { font-size:13px; font-weight:600; letter-spacing:0.5px; color:#38bdf8; }
          </style>
        </head>
        <body>
          <div>
            <div class="msg">MATCH FEED COMMENCING SHORTLY...</div>
            <script>setTimeout(function(){ window.location.reload(); }, 4000);</script>
          </div>
        </body>
        </html>
      `);
    }

    return res.redirect(streamInfo.url);
  } catch (err) {
    console.error("[DirectStreamEngine] Sports player render error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Render Interactive Match Radar / Ball-by-ball Tracker HTML
 */
export function renderRadarHtml(eventId, res) {
  const radarUrl = `https://tv.tresting.com/lnt.php?eventid=${encodeURIComponent(eventId)}&matchId=${encodeURIComponent(eventId)}`;
  res.removeHeader("Content-Security-Policy");
  res.removeHeader("X-Frame-Options");
  return res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Match Radar</title>
      <style>
        html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #000; }
        iframe { width: 100%; height: 100%; border: 0; }
      </style>
    </head>
    <body>
      <iframe src="${radarUrl}" allow="autoplay; fullscreen" loading="lazy"></iframe>
    </body>
    </html>
  `);
}
