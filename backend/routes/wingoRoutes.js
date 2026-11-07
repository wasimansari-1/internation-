import express from "express";
import { getGameInfo, getGameHistory, placeWinGoBet, WINGO_GAMES } from "../services/wingoService.js";

const router = express.Router();

// Supported games
router.get("/games", (req, res) => {
  res.json({ success: true, games: WINGO_GAMES });
});

// Current game info & countdown
router.get("/info", async (req, res) => {
  const gameCode = req.query.gameCode || "WinGo_30S";
  const result = await getGameInfo(gameCode);
  res.json(result);
});

// Issue history
router.get("/history", async (req, res) => {
  const gameCode = req.query.gameCode || "WinGo_30S";
  const result = await getGameHistory(gameCode);
  res.json(result);
});

// Single unified live state (Info + History combined)
router.get("/live", async (req, res) => {
  const gameCode = req.query.gameCode || "WinGo_30S";
  const [info, history] = await Promise.all([
    getGameInfo(gameCode),
    getGameHistory(gameCode)
  ]);

  res.json({
    success: info.success && history.success,
    gameCode,
    current: info.current,
    previous: info.previous,
    remainingSeconds: info.remainingSeconds,
    history: history.list || []
  });
});

// Bet placement
router.post("/bet", async (req, res) => {
  const { gameCode, issueNumber, amount, betMultiple, betContent, token } = req.body;
  if (!gameCode || !issueNumber || !amount || !betContent) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: gameCode, issueNumber, amount, betContent"
    });
  }

  const result = await placeWinGoBet({
    gameCode,
    issueNumber,
    amount,
    betMultiple,
    betContent,
    token
  });
  res.json(result);
});

export default router;

