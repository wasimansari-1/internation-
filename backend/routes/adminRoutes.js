import express from "express";
import { telemetry } from "../services/telemetryService.js";
import { getDemoToken, getStartexchToken, getCbtfToken, getAsstarplayToken } from "../services/authService.js";
import { securityService } from "../services/securityService.js";
import { requireAdminAuth } from "../middleware/securityMiddleware.js";

const router = express.Router();

// =========================================================================
// 1. Admin Authentication Endpoints (OAuth / Credentials Guard)
// Credentials: Id: Igwasim, Password: Asdf123
// =========================================================================
router.post("/auth/login", (req, res) => {
  try {
    const { username, id, password } = req.body || {};
    const adminUser = username || id || "";
    const result = securityService.loginAdmin(adminUser, password);

    if (!result.success) {
      return res.status(401).json(result);
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/auth/verify", (req, res) => {
  const token = req.headers["authorization"] || req.headers["x-admin-token"];
  const isValid = securityService.verifyAdminToken(token);
  return res.json({
    success: true,
    authenticated: isValid,
    admin: isValid ? { id: "Igwasim", role: "SuperAdmin" } : null,
  });
});

router.post("/auth/logout", (req, res) => {
  const token = req.headers["authorization"] || req.headers["x-admin-token"];
  securityService.logoutAdmin(token);
  return res.json({ success: true, message: "Logged out successfully" });
});

// =========================================================================
// Apply Admin Authorization Middleware to all endpoints below
// =========================================================================
router.use(requireAdminAuth);

// =========================================================================
// 2. IP Whitelisting & Threat Intelligence Endpoints
// =========================================================================
router.get("/security/overview", (req, res) => {
  try {
    const overview = securityService.getSecurityOverview();
    return res.json({ success: true, data: overview });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/security/whitelist/add", (req, res) => {
  try {
    const { ip, partnerName, domain, scope, rateLimit } = req.body || {};
    if (!ip) {
      return res.status(400).json({ success: false, error: "IP address is required." });
    }
    const partner = securityService.addWhitelistedIp({ ip, partnerName, domain, scope, rateLimit });
    return res.json({ success: true, message: `IP ${partner.ip} whitelisted successfully`, partner });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/security/whitelist/remove", (req, res) => {
  try {
    const { ip } = req.body || {};
    if (!ip) {
      return res.status(400).json({ success: false, error: "IP address is required." });
    }
    const removed = securityService.removeWhitelistedIp(ip);
    return res.json({ success: true, message: removed ? `IP ${ip} removed from whitelist` : "IP not found" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/security/whitelist/toggle", (req, res) => {
  try {
    const { ip, status } = req.body || {};
    if (!ip) {
      return res.status(400).json({ success: false, error: "IP address is required." });
    }
    const updated = securityService.toggleWhitelistedIp(ip, status);
    return res.json({ success: true, message: `IP ${ip} status updated to ${updated.status}`, partner: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/security/config", (req, res) => {
  try {
    const { strictMode, payloadEncryption, internalBypass, rateLimitPerMinute } = req.body || {};
    const config = securityService.updateFirewallConfig({
      ...(strictMode !== undefined && { strictMode: Boolean(strictMode) }),
      ...(payloadEncryption !== undefined && { payloadEncryption: Boolean(payloadEncryption) }),
      ...(internalBypass !== undefined && { internalBypass: Boolean(internalBypass) }),
      ...(rateLimitPerMinute !== undefined && { rateLimitPerMinute: Number(rateLimitPerMinute) }),
    });
    return res.json({ success: true, message: "Firewall configuration updated", config });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Scoreboard & Casino Results Whitelist Endpoints
router.get("/security/scoreboard-whitelist", (req, res) => {
  try {
    return res.json({
      success: true,
      config: securityService.resultsScoreboardConfig,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/security/scoreboard-whitelist/add", (req, res) => {
  try {
    const { domain } = req.body || {};
    if (!domain) {
      return res.status(400).json({ success: false, error: "Domain or URL is required." });
    }
    const updated = securityService.addScoreboardDomain(domain);
    return res.json({
      success: true,
      message: `"${domain}" successfully whitelisted for Scoreboard & Casino Results`,
      config: updated,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/security/scoreboard-whitelist/remove", (req, res) => {
  try {
    const { domain } = req.body || {};
    if (!domain) {
      return res.status(400).json({ success: false, error: "Domain is required." });
    }
    const updated = securityService.removeScoreboardDomain(domain);
    return res.json({
      success: true,
      message: `"${domain}" removed from Scoreboard & Results whitelist`,
      config: updated,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/security/scoreboard-whitelist/toggle-direct", (req, res) => {
  try {
    const { allowDirectUrlHits } = req.body || {};
    const updated = securityService.toggleScoreboardDirectHits(allowDirectUrlHits);
    return res.json({
      success: true,
      message: `Direct URL hits for Scoreboard & Results ${updated.allowDirectUrlHits ? "ENABLED" : "DISABLED"}`,
      config: updated,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 3. Existing Gateway Telemetry & Mesh Management Endpoints
// =========================================================================
router.get("/metrics", (req, res) => {
  try {
    const data = telemetry.getMetrics();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

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

router.post("/probe", async (req, res) => {
  try {
    const probeResults = await telemetry.probeProviders(getDemoToken, getStartexchToken, getCbtfToken, getAsstarplayToken);
    return res.json({ success: true, probeResults, providerHealth: telemetry.providerHealth });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/stealth/rotate", (req, res) => {
  try {
    const persona = telemetry.rotatePersona();
    return res.json({ success: true, message: "Stealth persona rotated", persona });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/stealth/config", (req, res) => {
  try {
    const { enabled, autoRotate, intervalSeconds } = req.body;
    const config = telemetry.updateStealthConfig({ enabled, autoRotate, intervalSeconds });
    return res.json({ success: true, message: "Stealth config updated", config });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/stealth/select", (req, res) => {
  try {
    const { personaId } = req.body;
    const persona = telemetry.setPersonaById(personaId);
    return res.json({ success: true, message: `Switched to persona: ${persona.name}`, persona });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/stealth/toggle", (req, res) => {
  try {
    const { enabled } = req.body;
    const config = telemetry.toggleStealthMode(enabled);
    return res.json({ success: true, message: `Stealth mode ${config.enabled ? 'enabled' : 'disabled'}`, config });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

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

router.post("/reset", (req, res) => {
  try {
    telemetry.resetCounters();
    return res.json({ success: true, message: "Telemetry counters reset" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
