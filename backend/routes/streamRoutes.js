import express from "express";
import axios from "axios";
import {
  STABLE_STREAM_IP,
  getClientIp,
  sportsStreamCache,
  inFlightStreamFetches,
  upstreamStreamBreaker,
  fetchSportsWatchLink,
  fetchDirectHlsStream,
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
  const cacheKey = String(eventId);

  if (forceFresh) {
    sportsStreamCache.delete(cacheKey);
    upstreamStreamBreaker.delete(cacheKey);
  }

  // 2. Check if we already have a cached HTML payload
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
    res.setHeader(
      "Cache-Control",
      "public, max-age=10, s-maxage=30, stale-while-revalidate=15",
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(existingCached.html);
  }

  // 3. Promise coalescing
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
    // 1. Direct High-Performance HLS Resolution (Zero 404, Zero Relative Path Bugs)
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
      updateVolUI();
    });

    volSlider.addEventListener('input', (e) => {
      video.volume = parseFloat(e.target.value);
      video.muted = video.volume === 0;
      updateVolUI();
    });

    function updateVolUI() {
      if (video.muted || video.volume === 0) {
        iconHigh.style.display = 'none';
        iconMute.style.display = 'block';
      } else {
        iconHigh.style.display = 'block';
        iconMute.style.display = 'none';
      }
    }

    btnFs.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        wrap.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    const hlsUrl = "${hlsData.hlsUrl}";
    let currentToken = "${hlsData.token || ""}";
    const streamSid = "${hlsData.sid || ""}";
    const pingEndpoint = "/api/stream/ltve-fetch-proxy?url=" + encodeURIComponent("https://tv.ltve.live${hlsData.pingUrl || ""}");

    function onPlayReady() {
      if (loading) loading.style.display = 'none';
      video.play().catch(() => {});
    }

    // Auto-refresh the sliding session token every 6 seconds so it NEVER expires
    function extendSessionToken() {
      if (!streamSid || !pingEndpoint) return;
      fetch(pingEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid: streamSid, mode: "hls", init: false, tz: "Asia/Kolkata" })
      })
      .then(res => res.json())
      .then(d => {
        if (d && d.token) {
          currentToken = d.token;
        }
      })
      .catch(() => {});
    }

    setInterval(extendSessionToken, 6000);

    // High-Performance Zero-Buffer Settings for Live Stream
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 8,
        startFragPrefetch: true,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 500,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 5,
        xhrSetup: function(xhr, url) {
          if (currentToken && url.includes("token=")) {
            try {
              const u = new URL(url);
              u.searchParams.set("token", currentToken);
              xhr.open("GET", u.toString(), true);
            } catch(e) {}
          }
        }
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, onPlayReady);
      hls.on(Hls.Events.ERROR, function(event, data) {
        if (data.response && (data.response.code === 403 || data.response.code === 401)) {
          extendSessionToken();
          setTimeout(() => hls.startLoad(), 400);
          return;
        }
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              extendSessionToken();
              setTimeout(() => hls.startLoad(), 500);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setTimeout(() => { window.location.reload(); }, 2000);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', onPlayReady);
    }
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
      console.warn("[StreamProxy] Direct HLS resolution failed, falling back to iframe:", hlsErr.message);
    }

    let result;
    try {
      result = await fetchSportsWatchLink(eventId, sportId, clientIp, forceFresh);
    } catch (watchErr) {
      const status = watchErr.response?.status || 500;
      const msg = watchErr.response?.data?.meta?.message || watchErr.message;
      const customErr = new Error(
        `fetchSportsWatchLink failed: ${status} - ${msg}`,
      );
      customErr.status = status;
      throw customErr;
    }

    if (!result || !result.url) {
      const notFoundErr = new Error(
        "No live broadcast URL returned for this event",
      );
      notFoundErr.status = 404;
      throw notFoundErr;
    }

    const fetchStreamPage = async (streamUrl) => {
      try {
        const originUrl = result.provider === "Startexch99" ? "https://startexch99.com" : "https://nice444.com";
        const pageRes = await axios.get(streamUrl, {
          headers: {
            Origin: originUrl,
            Referer: `${originUrl}/`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
            "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "iframe",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
            "X-Forwarded-For": clientIp,
            "X-Real-IP": clientIp,
            "CF-Connecting-IP": clientIp,
            "True-Client-IP": clientIp,
          },
          httpsAgent: nativeHttpsAgent,
          timeout: 8000,
        });
        if (
          typeof pageRes.data === "string" &&
          (pageRes.data.includes("not valid here") ||
            pageRes.data.includes("replaced this one") ||
            pageRes.data.includes("Not allowed") ||
            pageRes.data.includes("Link already used") ||
            pageRes.data.includes("Link expired") ||
            pageRes.data.includes("Domain not whitelisted"))
        ) {
          const staleErr = new Error(
            "Stale watch link received from upstream provider",
          );
          staleErr.status = 410;
          throw staleErr;
        }
        return pageRes.data;
      } catch (getErr) {
        const status = getErr.response?.status || getErr.status || 500;
        const bodySnippet =
          typeof getErr.response?.data === "string"
            ? getErr.response.data.slice(0, 120)
            : "";
        const pageErr = new Error(
          `fetchStreamPage failed with status ${status}: ${bodySnippet || getErr.message}`,
        );
        pageErr.status = status;
        throw pageErr;
      }
    };

    let html;
    try {
      html = await fetchStreamPage(result.url);
    } catch (fetchErr) {
      if (fetchErr.status === 403) {
        // Auto-reconnecting screen with zero manual clicks required
        const autoConnectingHtml = `
          <!DOCTYPE html><html><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Live Sports TV</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: #000; color: #fff; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden; text-align: center; }
            .spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.15); border-top-color: #ef4444; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px; }
            @keyframes spin { to { transform: rotate(360deg); } }
            .title { font-size: 13px; font-weight: 700; color: #f1f5f9; letter-spacing: 0.3px; }
            .sub { font-size: 11px; color: #64748b; margin-top: 4px; }
          </style>
          </head><body>
            <div class="spinner"></div>
            <div class="title">⚡ Connecting Live Broadcast Feed...</div>
            <div class="sub">Direct high-definition stream initializing</div>
            <script>
              setTimeout(function() {
                window.location.href = window.location.pathname + '?sportId=${sportId}&fresh=1&t=' + Date.now();
              }, 2500);
            </script>
          </body></html>
        `;
        return autoConnectingHtml;
      }
      sportsStreamCache.delete(String(eventId));
      if (result.streamId) sportsStreamCache.delete(String(result.streamId));
      result = await fetchSportsWatchLink(eventId, sportId, clientIp, true);
      if (!result.url) throw fetchErr;
      html = await fetchStreamPage(result.url);
    }

    html = html.replace(
      'src="/player/player.js',
      'src="https://tv.ltve.live/player/player.js',
    );

    const cfgMatch = html.match(
      /<script type="application\/json" id="cfg">([^<]+)<\/script>/,
    );
    if (cfgMatch) {
      try {
        const cfgObj = JSON.parse(cfgMatch[1]);
        cfgObj.devtoolsGuard = false;
        cfgObj.offlineRetry = 1;
        cfgObj.pingEvery = 4;
        cfgObj.webrtcRetries = 15;
        cfgObj.freezeSeconds = 3;
        cfgObj.startMode = "webrtc";

        // Rewrite relative URLs in cfg to go through proxy directly
        if (cfgObj.pingUrl && cfgObj.pingUrl.startsWith("/")) {
          cfgObj.pingUrl = "/api/stream/ltve-fetch-proxy?url=" + encodeURIComponent("https://tv.ltve.live" + cfgObj.pingUrl);
        }
        if (cfgObj.byeUrl && cfgObj.byeUrl.startsWith("/")) {
          cfgObj.byeUrl = "/api/stream/ltve-fetch-proxy?url=" + encodeURIComponent("https://tv.ltve.live" + cfgObj.byeUrl);
        }
        if (cfgObj.flagUrl && cfgObj.flagUrl.startsWith("/")) {
          cfgObj.flagUrl = "/api/stream/ltve-fetch-proxy?url=" + encodeURIComponent("https://tv.ltve.live" + cfgObj.flagUrl);
        }

        html = html.replace(
          cfgMatch[0],
          `<script type="application/json" id="cfg">${JSON.stringify(cfgObj)}</script>`,
        );
      } catch (e) {}
    }

    const interceptorScript = `
      <style>
        #wm{display:none!important;}
        #reconnect-toast {
          position: fixed;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(16, 185, 129, 0.92);
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 700;
          padding: 5px 12px;
          border-radius: 99px;
          z-index: 99999;
          display: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          pointer-events: none;
          letter-spacing: 0.3px;
        }
      </style>
      <div id="reconnect-toast">⚡ Auto-Reconnecting Live Feed...</div>
      <script>
        (function() {
          let isReconnecting = false;
          let reconnectCount = 0;
          function triggerReconnect(reason) {
            if (isReconnecting) return;
            reconnectCount++;
            if (reconnectCount > 3) {
              console.warn('[Stream] Maximum re-connections reached, stopping loop:', reason);
              return;
            }
            isReconnecting = true;
            console.warn('[Stream] Auto-reconnecting:', reason);
            const toast = document.getElementById('reconnect-toast');
            if (toast) toast.style.display = 'block';
            setTimeout(() => {
              window.location.href = window.location.pathname + '?sportId=${sportId}&fresh=1&t=' + Date.now();
            }, 1000);
          }

          const originalFetch = window.fetch;
          window.fetch = function(url, options) {
            const urlStr = typeof url === 'string' ? url : (url.url || '');
            if (urlStr.startsWith('/') || urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
              const fullUrl = urlStr.startsWith('http') ? urlStr : ('https://tv.ltve.live' + urlStr);
              const proxyUrl = '/api/stream/ltve-fetch-proxy?url=' + encodeURIComponent(fullUrl);
              return originalFetch(proxyUrl, options).then(res => {
                if (res.status === 409 || res.status === 410) {
                  triggerReconnect('Session replaced (HTTP ' + res.status + ')');
                }
                return res;
              });
            }
            return originalFetch(url, options);
          };

          const OrigXHR = window.XMLHttpRequest;
          window.XMLHttpRequest = function() {
            const xhr = new OrigXHR();
            const origOpen = xhr.open;
            xhr.open = function(method, url) {
              let target = url;
              if (typeof target === 'string' && (target.startsWith('/') || target.startsWith('http'))) {
                const fullUrl = target.startsWith('http') ? target : ('https://tv.ltve.live' + target);
                target = '/api/stream/ltve-fetch-proxy?url=' + encodeURIComponent(fullUrl);
              }
              return origOpen.apply(xhr, [method, target, ...Array.prototype.slice.call(arguments, 2)]);
            };
            return xhr;
          };
        })();
      </script>
    `;

    // Inject interceptor in <head> immediately so window.fetch is hooked before player.js runs
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${interceptorScript}`);
    } else if (html.includes("</body>")) {
      html = html.replace("</body>", `${interceptorScript}</body>`);
    } else {
      html = `${interceptorScript}${html}`;
    }

    sportsStreamCache.set(cacheKey, {
      html,
      url: result.url,
      streamId: result.streamId,
      expiresAt: Date.now() + 60000,
    });
    return html;
  })();

  inFlightStreamFetches.set(cacheKey, fetchPromise);

  try {
    const finalHtml = await fetchPromise;
    inFlightStreamFetches.delete(cacheKey);
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Cache-Control",
      "public, max-age=10, s-maxage=30, stale-while-revalidate=15",
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(finalHtml);
  } catch (err) {
    inFlightStreamFetches.delete(cacheKey);
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const status = err.status || 500;
    const isRestricted = status === 403;
    const isOffline = status === 404;

    return res.status(200).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body{background:#000;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:16px;}
        .spinner { width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.15); border-top-color: #ef4444; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .msg{max-width:380px;width:100%;display:flex;flex-direction:column;align-items:center;}
        .title{font-size:13px;font-weight:700;color:#f3f4f6;margin-bottom:4px;}
        .desc{font-size:11px;color:#64748b;}
      </style></head><body>
        <div class="msg">
          <div class="spinner"></div>
          <div class="title">⚡ Connecting Live Broadcast...</div>
          <div class="desc">${isOffline ? "Checking for match broadcast stream..." : "Loading live sports video feed..."}</div>
        </div>
        <script>
          setTimeout(function() {
            window.location.href = window.location.pathname + '?sportId=${sportId}&fresh=1&t=' + Date.now();
          }, 3000);
        </script>
      </body></html>
    `);
  }
});

export default router;

