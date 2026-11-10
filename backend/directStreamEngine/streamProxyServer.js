import axios from "axios";
import { getDirectCasinoStreamUrl } from "./casinoDirectStream.js";
import { getDirectSportsStreamUrl } from "./sportsDirectStream.js";
import { nativeHttpsAgent } from "../services/streamService.js";

/**
 * Render Casino WebRTC Player HTML
 */
export async function renderCasinoPlayerHtml(gameId, req, res) {
  try {
    const streamInfo = await getDirectCasinoStreamUrl(gameId);
    if (!streamInfo.success || !streamInfo.url) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Casino Live Stream</title>
          <style>
            body { margin:0; padding:0; background:#070b14; color:#94a3b8; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center; }
            .msg { font-size:13px; font-weight:600; letter-spacing:0.5px; color:#38bdf8; }
            .dots { margin-top:8px; opacity:0.6; }
          </style>
        </head>
        <body>
          <div>
            <div class="msg">CONNECTING TO DEALER STUDIO...</div>
            <div class="dots">Please wait</div>
            <script>setTimeout(function(){ window.location.reload(); }, 3000);</script>
          </div>
        </body>
        </html>
      `);
    }

    // Fetch the live WebRTC player page from upstream CDN
    const watchUrl = streamInfo.url;
    let streamOrigin = "https://live.livecdnplatin.com";
    try {
      streamOrigin = new URL(watchUrl).origin;
    } catch (_) {}

    const response = await axios.get(watchUrl, {
      headers: {
        Origin: "https://casino.nice444.com",
        Referer: "https://casino.nice444.com/",
        "User-Agent":
          req.headers["user-agent"] ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      httpsAgent: nativeHttpsAgent,
      timeout: 7000
    });

    let html = response.data;
    if (typeof html === "string") {
      // Correct relative paths to point to upstream CDN
      html = html.replace(/src="\/player\/player\.js/g, `src="${streamOrigin}/player/player.js`);
      html = html.replace(/href="\/player\//g, `href="${streamOrigin}/player/`);

      // Strip security lockups / devtools guards / frame busters
      html = html.replace(/"enforce"\s*:\s*true/g, '"enforce":false');
      html = html.replace(/"devtoolsGuard"\s*:\s*true/g, '"devtoolsGuard":false');

      // Inject clean custom styling for seamless iframe embedding
      const customStyles = `
        <style>
          html, body { width: 100% !important; height: 100% !important; overflow: hidden !important; background: #000 !important; margin: 0 !important; }
          #videoPlayer { width: 100% !important; height: 100% !important; object-fit: contain !important; }
        </style>
      `;
      html = html.replace("</head>", `${customStyles}</head>`);

      res.removeHeader("Content-Security-Policy");
      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    }

    return res.redirect(watchUrl);
  } catch (err) {
    console.error("[DirectStreamEngine] Casino player render error:", err.message);
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <body style="background:#070b14;color:#ef4444;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;text-align:center;">
        <div>
          <p style="font-size:13px;font-weight:600;">LIVE FEED TEMPORARILY RECONNECTING...</p>
          <script>setTimeout(function(){ window.location.reload(); }, 3500);</script>
        </div>
      </body>
      </html>
    `);
  }
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
