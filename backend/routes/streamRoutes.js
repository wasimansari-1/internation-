import express from "express";
import axios from "axios";
import {
  STABLE_STREAM_IP,
  getClientIp,
  sportsStreamCache,
  fetchSportsWatchLink,
  nativeHttpsAgent,
} from "../services/streamService.js";

const router = express.Router();

router.post("/watch-link", async (req, res) => {
  const { streamId, sportId } = req.body;
  const clientIp = getClientIp(req);
  try {
    const result = await fetchSportsWatchLink(streamId, sportId, clientIp);
    if (!result.url) {
      return res
        .status(404)
        .json({ success: false, error: "Stream URL not found", url: "" });
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.meta?.message || err.message,
      url: "",
    });
  }
});

router.all("/ltve-fetch-proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "url parameter required" });

  try {
    const parentReferer = targetUrl.replace(/\/(ping|flag|bye).*$/, "");
    const clientIp = getClientIp(req);
    const forwardedIp = clientIp || STABLE_STREAM_IP;
    const headers = {
      "Content-Type": req.headers["content-type"] || "application/json",
      Origin: "https://startexch99.com",
      Referer: parentReferer || "https://startexch99.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "X-Forwarded-For": forwardedIp,
      "X-Real-IP": forwardedIp,
      "CF-Connecting-IP": forwardedIp,
    };

    let upstreamRes;
    try {
      upstreamRes = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers,
        timeout: 8000,
      });
    } catch (dirErr) {
      // Fallback via Edge Proxy if direct CloudFront blocks datacenter IP
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      upstreamRes = await axios({
        method: req.method,
        url: proxyUrl,
        data: req.body,
        headers: {
          "Content-Type": "application/json",
          Origin: "https://startexch99.com",
          Referer: parentReferer || "https://startexch99.com/",
        },
        timeout: 6000,
      });
    }

    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS, PUT, DELETE",
    );
    res.setHeader("Access-Control-Allow-Headers", "*");
    return res.status(upstreamRes.status).send(upstreamRes.data);
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res
      .status(err.response?.status || 500)
      .json(err.response?.data || { error: err.message });
  }
});

router.get("/sports-tv-proxy/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const sportId = req.query.sportId || "4";
  const forceFresh = req.query.fresh === "1";
  const clientIp = getClientIp(req);

  try {
    const result = await fetchSportsWatchLink(eventId, sportId, clientIp, forceFresh);
    if (result && result.url) {
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("X-Frame-Options");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.redirect(302, result.url);
    }
    throw new Error("No live stream broadcast found for this event");
  } catch (err) {
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    return res.status(200).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Live Sports TV</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body{background:#000000;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:16px;}
        .icon{font-size:28px;margin-bottom:8px;}
        .msg{max-width:340px;width:100%;display:flex;flex-direction:column;align-items:center;}
        .title{font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:6px;}
        .desc{font-size:12px;color:#64748b;margin-bottom:14px;line-height:1.4;}
        .btn-retry{display:inline-flex;align-items:center;gap:6px;background:#1e293b;border:1px solid #334155;color:#93c5fd;font-size:11px;font-weight:700;padding:6px 14px;border-radius:6px;cursor:pointer;text-decoration:none;transition:all 0.15s;}
        .btn-retry:hover{background:#334155;color:#fff;}
      </style></head><body>
        <div class="msg">
          <div class="icon">📺</div>
          <div class="title">Live Stream Not Available</div>
          <div class="desc">No active video broadcast for this match (Match inactive or stream ended).</div>
          <button class="btn-retry" onclick="window.location.reload();">🔄 Retry Check</button>
        </div>
      </body></html>
    `);
  }
});

export default router;
