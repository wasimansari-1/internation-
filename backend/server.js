import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

import sportsRouter from "./routes/sportsRoutes.js";
import casinoRouter from "./routes/casinoRoutes.js";
import streamRouter from "./routes/streamRoutes.js";
import { proxyRequest } from "./services/authService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const app = express();
const PORT = process.env.PORT || 5001;

// CORS setup
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Range"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging in development/debug
app.use((req, res, next) => {
  if (process.env.DEBUG || (req.path.startsWith("/api/") && !req.path.includes("live-odds") && !req.path.includes("live-rates"))) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Mount modular sub-routers
app.use("/api/sports", sportsRouter);
app.use("/api/casino", casinoRouter);
app.use("/api/stream", streamRouter);

// News ticker API
app.get("/api/media/news", async (req, res) => {
  const result = await proxyRequest("/api/exchange/news/exchangeNews");
  res.status(result.statusCode).json(result);
});

// Evolution Seamless Wallet Routes
app.post("/api/evolution/seamless/auth", (req, res) => {
  const { sid, uuid } = req.body || {};
  console.log(`[Evolution Wallet Auth] Validating session token: ${sid}`);
  res.json({
    status: "OK",
    sid: sid || "valid_session",
    uuid: uuid || crypto.randomUUID(),
    balance: 50000.0,
    currency: "INR",
  });
});

app.post("/api/evolution/seamless/balance", (req, res) => {
  const { sid, uuid } = req.body || {};
  res.json({
    status: "OK",
    sid: sid,
    uuid: uuid,
    balance: 50000.0,
    currency: "INR",
  });
});

app.post("/api/evolution/seamless/debit", (req, res) => {
  const { sid, transaction, uuid } = req.body || {};
  console.log(`[Evolution Wallet Debit] Bet placed:`, transaction);
  res.json({
    status: "OK",
    sid: sid,
    uuid: uuid,
    balance: 49900.0,
    currency: "INR",
  });
});

app.post("/api/evolution/seamless/credit", (req, res) => {
  const { sid, transaction, uuid } = req.body || {};
  console.log(`[Evolution Wallet Credit] Win credited:`, transaction);
  res.json({
    status: "OK",
    sid: sid,
    uuid: uuid,
    balance: 51800.0,
    currency: "INR",
  });
});

// Serve frontend dist static assets
const candidateDistPaths = [
  path.join(projectRoot, "frontend", "dist"),
  path.join(projectRoot, "dist"),
  path.join(__dirname, "dist"),
];

let distPath = candidateDistPaths.find((p) => fs.existsSync(p)) || candidateDistPaths[0];

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get("/", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.sendFile(indexPath);
  }
  res.json({
    status: "online",
    service: "Sports & Casino Backend API",
    version: "2.0.0 (Modular Architecture)",
    time: new Date().toISOString(),
  });
});

app.get("/assets/:file", (req, res) => {
  const filePath = path.join(distPath, "assets", req.params.file);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  const assetsDir = path.join(distPath, "assets");
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    if (req.params.file.endsWith(".js")) {
      const fallbackJs = files.find(
        (f) => f.startsWith("index-") && f.endsWith(".js"),
      );
      if (fallbackJs) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        return res.sendFile(path.join(assetsDir, fallbackJs));
      }
    }
    if (req.params.file.endsWith(".css")) {
      const fallbackCss = files.find(
        (f) => f.startsWith("index-") && f.endsWith(".css"),
      );
      if (fallbackCss) {
        res.setHeader("Content-Type", "text/css; charset=utf-8");
        return res.sendFile(path.join(assetsDir, fallbackCss));
      }
    }
  }
  return res.status(404).send("File Not Found");
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (
    req.path.startsWith("/assets/") ||
    req.path.endsWith(".js") ||
    req.path.endsWith(".css") ||
    req.path.endsWith(".ico") ||
    req.path.endsWith(".png") ||
    req.path.endsWith(".jpg")
  ) {
    return res.status(404).send("File Not Found");
  }
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.sendFile(indexPath);
  }
  res.status(404).json({ error: "Route not found" });
});

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Modular Backend Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
