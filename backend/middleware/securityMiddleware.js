import { securityService } from "../services/securityService.js";

/**
 * Enterprise IP Whitelist & Firewall Guard Middleware
 * Validates real client IP against the authorized whitelist and partner API keys.
 */
export const ipWhitelistGuard = (req, res, next) => {
  const p = req.path || "";

  // 1. Bypass public static assets, favicon, frontend pages, authentication endpoints, and UI iframe frames
  if (
    p.startsWith("/assets") ||
    p.startsWith("/stream-assets") ||
    p.startsWith("/player") ||
    p.endsWith(".js") ||
    p.endsWith(".css") ||
    p.endsWith(".png") ||
    p.endsWith(".jpg") ||
    p.endsWith(".ico") ||
    p.endsWith(".svg") ||
    p === "/" ||
    p === "/admin" ||
    p === "/sports" ||
    p === "/docs" ||
    p === "/wingo" ||
    p.includes("/scoreboard-frame") ||
    p.includes("/embed") ||
    p.includes("/stream-proxy") ||
    p.startsWith("/api/auth/client-login") ||
    p.startsWith("/api/auth/client-verify") ||
    p.startsWith("/api/auth/client-logout") ||
    p.startsWith("/api/admin/auth/login") ||
    p.startsWith("/api/admin/auth/verify")
  ) {
    return next();
  }

  // 2. Block Direct Browser Document Navigation to Raw Data APIs
  // Prevents unauthorized users from pasting API URLs directly into Chrome address bar
  const isHtmlFrame =
    p.includes("/scoreboard-frame") ||
    p.includes("/embed") ||
    p.includes("/player") ||
    p.includes("/stream-proxy");

  const clientIp = securityService.extractRealClientIp(req);
  const isWhitelistedIp =
    securityService.whitelist.has(clientIp) &&
    securityService.whitelist.get(clientIp).status === "ACTIVE";

  // Scoreboard and Casino Results endpoints:
  const isScoreboardOrResult =
    p.includes("/score") ||
    p.includes("/scoreboard-frame") ||
    p.includes("/casino/results") ||
    p.includes("/casino/result") ||
    p.includes("/casino/latest-result");

  const isDirectBrowserDocNav =
    !isHtmlFrame &&
    (req.headers["sec-fetch-dest"] === "document" ||
      req.headers["sec-fetch-mode"] === "navigate" ||
      (req.headers["accept"] && req.headers["accept"].includes("text/html"))) &&
    !req.headers["x-requested-with"];

  const isRawDataEndpoint =
    !isHtmlFrame &&
    (p.startsWith("/api/casino/live-odds") ||
      p.startsWith("/api/casino/tables") ||
      p.startsWith("/api/casino/results") ||
      p.startsWith("/api/sports/live-rates") ||
      p.startsWith("/api/sports/events") ||
      p.startsWith("/api/sports/all-events") ||
      p.startsWith("/api/sports/markets") ||
      p.startsWith("/api/sports/list") ||
      p.startsWith("/ori/api/sports") ||
      p.startsWith("/api/stream/watch-link"));

  // If request is from a whitelisted IP (e.g. Igmaster1, Igmaster2, Igmaster3),
  // direct URL access for Scoreboard and Casino Results is allowed directly!
  if (isWhitelistedIp && isScoreboardOrResult) {
    // Whitelisted IP direct pass-through granted
  } else if (isDirectBrowserDocNav && isRawDataEndpoint) {
    return res.status(403).json({
      success: false,
      error: "Direct browser URL navigation is restricted. Protected API requires authenticated client session or API key.",
      code: "ERR_DIRECT_ACCESS_RESTRICTED",
      clientIp,
      documentation: "/docs",
    });
  }

  // 3. Check IP Whitelist & Session / Partner Authorization
  const auth = securityService.checkAuthorization(req);

  if (!auth.authorized) {
    return res.status(403).json({
      success: false,
      error: "Access Denied: Your IP address is not authorized to access this API.",
      code: "ERR_IP_NOT_WHITELISTED",
      clientIp: auth.clientIp,
      contact: "Contact System Administrator to whitelist your server IP address.",
      documentation: "/docs",
    });
  }

  req.partner = auth.partner || null;
  req.clientIp = auth.clientIp;

  // 4. Diamond-Style Payload Encryption Interceptor
  // Encrypts outgoing response payload when requested by partner or via encryption headers
  const wantsEncryption =
    req.headers["x-payload-encryption"] === "aes-256" ||
    req.headers["x-payload-encryption"] === "true" ||
    req.query.encrypt === "true" ||
    (Boolean(req.headers["x-api-key"]) && securityService.firewallConfig.payloadEncryption);

  if (wantsEncryption && !isHtmlFrame) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Don't re-encrypt if already encrypted or error/string
      if (!body || body.enc === true || body.success === false) {
        return originalJson(body);
      }
      const secret = req.partner?.apiSecret || undefined;
      const encrypted = securityService.encryptPayload(body, secret);
      return originalJson(encrypted);
    };
  }

  next();
};

/**
 * Enterprise Admin Authentication Middleware
 * Strictly guards `/api/admin/*` routes with cryptographic session token
 */
export const requireAdminAuth = (req, res, next) => {
  // Public admin auth check endpoints
  if (req.path === "/auth/login" || req.path === "/auth/verify") {
    return next();
  }

  const token =
    req.headers["authorization"] ||
    req.headers["x-admin-token"] ||
    req.query.adminToken;

  if (!token || !securityService.verifyAdminToken(token)) {
    return res.status(401).json({
      success: false,
      error: "Admin Authorization Required. Please sign in with valid credentials.",
      code: "ERR_ADMIN_AUTH_REQUIRED",
    });
  }

  next();
};

