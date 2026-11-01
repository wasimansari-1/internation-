import { BaseProviderAdapter } from "./baseAdapter.js";

/**
 * Universe Live Casino Provider Adapter (Indian Live Games)
 */
export class UniverseAdapter extends BaseProviderAdapter {
  constructor(config = {}) {
    super("UniverseLiveCasino", config);
    this.authBaseUrl = config.authBaseUrl || "https://casino.nice444.com/authentication";
  }

  async createSession({
    eventId,
    userId,
    userToken,
  }) {
    const sessionToken = userToken || this.generateSessionId("univ_user");
    const targetUserId = userId || `user_${Date.now()}`;

    const launchUrl = `${this.authBaseUrl}/${sessionToken}/${eventId}`;

    const expiresAt = this.registerSession(sessionToken, {
      userId: targetUserId,
      eventId,
      launchUrl,
    });

    return {
      success: true,
      provider: "UNIVERSE",
      sessionToken,
      userId: targetUserId,
      eventId,
      launchUrl,
      expiresAt,
    };
  }
}

