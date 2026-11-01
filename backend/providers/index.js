import { casinoConfig } from "../config/casinoConfig.js";
import { EvolutionAdapter } from "./evolutionAdapter.js";
import { EzugiAdapter } from "./ezugiAdapter.js";
import { PlatinSlotsAdapter } from "./platinAdapter.js";
import { UniverseAdapter } from "./universeAdapter.js";

/**
 * Central Casino Provider Manager
 * Multi-Platform Provider Router for Evolution, Ezugi, Platin & Universe
 */
class ProviderManager {
  constructor() {
    this.evolution = new EvolutionAdapter(casinoConfig.evolution);
    this.ezugi = new EzugiAdapter(casinoConfig.ezugi);
    this.platin = new PlatinSlotsAdapter(casinoConfig.slots);
    this.universe = new UniverseAdapter(casinoConfig.universe);

    // Periodically prune stale session cache every 15 minutes
    setInterval(() => {
      this.evolution.cleanupExpiredSessions();
      this.ezugi.cleanupExpiredSessions();
      this.platin.cleanupExpiredSessions();
      this.universe.cleanupExpiredSessions();
    }, 15 * 60 * 1000);
  }

  /**
   * Determine the appropriate provider adapter for an event
   */
  resolveProvider(eventId = "", companyName = "", explicitProvider = "") {
    const prov = (explicitProvider || "").toUpperCase();
    const comp = (companyName || "").toUpperCase();
    const id = String(eventId).toUpperCase();

    if (
      prov === "EVOLUTION" ||
      comp === "INTERNATIONAL" ||
      comp === "TLTC" ||
      id.startsWith("EVOLUTION") ||
      id.startsWith("WC-")
    ) {
      return "EVOLUTION";
    }
    if (prov === "EZUGI" || id.startsWith("EZUGI")) {
      return "EZUGI";
    }
    if (prov === "PLATIN" || prov === "SLOTS" || comp === "PLATIN" || id.startsWith("PLATIN")) {
      return "PLATIN";
    }
    return "UNIVERSE";
  }

  /**
   * Launch a game across any provider with dynamic user authentication
   */
  async launchGame({
    eventId,
    companyName,
    provider,
    userId,
    userToken,
    platform = "standard",
    operatorId,
    currency,
    lang,
    clientIp = "127.0.0.1",
    type,
    mode = "auto",
    rawLink = "",
  }) {
    const resolvedProvider = this.resolveProvider(eventId, companyName, provider);

    // Resolve platform operator configuration (e.g. Aura, Diamond, Standard)
    const platformConfig = casinoConfig.platforms[platform.toLowerCase()] || casinoConfig.platforms.standard;
    const finalOperatorId = operatorId || platformConfig.operatorId || casinoConfig.platform.defaultOperatorId;
    const finalApiKey = platformConfig.apiKey || "";
    const finalCurrency = currency || platformConfig.currency || casinoConfig.platform.defaultCurrency;
    const finalLang = lang || casinoConfig.platform.defaultLanguage;

    const sessionParams = {
      eventId,
      userId,
      userToken,
      platform: platform.toLowerCase(),
      operatorId: finalOperatorId,
      apiKey: finalApiKey,
      currency: finalCurrency,
      lang: finalLang,
      clientIp,
      type: type || "CHARGED",
      mode: mode || "auto",
      rawLink,
    };

    switch (resolvedProvider) {
      case "EVOLUTION":
        return await this.evolution.createSession(sessionParams);
      case "EZUGI":
        return await this.ezugi.createSession(sessionParams);
      case "PLATIN":
        return await this.platin.createSession(sessionParams);
      case "UNIVERSE":
      default:
        return await this.universe.createSession(sessionParams);
    }
  }

  /**
   * Directly update Evolution launch ID from newly captured session
   */
  updateEvolutionLaunchId(launchId) {
    return this.evolution.updateLaunchId(launchId);
  }

  /**
   * Get direct Evolution lobby link
   */
  getEvolutionLobbyUrl(category = "top_games") {
    return this.evolution.getLobbyUrl(category);
  }
}

export const providerManager = new ProviderManager();
