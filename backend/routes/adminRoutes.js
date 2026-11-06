import express from "express";
import { telemetry } from "../services/telemetryService.js";
import { getDemoToken, getStartexchToken } from "../services/authService.js";
import { domainFirewall } from "../services/domainFirewallService.js";

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

// 8. Domain Firewall: Get All Tracked Domains & Blocklist Status
router.get("/firewall/status", (req, res) => {
  try {
    const data = domainFirewall.getDashboardData();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Domain Firewall: Block Domain (Requires Password Wasim@123#)
router.post("/firewall/block", (req, res) => {
  try {
    const { domain, password } = req.body;
    if (!domain) {
      return res.status(400).json({ success: false, error: "domain is required" });
    }
    const result = domainFirewall.blockDomain(domain, password);
    return res.json(result);
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message });
  }
});

// 10. Domain Firewall: Unblock Domain (Requires Password Wasim@123#)
router.post("/firewall/unblock", (req, res) => {
  try {
    const { domain, password } = req.body;
    if (!domain) {
      return res.status(400).json({ success: false, error: "domain is required" });
    }
    const result = domainFirewall.unblockDomain(domain, password);
    return res.json(result);
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message });
  }
});

// 11. Domain Firewall: Toggle Emergency Kill-Switch (Requires Password Wasim@123#)
router.post("/firewall/kill-switch", (req, res) => {
  try {
    const { state, password } = req.body;
    const result = domainFirewall.toggleEmergencyKillSwitch(password, state);
    return res.json(result);
  } catch (err) {
    return res.status(401).json({ success: false, error: err.message });
  }
});

// 12. Upstream Origins Monitor (Check which origins are active and if blocked)
router.get("/upstreams", async (req, res) => {
  try {
    const results = await domainFirewall.probeUpstreams();
    return res.json({ success: true, timestamp: Date.now(), upstreams: results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Live Inbound Traffic Stream
router.get("/live-traffic", (req, res) => {
  try {
    return res.json({ success: true, logs: domainFirewall.liveLogs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Emergency Auth Token Force Re-login
router.post("/auth/relogin", async (req, res) => {
  try {
    const { password } = req.body;
    if (!domainFirewall.verifyPassword(password)) {
      return res.status(401).json({ success: false, error: "Invalid Administrator Password" });
    }
    const [demoToken, startexchToken] = await Promise.all([
      getDemoToken(true),
      getStartexchToken(true),
    ]);
    return res.json({
      success: true,
      message: "Upstream sessions refreshed successfully.",
      nice444Token: Boolean(demoToken),
      startexchToken: Boolean(startexchToken),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Reset Counters
router.post("/reset", (req, res) => {
  try {
    telemetry.resetCounters();
    return res.json({ success: true, message: "Telemetry counters reset" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

