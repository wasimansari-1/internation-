import express from "express";
import { telemetry } from "../services/telemetryService.js";
import { getDemoToken, getStartexchToken } from "../services/authService.js";

const router = express.Router();

// 1. Get Live Metrics & Telemetry
router.get("/metrics", (req, res) => {
  try {
    const data = telemetry.getMetrics();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Update Dynamic Provider Routing (Instant live switch)
router.post("/routing", (req, res) => {
  try {
    const { casinoProvider, streamProvider, sportsProvider, changedBy } = req.body;
    const updated = telemetry.setRoutingConfig(
      { casinoProvider, streamProvider, sportsProvider },
      changedBy || "dashboard_admin",
    );
    return res.json({ success: true, message: "Routing updated successfully", routingConfig: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Trigger Active Origin Block Probe
router.post("/probe", async (req, res) => {
  try {
    const probeResults = await telemetry.probeProviders(getDemoToken, getStartexchToken);
    return res.json({ success: true, probeResults, providerHealth: telemetry.providerHealth });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Reset Counters
router.post("/reset", (req, res) => {
  try {
    telemetry.resetCounters();
    return res.json({ success: true, message: "Telemetry counters reset" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
