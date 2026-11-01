# Nice444 Exchange API Hub & Dashboard

Full-stack application (React 18 + Node.js Express) designed to inspect, test, and view live **Sports, Match Odds, Casino Tables, and AV/Streaming APIs** directly from `https://nice444.com`.

---

## 🚀 Features

1. **⚡ Sports & Match Odds:**
   - Real-time matches for Cricket, Soccer, Tennis, Horse Racing, etc.
   - LIVE status tags, tournament names, and event IDs.
   - Modal to inspect sub-market and Fancy / Session markets (`/api/exchange/markets/fancyMarketList`).

2. **🎰 Casino Games & Tables:**
   - Filter by provider / category (ALL, Evolution, Ezugi, Universe, etc.).
   - Card grid with game thumbnails (`Point Teen Patti`, `Roulette`, `Andar Bahar`, etc.).
   - Launch link structure and room types.

3. **📺 AV & Video Streaming Tester:**
   - Test live match stream URLs (`exchEventsStreaming`).
   - Test match watch link iframe generator (`exchEventsWatchLink`).
   - Live ticker news marquee and exchange banner sliders.

4. **🧪 Raw API Tester / Debugger:**
   - 12+ pre-configured scraped endpoints ready for 1-click execution.
   - Live latency measurement in milliseconds.
   - JSON payload editor and response inspector with 1-click copy.

---

## 🛠️ How to Run

### Option 1: All-in-One (Backend + Built Frontend)
```bash
node server.js
```
Open **[http://localhost:5001](http://localhost:5001)** in your browser.

### Option 2: Frontend Development Mode (Hot Reload)
```bash
# Terminal 1: Backend proxy
node server.js

# Terminal 2: React Vite Dev Server
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

