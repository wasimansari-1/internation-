import React, { useState, useEffect } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import axios from "axios";
import CustomCasinoGameView from "./CustomCasinoGameView";

export const ALLOWED_CASINO_IDS = [
  "99.0010", // 20-20 TEENPATTI
  "99.0030", // LUCKY 7
  "99.0013", // 1 DAY TEENPATTI
  "99.0016", // JOKER TEEN PATTI
  "99.0019", // DRAGON TIGER
  "99.0001", // BACCARAT
  "99.0025", // ANDAR BAHAR
  "99.0022", // 32 CARDS
  "99.0007", // POKER
  "99.0041", // DTL
  "99.0021", // 1 DAY DRAGON TIGER
  "99.0014", // MUFLIS TEEN PATTI
  "99.0046", // CARD RACE
  "99.0005", // AMAR AKBAR ANTHONY
  "99.0018", // DRAGON TIGER
];

export const TABLE_METADATA = {
  "99.0010": { name: "20-20 TEENPATTI", image: "/20-20teenpatti.jpg" },
  "99.0030": { name: "LUCKY 7", image: "/Lucky-7.jpg" },
  99.0013: { name: "1 DAY TEENPATTI", image: "/1Dayteenpatti.jpg" },
  99.0016: { name: "JOKER TEENPATTI", image: "/Jokerteenpatti.jpg" },
  99.0019: { name: "DRAGON TIGER", image: "/Dragontiger.jpg" },
  99.0001: { name: "BACCARAT", image: "/Baccarat.jpg" },
  99.0025: { name: "ANDAR BAHAR", image: "/AndarBahar.jpg" },
  99.0022: { name: "32 CARDS", image: "/32cards.jpg" },
  99.0007: { name: "POKER", image: "/Poker.jpg" },
  99.0041: { name: "DTL", image: "/DTL.jpg" },
  99.0021: { name: "1 DAY DRAGON TIGER", image: "/1DayDragontiger.jpg" },
  99.0014: { name: "MUFLIS TEENPATTI", image: "/muflisteenpatti-01.jpg" },
  99.0046: { name: "CARD RACE", image: "/CardRace.jpg" },
  99.0005: { name: "AMAR AKBAR ANTHONY", image: "/AmarAkbarAnthony-01.jpg" },
  99.0018: { name: "DRAGON TIGER", image: "/dragon-tiger-01.jpg" },
};

