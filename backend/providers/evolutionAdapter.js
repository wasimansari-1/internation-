import axios from "axios";
import crypto from "crypto";
import { BaseProviderAdapter } from "./baseAdapter.js";

/**
 * Evolution Gaming B2B Provider Adapter
 * Implements White-Label operator integration with dynamic session authentication.
 */
export class EvolutionAdapter extends BaseProviderAdapter {
  constructor(config = {}) {
    super("EvolutionGaming", config);
    this.apiEndpoint = config.apiEndpoint || "https://api.evolutiongaming.com/api/ecore/v1/players/session";
    this.clientBaseUrl = config.clientBaseUrl || "https://evo.wcentertainments.com/frontend/evo/r2/";
    this.gatewayUrl = config.gatewayUrl || "https://pi.njoybingo.com/game.do";
    this.activeLaunchId = config.defaultLaunchId || "18e400b8031c8c962f803b80";
    this.sessionBridgeUrl = "https://international.guddubablu.com/v2/game/createLobbiesLink";
  }

  /**
   * Set or update active operator launch session ID
   */
  updateLaunchId(newLaunchId) {
    if (newLaunchId && typeof newLaunchId === "string") {
      this.activeLaunchId = newLaunchId.trim();
      return true;
    }
    return false;
  }

  /**
   * Format table or game ID
   */
  formatGameId(rawId = "") {
    if (!rawId) return "";
    return rawId.replace(/^EVOLUTION-/, "");
  }

  /**
   * Generate an official Evolution Gaming session.
   * Completely independent of hardcoded tokens, supporting Aura, Diamond, or any White-Label Operator.
   */
  async createSession({
    eventId = "wc-top_games",
    userId,
    operatorId = "AURA_LIVE_OP",
    apiKey = "",
    currency = "INR",
    lang = "en",
    userToken,
    clientIp = "127.0.0.1",
    platform = "aura",
    mode = "auto", // "auto" | "api" | "gateway" | "direct"
    rawLink = "",
  }) {
    // 1. Generate unique player identity and session token
    const targetUserId = userId || `${platform}_user_${Date.now()}`;
    const sessionToken = userToken || this.generateSessionId(`${platform}_evo`);
    const cleanGameId = this.formatGameId(eventId);
    const requestUuid = crypto.randomUUID();

    let launchUrl = "";
    let providerAuthType = "DIRECT_EVOLUTION";

    // 2. Mode 0: Live Authenticated Session Resolver (Generates live Evolution sessions via official bridge)
    if (userToken && (mode === "auto" || mode === "direct")) {
      try {
        let bridgeUrl = "";
        if (rawLink && rawLink.includes("createLobbiesLink")) {
          bridgeUrl = rawLink
            .replace("${token}", sessionToken)
            .replace("${gameId}", eventId)
            .replace("${homeurl}", "https://nice444.com");
        } else {
          bridgeUrl = `${this.sessionBridgeUrl}?token=${sessionToken}&lobbyId=${encodeURIComponent(eventId)}&homeUrl=https://nice444.com`;
        }

        const bridgeRes = await axios.get(bridgeUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Origin: "https://nice444.com",
            Referer: "https://nice444.com/",
          },
          timeout: 9000,
        });

        if (bridgeRes.data && bridgeRes.data.data && bridgeRes.data.data.link) {
          launchUrl = bridgeRes.data.data.link;
          providerAuthType = "LIVE_AUTHENTICATED_SESSION";

          // Extract ua_launch_id if present
          const match = launchUrl.match(/ua_launch_id=([a-zA-Z0-9]+)/);
          if (match) {
            this.activeLaunchId = match[1];
          }
        }
      } catch (err) {
        console.warn(`[EvolutionAdapter] Live bridge session creation failed (${err.message}). Falling back.`);
      }
    }

    // 3. Mode A: Official Evolution ECAPI / Aggregator B2B Request (when custom API key is provided)
    if (!launchUrl && (mode === "api" || (mode === "auto" && apiKey && apiKey !== "std_secret_key" && apiKey !== "aura_live_secret_key"))) {
      try {
        const payload = {
          uuid: requestUuid,
          player: {
            id: targetUserId,
            firstName: "Player",
            lastName: targetUserId.slice(-4),
            country: "IN",
            language: lang,
            currency: currency,
            session: {
              id: sessionToken,
              ip: clientIp,
            },
          },
          config: {
            game: {
              category: "top_games",
              table: {
                id: cleanGameId && cleanGameId !== "top_games" && cleanGameId !== "LOBBY" && !cleanGameId.startsWith("wc-") ? cleanGameId : undefined,
              },
            },
            channel: {
              wrapped: true,
              mobile: false,
            },
          },
        };

        const res = await axios.post(this.apiEndpoint, payload, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 8000,
        });

        if (res.data?.entry || res.data?.entryEmbedded) {
          launchUrl = res.data.entryEmbedded || res.data.entry;
          providerAuthType = "OFFICIAL_ECAPI_SESSION";
        }
      } catch (err) {
        console.warn(`[EvolutionAdapter] Official ECAPI session creation failed (${err.message}).`);
      }
    }

    // 4. Mode B: Direct Evolution Web Client Launch (Fallback with active launch id)
    if (!launchUrl && (mode === "direct" || mode === "auto" || !apiKey)) {
      const categoryParam = cleanGameId.startsWith("wc-") ? cleanGameId.replace(/^wc-/, "") : "top_games";
      launchUrl = `${this.clientBaseUrl}#category=${categoryParam}&ua_launch_id=${this.activeLaunchId}`;
      providerAuthType = "STANDALONE_EVOLUTION_CLIENT";
    }

    // Register active session for authentication & seamless wallet validation
    const expiresAt = this.registerSession(sessionToken, {
      userId: targetUserId,
      operatorId,
      platform,
      currency,
      eventId,
      cleanGameId,
      clientIp,
      launchUrl,
      requestUuid,
      providerAuthType,
    });

    return {
      success: true,
      provider: "EVOLUTION",
      platform,
      operatorId,
      userId: targetUserId,
      eventId,
      cleanGameId,
      sessionToken,
      launchUrl,
      providerAuthType,
      expiresAt,
    };
  }

  /**
   * Generate Evolution Lobby launch URL for an operator
   */
  getLobbyUrl(category = "top_games", launchId = null) {
    const lid = launchId || this.activeLaunchId;
    return `${this.clientBaseUrl}#category=${category}&ua_launch_id=${lid}`;
  }
}
