import axios from "axios";
import { BaseProviderAdapter } from "./baseAdapter.js";

/**
 * Platin & Pragmatic Slots Provider Adapter
 * Resolves live game sessions and embeddable URLs for RNG Slots & Arcade games.
 */
export class PlatinSlotsAdapter extends BaseProviderAdapter {
  constructor(config = {}) {
    super("PlatinSlots", config);
    this.sessionUrl = config.sessionUrl || "https://runexch.io/v1/exchange/link/pgSessionApi";
  }

  async createSession({
    eventId,
    userId,
    userToken,
    operatorId = "t20exchange",
    rawLink = "",
  }) {
    const targetUserId = userId || `user_${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const sessionToken = userToken || this.generateSessionId("slot_user");

    let resolvedLaunchUrl = "";

    // 1. If rawLink is provided or using sessionUrl, call the session API server-side
    let targetApiUrl = "";
    if (rawLink && rawLink.includes("pgSessionApi")) {
      targetApiUrl = rawLink
        .replace("{$timestamp}", timestamp)
        .replace("{$token}", sessionToken)
        .replace("{$eventId}", encodeURIComponent(eventId))
        .replace("{domain}", "nice444.com");
    } else {
      targetApiUrl = `${this.sessionUrl}?timestamp=${timestamp}&token=${sessionToken}&gameId=${encodeURIComponent(eventId)}`;
    }

    try {
      const response = await axios.get(targetApiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Origin: "https://nice444.com",
          Referer: "https://nice444.com/",
          Authorization: `Bearer ${sessionToken}`,
        },
        timeout: 9000,
      });

      if (response.data && response.data.data) {
        resolvedLaunchUrl = typeof response.data.data === "string" ? response.data.data : response.data.data.link;
      }
    } catch (err) {
      console.warn(`[PlatinSlotsAdapter] Error calling session API: ${err.message}`);
    }

    // Fallback if session API did not return embed url
    const launchUrl = resolvedLaunchUrl || targetApiUrl;

    const expiresAt = this.registerSession(sessionToken, {
      userId: targetUserId,
      operatorId,
      eventId,
      launchUrl,
    });

    return {
      success: true,
      provider: "PLATIN",
      sessionToken,
      userId: targetUserId,
      eventId,
      launchUrl,
      expiresAt,
    };
  }
}
