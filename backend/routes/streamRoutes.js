import express from "express";
import axios from "axios";
import {
  STABLE_STREAM_IP,
  getClientIp,
  sportsStreamCache,
  inFlightStreamFetches,
  upstreamStreamBreaker,
  fetchSportsWatchLink,
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
      Origin: "https://nice444.com",
      Referer: parentReferer,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "X-Forwarded-For": forwardedIp,
      "X-Real-IP": forwardedIp,
    };
    const upstreamRes = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers,
      timeout: 10000,
    });

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

  // 1. Circuit breaker: if upstream recently returned 403, return diagnostic cleanly
  const blockedUntil = upstreamStreamBreaker.get(cacheKey) || 0;
  if (!forceFresh && Date.now() < blockedUntil) {
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(403).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{background:#0b0f19;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:20px;box-sizing:border-box}
        .card{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:24px;max-width:380px;width:100%;box-shadow:0 10px 25px rgba(0,0,0,0.5)}
        .icon{font-size:32px;margin-bottom:8px}
        h3{margin:0 0 8px;color:#f3f4f6;font-size:16px;font-weight:600}
        p{font-size:12px;line-height:1.5;margin:0 0 16px;color:#6b7280}
        .btn{background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
        .btn:hover{background:#1d4ed8}
      </style></head><body>
        <div class="card">
          <div class="icon">📺</div>
          <h3>Live Broadcast Stream</h3>
          <p>This stream feed is protected by provider IP firewall restrictions. Available on supported residential networks.</p>
          <button class="btn" onclick="window.location.href=window.location.pathname+'?sportId=${sportId}&fresh=1&t='+Date.now()">🔄 Retry Stream</button>
        </div>
      </body></html>
    `);
  }

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
        const pageRes = await axios.get(streamUrl, {
          headers: {
            Origin: "https://nice444.com",
            Referer: "https://nice444.com/",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "X-Forwarded-For": STABLE_STREAM_IP,
            "X-Real-IP": STABLE_STREAM_IP,
          },
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
        upstreamStreamBreaker.set(cacheKey, Date.now() + 45000);
        throw fetchErr;
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

    if (html.includes("</body>")) {
      html = html.replace("</body>", `${interceptorScript}</body>`);
    } else {
      html += interceptorScript;
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
    return res.status(status).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{background:#000;color:#9ca3af;font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px;box-sizing:border-box}
        .msg{font-size:13px;line-height:1.6}
        .title{font-size:15px;font-weight:600;color:#e5e7eb;margin-bottom:6px}
        .btn{display:inline-block;margin-top:12px;padding:6px 14px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500;cursor:pointer;border:none}
        .btn:hover{background:#1d4ed8}
      </style></head><body>
        <div class="msg">
          <div class="title">${status === 403 ? "🔒 Provider Access Restricted" : status === 404 ? "📡 Live Stream Offline" : "⚠️ Live Stream Unavailable"}</div>
          <div>${status === 403 ? "The live stream provider restricts access from cloud hosting datacenters. Works on residential networks." : status === 404 ? "No active live video broadcast is available for this event right now." : err.message}</div>
          <button class="btn" onclick="window.location.href=window.location.pathname+'?sportId=${sportId}&fresh=1&t='+Date.now()">🔄 Retry Stream</button>
        </div>
      </body></html>
    `);
  }
});

export default router;
