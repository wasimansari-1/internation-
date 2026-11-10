---
name: website-api-scraping-stream
description: "Expert skill for reverse-engineering, scraping, and embedding zero-latency live dealer casino and sports streams (Teen Patti, Dragon Tiger, Lucky 7, Andar Bahar, DTL, Baccarat, Poker, Roulette) without competitor server dependency. Covers bypassing anti-scraping/Cloudflare, extracting unauthenticated WebRTC and Nanocosmos/H5Live WebSocket feeds, resolving iframe 404s, handling Permissions-Policy violations, and integrating into native React/Node.js betting platforms for VPS deployment."
license: MIT
metadata:
  author: Antigravity
  version: "1.0.0"
---

# Website API Scraping & Casino Live Stream Engine

This skill guides the discovery, extraction, reverse-engineering, and seamless native embedding of live casino video feeds and sports match streams without relying on competitor servers or brittle web scraping.

---

## 1. Core Architecture Principles

1. **Zero Competitor Server Dependency:**
   - Competitors often create wrapper routing domains (e.g., `casino.diamondcricketid.com`, `kingz.pro`) that simply forward IDs to upstream video relay clusters.
   - Never embed or proxy through competitor application servers or PHP routers.
   - Always trace network traffic to find the raw upstream video source (Nanocosmos H5Live CDN, Bintu Cloud, or WebRTC studio distribution).

2. **Dedicated Modular Engine Structure:**
   - Keep all stream logic strictly segregated in a dedicated folder (e.g., `backend/directStreamEngine/`):
     - `casinoDirectStream.js` — ID mapping and upstream provider resolution.
     - `sportsDirectStream.js` — Live match streams and interactive radar tracker.
     - `streamProxyServer.js` — HTML player generation, responsive CSS injection, and asset rewriting.
     - `index.js` — Express sub-router exposing endpoints (`/casino/player/:gameId`, `/demo`, etc.).

---

## 2. Reverse-Engineering Workflow

### Step 1: Inspect Upstream Network Traffic
Open Chrome DevTools Network tab on the target site:
1. Filter for `WS` (WebSocket): Look for endpoints like `wss://stream1.trubets365.com/stream/a/...` or `wss://stream2.trubets365.com/stream/c/...`.
2. Inspect WebSocket frames: Verify if unauthenticated binary chunks (AVC/H.264/AAC video fragments) are flowing.
3. Check `Doc` / `XHR`: Look for router responses like `{"url":"wss://...","wsid":"teen20"}`.

### Step 2: Extract Game Slug Mappings
Probe competitor router parameters (e.g. `?id=3030` to `?id=3080`) to discover slug equivalents:

| Game Name | Exchange ID | Universe ID | Upstream Slug |
| :--- | :---: | :---: | :--- |
| **Teen Patti 20-20** | `3030` | `99.0010` | `teen20` |
| **1 Day Teen Patti** | `3031` | `99.0013` | `teen` |
| **Joker Teen Patti** | `3065` | `99.0016` | `joker120` |
| **Dragon Tiger 20-20** | `3035` | `99.0018` | `dt20` |
| **Dragon Tiger 2** | `3059` | `99.0031` | `dt202` |
| **1 Day Dragon Tiger** | `3057` | `99.0021` | `dt6` |
| **DTL (Dragon Tiger Lion)** | `3047` | `99.0041` | `dtl20` |
| **Lucky 7 EU (A)** | `3032` | `99.0030` | `lucky7eu` |
| **Lucky 7 B** | `3058` | `99.0031` | `lucky7` |
| **Andar Bahar** | `3053` / `3055` | `99.0025` | `ab20` |
| **Andar Bahar 2 (ABJ)** | `3043` | `99.0034` | `abj` |
| **32 Cards EU** | `3034` | `99.0022` | `card32eu` |
| **32 Cards B** | `3055` | `99.0023` | `card32` |
| **Amar Akbar Anthony** | `3056` / `3040` | `99.0005` | `aaa` |
| **Baccarat** | `3044` | `99.0001` | `baccarat` |
| **Baccarat 2** | `3033` | `99.0002` | `baccarat2` |
| **20-20 Poker** | `3051` | `99.0007` | `poker` |
| **Poker 20** | `3052` | `99.0008` | `poker20` |
| **Worli Matka** | `3054` | `99.0009` | `worli` |
| **Bollywood Table** | `3041` | `99.0050` | `btable` |
| **20-20 Card Race** | `3036` | `99.0046` | `race20` |
| **Queen / Ina Mina Dika** | `3037` | `99.0006` | `queen` |
| **Casino War** | `3038` | `99.0027` | `war` |
| **3 Card Judgement** | `3039` | `99.0040` | `3cardj` |
| **Roulette** | `3066` | — | `roulette12` |

