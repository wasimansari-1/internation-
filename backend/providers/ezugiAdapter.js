import { BaseProviderAdapter } from "./baseAdapter.js";

/**
 * Ezugi Live Gaming Provider Adapter
 */
export class EzugiAdapter extends BaseProviderAdapter {
  constructor(config = {}) {
    super("Ezugi", config);
    this.gatewayUrl = config.gatewayUrl || "https://pi.njoybingo.com/game.do";
  }

  formatGameId(rawId = "") {
    if (!rawId) return "";
    return rawId.replace(/^EZUGI-/, "");
  }

  async createSession({
    eventId,
    userId,
    operatorId = "t20exchange",
    currency = "INR",
    lang = "en",
    userToken,
    type = "CHARGED",
  }) {
    const sessionToken = userToken || this.generateSessionId("ezugi_user");
    const targetUserId = userId || `user_${Date.now()}`;
    const cleanGameId = this.formatGameId(eventId);

    const launchUrl = `${this.gatewayUrl}?token=${sessionToken}&pn=${operatorId}&lang=${lang}&game=${eventId}&type=${type}&curr=${currency}&uid=${targetUserId}`;

    const expiresAt = this.registerSession(sessionToken, {
      userId: targetUserId,
      operatorId,
      currency,
      eventId,
      cleanGameId,
      launchUrl,
    });

    return {
      success: true,
      provider: "EZUGI",
      sessionToken,
      userId: targetUserId,
      eventId,
      cleanGameId,
      launchUrl,
      expiresAt,
    };
  }
}

