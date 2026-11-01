/**
 * Casino Provider Configuration
 * Multi-Platform White-Label Architecture supporting Aura, Diamond, Exchange & Custom Operators
 */

export const casinoConfig = {
  // Global Platform Defaults
  platform: {
    defaultOperatorId: process.env.CASINO_OPERATOR_ID || "AURA_LIVE_OP",
    defaultCurrency: process.env.CASINO_CURRENCY || "INR",
    defaultLanguage: process.env.CASINO_LANG || "en",
    sessionTtlMinutes: 120, // 2 hour valid session window
  },

  // Supported Platform Profiles (Completely Isolated Operators)
  platforms: {
    standard: {
      name: "Standard Platform",
      operatorId: process.env.STANDARD_OPERATOR_ID || "standard_casino",
      apiKey: process.env.STANDARD_API_KEY || "std_secret_key",
      currency: "INR",
      whitelistedDomains: ["localhost", "127.0.0.1"],
    },
    aura: {
      name: "Aura Gaming Platform",
      operatorId: process.env.AURA_OPERATOR_ID || "AURA_OPERATOR_01",
      apiKey: process.env.AURA_API_KEY || "aura_live_secret_key",
      currency: "INR",
      whitelistedDomains: ["aura.com", "aura.casino", "localhost", "127.0.0.1"],
      seamlessWalletUrl: process.env.AURA_WALLET_URL || "http://localhost:5001/api/evolution/seamless",
    },
    diamond: {
      name: "Diamond Exchange",
      operatorId: process.env.DIAMOND_OPERATOR_ID || "DIAMOND_OPERATOR_01",
      apiKey: process.env.DIAMOND_API_KEY || "diamond_live_secret_key",
      currency: "INR",
      whitelistedDomains: ["diamond.com", "diamondexch.com", "localhost", "127.0.0.1"],
      seamlessWalletUrl: process.env.DIAMOND_WALLET_URL || "http://localhost:5001/api/evolution/seamless",
    },
  },

  // Evolution Gaming Official B2B White-Label Configuration
  evolution: {
    name: "Evolution Gaming",
    // Official Evolution ECAPI / Aggregator Session API Endpoint
    apiEndpoint: process.env.EVO_API_ENDPOINT || "https://api.evolutiongaming.com/api/ecore/v1/players/session",
    // White-Label Web Client Domain
    clientBaseUrl: process.env.EVO_CLIENT_BASE || "https://evo.wcentertainments.com/frontend/evo/r2/",
    // Gateway fallback endpoint for Aggregators (NjoyBingo, Slotegrator, SoftSwiss, etc.)
    gatewayUrl: process.env.EVO_GATEWAY_URL || "https://pi.njoybingo.com/game.do",
    defaultLaunchId: process.env.EVO_LAUNCH_ID || "18e3fd8caabecc5920123b2c",
    defaultCategory: "top_games",
    supportedCategories: ["top_games", "roulette", "blackjack", "baccarat", "game_shows", "slots"],
    // Domain Whitelisting for Embedded Iframes
    whitelistedOrigins: [
      "https://*.evolutiongaming.com",
      "https://*.wcentertainments.com",
      "http://localhost:5001",
      "http://localhost:5173",
      "http://127.0.0.1:5001",
      "http://127.0.0.1:5173",
    ],
  },

  // Ezugi Live Casino Configuration
  ezugi: {
    name: "Ezugi Live Gaming",
    gatewayUrl: process.env.EZUGI_GATEWAY_URL || "https://pi.njoybingo.com/game.do",
    clientBaseUrl: process.env.EZUGI_CLIENT_BASE || "https://pi.njoybingo.com/",
  },

  // Pragmatic Play & Platin Slots Configuration
  slots: {
    name: "Platin & Pragmatic Slots",
    sessionUrl: process.env.SLOT_SESSION_URL || "https://nice444.com/api/exchange/navigations/casino/pgSessionApi",
  },

  // Universe Indian Live Casino Configuration
  universe: {
    name: "Universe Live Casino",
    socketUrl: "https://casino.nice444.com",
    socketPath: "/universecasino",
    watchLinkUrl: "https://casino.nice444.com/casinoapp/exchange/users/streaming/casinoGameWatchLink",
    resultsUrl: "https://casino.nice444.com/casinoapp/users/casino/casinoEventResults",
    authBaseUrl: "https://casino.nice444.com/authentication",
  },
};