---

## 3. Resolving Common Player Pitfalls & Errors

### Problem 1: Browser 404 on Player Assets (`player.bundle.js` / `videobg.jpg`)
* **Cause:** Player script uses relative paths (`<base href="/stream-assets/">` or `/stream-assets/player/assets/videobg.jpg`), resolving to `localhost:5001` or VPS IP.
* **Fix:**
  1. Rewrite relative paths in player HTML to absolute CDN URLs (`https://stream.trubets365.com/stream-assets/...`).
  2. Add Express proxy fallback on your backend:
     ```javascript
     app.use("/stream-assets", async (req, res) => {
       const upstreamRes = await axios({
         method: "GET",
         url: `https://stream.trubets365.com/stream-assets${req.path}`,
         responseType: "stream"
       });
       return upstreamRes.data.pipe(res);
     });
     ```

### Problem 2: Player Stuck on "LIVE FEED TEMPORARILY RECONNECTING..."
* **Cause:** `player.bundle.js` inspects `window.location.search` for `?id=...`. If missing, it defaults to `lucky7`, looks up `http://localhost:5001/api/relay/route/lucky7` (which 404s), and fails.
* **Fix:** Inject URL history correction and settings override before scripts load:
  ```html
  <script>
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
        gameType: "${slug}",
        wsid: "${slug}",
        backgroundUrl: "https://stream.trubets365.com/stream-assets/player/assets/videobg.jpg?v=1"
      };
      Object.defineProperty(window, 'STREAM_PLAYER_SETTINGS', {
        configurable: true,
        get: function() { return _streamSettings; },
        set: function(v) { Object.assign(_streamSettings, v, { gameType: "${slug}", wsid: "${slug}" }); }
      });
    } catch (_) {}
  </script>
  ```

### Problem 3: `[Violation] Permissions policy violation: unload is not allowed in this document`
* **Cause:** Modern Chrome (v115+) deprecates `window.addEventListener('unload')`.
* **Fix:**
  1. Add header: `res.setHeader("Permissions-Policy", "unload=*");`
  2. Map `unload` to `pagehide` in runtime script:
     ```javascript
     var _origAddEvent = window.addEventListener;
     window.addEventListener = function(t, l, o) {
       if (t === 'unload') return _origAddEvent.call(this, 'pagehide', l, o);
       return _origAddEvent.call(this, t, l, o);
     };
     ```

### Problem 4: `Player error = {"code":1007,"message":"Playback suspended by external reason"}`
* **Cause:** Benign informational event emitted by NanoPlayer when switching tabs or navigating away.
* **Fix:** Filter benign code 1007 logs from `console.log` to keep console output clean.

---

## 4. Native React Frontend Integration

Embed the live video directly inside the 16:9 dealer table board with floating game HUD:

```jsx
{/* 16:9 Live Dealer Canvas */}
<div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', overflow: 'hidden' }}>
  {/* Embedded Live Stream */}
  {showLiveTv && (
    <iframe
      src={`/api/direct-stream/casino/player/${gameId}`}
      title="Live Dealer"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', zIndex: 1 }}
      allow="autoplay; fullscreen; unload"
    />
  )}

  {/* Transparent Game Overlays on top of Video (zIndex: 10) */}
  <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}>
    <span>RID: {roundId}</span>
    {/* Real-time Cards */}
  </div>

  <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
    {/* Countdown Timer */}
  </div>
</div>
```

---

## 5. VPS Deployment Checklist

1. **Relative Paths:** Ensure all iframe and API requests use relative `/api/direct-stream/...` URLs so they work seamlessly under any domain or reverse proxy.
2. **Bandwidth Offload:** The client browser connects directly to the CDN WebSocket (`wss://...`). The VPS server bandwidth is NOT consumed by video frames.
3. **No Headless Browser Needed:** Pure REST and unauthenticated WebSocket relay eliminates the need for heavy Chrome/Puppeteer/Xvfb setups.
4. **Deploy Command:**
   ```bash
   git pull origin main && npm run build --prefix frontend && pm2 restart sports-stream
   ```

