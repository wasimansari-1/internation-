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

// 4. Rotate Stealth ISP Persona
router.post("/stealth/rotate", (req, res) => {
  try {
    const persona = telemetry.rotatePersona();
    return res.json({ success: true, message: "Stealth persona rotated", persona });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Update Stealth Configuration (Auto-Rotate timer & toggle)
router.post("/stealth/config", (req, res) => {
  try {
    const { enabled, autoRotate, intervalSeconds } = req.body;
    const config = telemetry.updateStealthConfig({ enabled, autoRotate, intervalSeconds });
    return res.json({ success: true, message: "Stealth config updated", config });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Select Specific ISP Persona by ID (e.g. Jio, Airtel, ACT, Vi, etc.)
router.post("/stealth/select", (req, res) => {
  try {
    const { personaId } = req.body;
    const persona = telemetry.setPersonaById(personaId);
    return res.json({ success: true, message: `Switched to persona: ${persona.name}`, persona });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Toggle Stealth Origin Masking
router.post("/stealth/toggle", (req, res) => {
  try {
    const { enabled } = req.body;
    const config = telemetry.toggleStealthMode(enabled);
    return res.json({ success: true, message: `Stealth mode ${config.enabled ? 'enabled' : 'disabled'}`, config });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. 1-Click Apply Master Brain AI Recommendation
router.post("/brain/apply", (req, res) => {
  try {
    const rec = telemetry.brainStatus.recommendedAction;
    if (rec && rec !== "KEEP_CURRENT") {
      telemetry.setRoutingConfig({
        casinoProvider: rec,
        streamProvider: rec,
      }, "Master Brain 1-Click");
    }
    return res.json({
      success: true,
      message: `Brain recommendation applied: ${rec}`,
      routingConfig: telemetry.routingConfig,
      brainStatus: telemetry.brainStatus,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Reset Counters
router.post("/reset", (req, res) => {
  try {
    telemetry.resetCounters();
    return res.json({ success: true, message: "Telemetry counters reset" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