export default function UniverseGamesView() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Universe Live");

  // Persistent active casino game table across page reloads.
  const [activeGame, setActiveGame] = useState(() => {
    try {
      const search = new URLSearchParams(window.location.search);
      const tableId = search.get("table");
      const saved = sessionStorage.getItem("active_casino_game");

      if (saved) {
        const parsed = JSON.parse(saved);

        if (tableId && String(parsed.eventId) === String(tableId)) {
          return parsed;
        }

        if (!tableId && parsed) {
          return parsed;
        }
      }

      if (tableId) {
        const meta = TABLE_METADATA[tableId];
        return {
          eventId: tableId,
          eventName: meta?.name || `CASINO ${tableId}`,
          image: meta?.image || "/Lucky-7.jpg",
        };
      }
    } catch (error) {
      // Ignore unavailable browser storage or malformed saved data.
    }

    return null;
  });

  // Open game and persist the selected table in the URL and session storage.
  const handleOpenGame = (game) => {
    setActiveGame(game);

    try {
      sessionStorage.setItem("active_casino_game", JSON.stringify(game));
      const url = new URL(window.location.href);
      url.searchParams.set("table", game.eventId);
      window.history.replaceState(null, "", url.toString());
    } catch (error) {
      // The game can still open if browser storage is unavailable.
    }
  };

  // Close game and clear its persisted selection.
  const handleCloseGame = () => {
    setActiveGame(null);

    try {
      sessionStorage.removeItem("active_casino_game");
      const url = new URL(window.location.href);
      url.searchParams.delete("table");
      window.history.replaceState(null, "", url.toString());
    } catch (error) {
      // Ignore unavailable browser storage or history APIs.
    }
  };

  // Fetch real Universe Casino tables.
  const fetchTables = async () => {
    try {
      setLoading(true);
      const res = await axios.post("/api/casino/tables", { id: 110 });
      const list = res.data?.data?.data || res.data?.data || [];

      if (Array.isArray(list)) {
        // Filter strictly to allowed casino tables.
        const filtered = list
          .filter((table) => ALLOWED_CASINO_IDS.includes(String(table.eventId)))
          .map((table) => {
            const meta = TABLE_METADATA[String(table.eventId)] || {};

            return {
              ...table,
              eventName:
                meta.name ||
                String(table.eventName || "")
                  .replace(/\s*-\s*[A-Z0-9]+$/g, "")
                  .trim(),
              image: meta.image || table.image || "/Lucky-7.jpg",
            };
          });

        // Preserve the exact order defined in ALLOWED_CASINO_IDS.
        filtered.sort((a, b) => {
          return (
            ALLOWED_CASINO_IDS.indexOf(String(a.eventId)) -
            ALLOWED_CASINO_IDS.indexOf(String(b.eventId))
          );
        });

        setTables(filtered);
      }
    } catch (error) {
      console.error("Error fetching real casino tables:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // Filter tables by search query.
  const displayList = tables.filter((game) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      (game.eventName || "").toLowerCase().includes(query) ||
      String(game.eventId || "")
        .toLowerCase()
        .includes(query)
    );
  });

  const categories = [
    "Universe Live",
    "Popular",
    "Universe Original",
    "International",
  ];

  return (
    <div className="universe-games-page">
      <style>{`
        .universe-games-page {
          width: 75%;
          max-width: 1140px;
          margin: 0 auto;
          padding: 24px 16px;
          box-sizing: border-box;
          color: #1e261f;
        }

        .universe-games-toolbar {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 16px 20px;
          margin-bottom: 22px;
          padding-bottom: 16px;
          border-bottom: 1.5px solid #cad7c3;
        }

        .universe-games-categories {
          display: flex;
          flex: 1 1 600px;
          min-width: 0;
          align-items: center;
          gap: 10px;
          overflow-x: auto;
          padding: 3px 2px 6px;
          scrollbar-width: thin;
          scrollbar-color: #cad7c3 transparent;
        }

        .universe-category-btn {
          flex: 0 0 auto;
          border: 1.5px solid #9CAF88;
          border-radius: 999px;
          padding: 8px 18px;
          background: #FFFFFF;
          color: #1e261f;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.2;
          white-space: nowrap;
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease,
            transform 160ms ease;
        }

        .universe-category-btn:hover {
          border-color: #9CAF88;
          background: #e3ebd9;
          color: #1e261f;
          transform: translateY(-1px);
        }

        .universe-category-btn.is-active {
          border-color: #E8412C;
          background: #E8412C;
          color: #FFFFFF;
          box-shadow: 0 4px 14px rgba(232, 65, 44, 0.28);
        }

        .universe-games-search {
          display: flex;
          flex: 0 1 290px;
          min-width: 200px;
          align-items: center;
          gap: 10px;
          box-sizing: border-box;
          min-height: 40px;
          padding: 0 14px;
          border: 1.5px solid #9CAF88;
          border-radius: 999px;
          background: #FFFFFF;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .universe-games-search:focus-within {
          border-color: #E8412C;
          box-shadow: 0 0 0 3px rgba(232, 65, 44, 0.12);
        }

        .universe-games-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #1e261f;
          font-size: 13px;
        }

        .universe-games-search input::placeholder {
          color: #748373;
        }

        .universe-games-clear {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          padding: 3px;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #748373;
          cursor: pointer;
        }

        .universe-games-clear:hover {
          background: #e3ebd9;
          color: #1e261f;
        }

        /* Exactly 5 large cards per row on PC Desktop */
        .universe-games-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
          align-items: stretch;
        }

        .universe-game-card {
          position: relative;
          display: block;
          width: 100%;
          min-width: 0;
          aspect-ratio: 1 / 1.05;
          overflow: hidden;
          padding: 0;
          border: 1.5px solid #cad7c3;
          border-radius: 14px;
          outline: none;
          background: #FFFFFF;
          box-shadow: 0 4px 14px rgba(30, 38, 31, 0.08);
          cursor: pointer;
          isolation: isolate;
          transition: transform 180ms ease, border-color 180ms ease,
            box-shadow 180ms ease;
        }

        .universe-game-card:hover,
        .universe-game-card:focus-visible {
          z-index: 1;
          transform: translateY(-4px);
          border-color: #E8412C;
          box-shadow: 0 10px 26px rgba(232, 65, 44, 0.22);
        }

        .universe-game-card img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 260ms ease;
        }

        .universe-game-card:hover img {
          transform: scale(1.035);
        }

        .universe-games-loading,
        .universe-games-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #94a3b8;
        }

        .universe-games-loading {
          min-height: 360px;
          gap: 12px;
        }

        .universe-games-loading p {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .universe-games-empty {
          min-height: 280px;
          font-size: 14px;
        }

        .universe-games-empty p {
          margin: 0;
        }

        .universe-games-spinner {
          animation: universe-games-spin 1s linear infinite;
        }

        @keyframes universe-games-spin {
          to { transform: rotate(360deg); }
        }

        /* Tablet (769px - 1080px) */
        @media (max-width: 1080px) {
          .universe-games-page {
            width: 90%;
            max-width: 100%;
            padding: 20px 14px;
          }

          .universe-games-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
        }

        /* Mobile Phone Screens (down to 300px) -> Exactly 2 cards per row & hide toolbar */
        @media (max-width: 768px) {
          .universe-games-page {
            width: 100%;
            padding: 18px 16px;
          }

          /* Hide category pills and search bar on phone (Image 1) */
          .universe-games-toolbar {
            display: none !important;
          }

          /* Exactly 2 cards per row on phone screens down to 300px (Image 2) */
          .universe-games-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }

          .universe-game-card {
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          }
        }

        /* Small mobile screens (300px - 360px) */
        @media (max-width: 360px) {
          .universe-games-page {
            padding: 14px 12px;
          }

          .universe-games-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .universe-game-card {
            border-radius: 10px;
          }
        }
      `}</style>

      {/* Hero Section matching reference Image 1 */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            color: "#9CAF88",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            marginBottom: "6px",
          }}
        >
          TABLES
        </div>
        <h1
          style={{
            fontSize: "clamp(24px, 4vw, 32px)",
            fontWeight: 900,
            color: "#1e261f",
            letterSpacing: "-0.5px",
            textTransform: "uppercase",
            margin: "0 0 8px 0",
          }}
        >
          UNIVERSE LIVE
        </h1>
        <p
          style={{
            fontSize: "13.5px",
            color: "#4e5a4d",
            margin: 0,
            lineHeight: 1.5,
            maxWidth: "600px",
          }}
        >
          {tables.length || 15} live tables. Open a game for the round clock, markets, and results.
        </p>
      </div>

      {/* Category navigation and search. */}
      <div className="universe-games-toolbar">
        <div className="universe-games-categories">
          <button
            type="button"
            onClick={() => setActiveCategory("Universe Live")}
            className={`universe-category-btn${activeCategory === "Universe Live" ? " is-active" : ""}`}
          >
            {tables.length || 15} GAMES
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("IN PLAY")}
            className={`universe-category-btn${activeCategory === "IN PLAY" ? " is-active" : ""}`}
          >
            IN PLAY
          </button>
          {categories
            .filter((c) => c !== "Universe Live")
            .map((category) => {
              const isActive = activeCategory === category;

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`universe-category-btn${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                >
                  {category}
                </button>
              );
            })}
        </div>

        <div className="universe-games-search">
          <Search size={16} color="#8493a8" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search table..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search casino tables"
          />
          {searchQuery && (
            <button
              type="button"
              className="universe-games-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Universe Live Casino tables. */}
      {loading ? (
        <div className="universe-games-loading">
          <RefreshCw
            size={28}
            className="universe-games-spinner"
            color="#10b981"
            aria-hidden="true"
          />
          <p>Loading tables...</p>
        </div>
      ) : displayList.length === 0 ? (
        <div className="universe-games-empty">
          <p>No tables found matching &quot;{searchQuery}&quot;.</p>
        </div>
      ) : (
        <div className="universe-games-grid">
          {displayList.map((game, index) => {
            const displayImage = game.image || "/Lucky-7.jpg";

            return (
              <div
                key={game.eventId || index}
                className="universe-game-card"
                onClick={() => handleOpenGame(game)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenGame(game);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${game.eventName || "casino table"}`}
              >
                {/* Original artwork image; no extra overlay text or badges. */}
                <img
                  src={displayImage}
                  alt={game.eventName || "Casino table"}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Native Universe Casino game modal. */}
      {activeGame && (
        <CustomCasinoGameView
          gameId={activeGame.eventId || "99.0010"}
          gameName={activeGame.eventName}
          onClose={handleCloseGame}
        />
      )}
    </div>
  );
}
