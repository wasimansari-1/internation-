import crypto from "crypto";

/**
 * Base Casino Provider Adapter
 * All specific provider adapters (Evolution, Ezugi, Platin, Universe) inherit from this.
 */
export class BaseProviderAdapter {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.activeSessions = new Map(); // token -> session details
  }

  /**
   * Generates a unique, dynamic user session identifier
   */
  generateSessionId(prefix = "sess") {
    const randomHex = crypto.randomBytes(12).toString("hex");
    return `${prefix}_${Date.now()}_${randomHex}`;
  }

  /**
   * Create or fetch a dynamic session for game launch
   * Must be overridden by subclasses.
   */
  async createSession(params) {
    throw new Error(`createSession not implemented in ${this.name}`);
  }

  /**
   * Validates if a session token is active and not expired
   */
  validateSession(sessionToken) {
    if (!sessionToken) return false;
    const session = this.activeSessions.get(sessionToken);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.activeSessions.delete(sessionToken);
      return false;
    }
    return true;
  }

  /**
   * Store active session in memory cache
   */
  registerSession(sessionToken, sessionData, ttlMinutes = 120) {
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    this.activeSessions.set(sessionToken, {
      ...sessionData,
      createdAt: Date.now(),
      expiresAt,
    });
    return expiresAt;
  }

  /**
   * Remove expired sessions periodically
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [token, data] of this.activeSessions.entries()) {
      if (now > data.expiresAt) {
        this.activeSessions.delete(token);
      }
    }
  }
}

