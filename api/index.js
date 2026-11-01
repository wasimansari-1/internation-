import express from "express";
import app from "../backend/server.js";

export default function handler(req, res) {
  const matched = req.headers["x-matched-path"];
  if (matched && (req.url === "/api/index.js" || req.url === "/index.js" || req.url === "/api" || req.url.startsWith("/api/index.js"))) {
    req.url = matched;
  }
  return app(req, res);
}
