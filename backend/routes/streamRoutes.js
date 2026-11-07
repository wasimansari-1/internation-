import express from "express";
import axios from "axios";
import {
  STABLE_STREAM_IP,
  getClientIp,
  sportsStreamCache,
  inFlightStreamFetches,
  fetchSportsWatchLink,
  fetchDirectHlsStream,
  fetchStreamPageContent,
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
    const origin = req.query.origin || "https://startexch99.com";
    const parentReferer = targetUrl.replace(/\/(ping|flag|bye).*$/, "");
    const headers = {
      "Content-Type": req.headers["content-type"] || "application/json",
      Origin: origin,
      Referer: parentReferer || `${origin}/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    };

    let upstreamRes;
    try {
      upstreamRes = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers,
        timeout: 8000,
        httpsAgent: nativeHttpsAgent,
      });
    } catch (dirErr) {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      upstreamRes = await axios({
        method: req.method,
        url: proxyUrl,
        data: req.body,
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Referer: parentReferer || `${origin}/`,
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

// 1. Same-Origin Live M3U8 Playlist Reverse Proxy (Eliminates CORS & Domain 403 Forbidden)
router.get("/hls/:eventId/live.m3u8", async (req, res) => {
  const { eventId } = req.params;
  const sportId = req.query.sportId || "4";
  try {
    const hlsData = await fetchDirectHlsStream(eventId, sportId);
    if (!hlsData || !hlsData.hlsUrl) {
      return res.status(404).send("#EXTM3U\n#EXT-X-ERROR: Stream not available");
    }
    const origin = hlsData.origin || "https://startexch99.com";
    const upstreamRes = await axios.get(hlsData.hlsUrl, {
      headers: {
        Origin: origin,
        Referer: `${origin}/`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      httpsAgent: nativeHttpsAgent,
      timeout: 7000,
    });

    let m3u8 = upstreamRes.data;
    if (typeof m3u8 !== "string") {
      return res.status(502).send("#EXTM3U\n#EXT-X-ERROR: Invalid playlist");
    }

    const baseStreamUrl = hlsData.baseHlsUrl.replace(/[^\/]+$/, "");
    m3u8 = m3u8.replace(/([a-zA-Z0-9_\-]+\.ts)(\?token=[^\s\r\n]+)?/g, (match, seg, tokenPart) => {
      const fullUrl = `${baseStreamUrl}${seg}${tokenPart || ""}`;
      return `/api/stream/hls/segment?origin=${encodeURIComponent(origin)}&url=${encodeURIComponent(fullUrl)}`;
    });

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(m3u8);
  } catch (err) {
    return res.status(500).send("#EXTM3U\n#EXT-X-ERROR: " + err.message);
  }
});

// 2. High-speed Binary TS Video Segment Streamer
router.get("/hls/segment", async (req, res) => {
  const targetUrl = req.query.url;
  const origin = req.query.origin || "https://startexch99.com";
  if (!targetUrl) return res.status(400).send("url is required");

  try {
    const upstream = await axios({
      method: "GET",
      url: targetUrl,
      responseType: "stream",
      headers: {
        Origin: origin,
        Referer: `${origin}/`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      httpsAgent: nativeHttpsAgent,
      timeout: 8000,
    });

    res.setHeader("Content-Type", "video/mp2t");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=30");
    upstream.data.pipe(res);
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(err.response?.status || 500).send("Segment fetch error");
  }
});

router.get("/sports-tv-proxy/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const sportId = req.query.sportId || "4";
  const forceFresh = req.query.fresh === "1";
  const clientIp = getClientIp(req);
  const cacheKey = String(eventId);

  if (forceFresh) {
    sportsStreamCache.delete(cacheKey);
  }

  // 1. Check existing cached HTML
  const existingCached = sportsStreamCache.get(cacheKey);
  if (
    !forceFresh &&
    existingCached &&
    existingCached.html &&
    Date.now() < existingCached.expiresAt
  ) {
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=10, s-maxage=30");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(existingCached.html);
  }

  // 2. Promise coalescing for concurrent viewers of same stream
  if (inFlightStreamFetches.has(cacheKey)) {
    try {
      const html = await inFlightStreamFetches.get(cacheKey);
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("X-Frame-Options");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (e) {}
  }

  const fetchPromise = (async () => {
    // Strategy 1: Direct High-Performance HLS Resolution (No domain whitelist check, pure HLS stream)
    try {
      const hlsData = await fetchDirectHlsStream(eventId, sportId, forceFresh);
      if (hlsData && hlsData.hlsUrl) {
        const playerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Live TV</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; user-select: none; }
    #player-wrap { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #000; }
    #video { width: 100%; height: 100%; object-fit: contain; background: #000; display: block; }
    
    .live-badge { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); color: #fff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px; display: flex; align-items: center; gap: 6px; z-index: 10; pointer-events: none; border: 1px solid rgba(255,255,255,0.15); }
    .live-badge .dot { width: 7px; height: 7px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 8px #ef4444; animation: pulse 1.2s infinite; }
    @keyframes pulse { 0%{opacity:0.4; transform:scale(0.9)} 50%{opacity:1; transform:scale(1.1)} 100%{opacity:0.4; transform:scale(0.9)} }
    
    .controls-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 12px; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%); display: flex; align-items: center; justify-content: flex-end; gap: 10px; z-index: 10; }
    .vol-container { display: flex; align-items: center; gap: 8px; background: rgba(20,20,20,0.8); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; padding: 4px 10px; backdrop-filter: blur(4px); }
    .btn-ctrl { background: none; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 2px; }
    .btn-ctrl svg { width: 18px; height: 18px; fill: currentColor; }
    .vol-slider { width: 65px; height: 4px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.3); border-radius: 2px; outline: none; cursor: pointer; }
    .vol-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #3b82f6; cursor: pointer; }
    .btn-fullscreen { background: rgba(20,20,20,0.8); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; padding: 6px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
    .btn-fullscreen svg { width: 16px; height: 16px; fill: currentColor; }
    
    #loading { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px; font-weight: 600; z-index: 5; pointer-events: none; gap: 8px; background: rgba(0,0,0,0.5); }
    .spinner { width: 28px; height: 28px; border: 3px solid rgba(255,255,255,0.15); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js"></script>
</head>
<body>
  <div id="player-wrap">
    <div class="live-badge"><span class="dot"></span> LIVE</div>
    <div id="loading">
      <div class="spinner"></div>
      <span>Loading Live Match Stream…</span>
    </div>
    <video id="video" autoplay playsinline muted></video>
    <div class="controls-overlay">
      <div class="vol-container">
        <button id="btn-mute" class="btn-ctrl" title="Mute/Unmute">
          <svg id="icon-vol-high" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          <svg id="icon-vol-mute" viewBox="0 0 24 24" style="display:none;"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
        </button>
        <input type="range" id="vol-slider" class="vol-slider" min="0" max="1" step="0.05" value="0.8">
      </div>
      <button id="btn-fullscreen" class="btn-fullscreen" title="Full Screen">
        <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
      </button>
    </div>
  </div>
  <script>
    const video = document.getElementById('video');
    const loading = document.getElementById('loading');
    const btnMute = document.getElementById('btn-mute');
    const iconHigh = document.getElementById('icon-vol-high');
    const iconMute = document.getElementById('icon-vol-mute');
    const volSlider = document.getElementById('vol-slider');
    const btnFs = document.getElementById('btn-fullscreen');
    const wrap = document.getElementById('player-wrap');

    video.muted = true;
    volSlider.value = 0.8;
    video.volume = 0.8;
    iconHigh.style.display = 'none';
    iconMute.style.display = 'block';

    btnMute.addEventListener('click', () => {
      video.muted = !video.muted;
      if (video.muted) {
        iconHigh.style.display = 'none';
        iconMute.style.display = 'block';
      } else {
        iconHigh.style.display = 'block';
        iconMute.style.display = 'none';
      }
    });

    volSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      video.volume = val;
      if (val === 0) {
        video.muted = true;
        iconHigh.style.display = 'none';
        iconMute.style.display = 'block';
      } else {
        video.muted = false;
        iconHigh.style.display = 'block';
        iconMute.style.display = 'none';
      }
    });

    btnFs.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        wrap.requestFullscreen().catch(err => console.error(err));
      } else {
        document.exitFullscreen().catch(err => console.error(err));
      }
    });

    const hlsUrl = "/api/stream/hls/${eventId}/live.m3u8?sportId=${sportId}";
    let hlsInstance = null;

    function playStream() {
      if (Hls.isSupported()) {
        hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 0,
          maxBufferLength: 4,
          maxMaxBufferLength: 8,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 4,
        });
        hlsInstance.loadSource(hlsUrl);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
          video.play().catch(() => {});
          loading.style.display = 'none';
        });
        hlsInstance.on(Hls.Events.ERROR, function(event, data) {
          if (data.fatal) {
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn("HLS network error recovery");
                hlsInstance.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("HLS media error recovery");
                hlsInstance.recoverMediaError();
                break;
              default:
                console.error("HLS unrecoverable error, reload");
                setTimeout(() => window.location.reload(), 2500);
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        video.addEventListener('loadedmetadata', function() {
          video.play().catch(() => {});
          loading.style.display = 'none';
        });
      }
    }

    video.addEventListener('playing', () => {
      loading.style.display = 'none';
    });

    video.addEventListener('waiting', () => {
      loading.style.display = 'flex';
    });

    playStream();

    // Heartbeat token extension
    setInterval(() => {
      fetch('/api/stream/ltve-fetch-proxy?origin=' + encodeURIComponent('${hlsData.origin || "https://startexch99.com"}') + '&url=' + encodeURIComponent('https://tv.ltve.live${hlsData.pingUrl}'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid: '${hlsData.sid}', mode: null, init: false, tz: 'Asia/Kolkata' })
      }).then(r => r.json()).then(data => {
        if (data && data.token && hlsInstance) {
          console.log('[Stream] Heartbeat extended successfully');
        }
      }).catch(e => console.warn('[Stream] Heartbeat fail:', e));
    }, 15000);
  </script>
</body>
</html>
        `;
        sportsStreamCache.set(cacheKey, {
          html: playerHtml,
          hlsUrl: hlsData.hlsUrl,
          expiresAt: Date.now() + 45000,
        });
        return playerHtml;
      }
    } catch (hlsErr) {
      console.warn("[StreamProxy] Direct HLS resolution failed:", hlsErr.message);
      throw hlsErr;
    }
  })();

  inFlightStreamFetches.set(cacheKey, fetchPromise);

  try {
    const finalHtml = await fetchPromise;
    inFlightStreamFetches.delete(cacheKey);
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(finalHtml);
  } catch (err) {
    inFlightStreamFetches.delete(cacheKey);
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
