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
          color: #e2e8f0;
        }

        .universe-games-toolbar {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 16px 20px;
          margin-bottom: 22px;
          padding-bottom: 16px;
          border-bottom: 1px solid #1e293b;
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
          scrollbar-color: #334155 transparent;
        }

        .universe-category-btn {
          flex: 0 0 auto;
          border: 1px solid #263449;
          border-radius: 999px;
          padding: 8px 18px;
          background: #101827;
          color: #a8b5c7;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.2;
          white-space: nowrap;
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease,
            transform 160ms ease;
        }

        .universe-category-btn:hover {
          border-color: #0d966e;
          color: #d1fae5;
          transform: translateY(-1px);
        }

        .universe-category-btn.is-active {
          border-color: #059669;
          background: #064e3b;
          color: #6ee7b7;
          box-shadow: 0 3px 12px rgba(16, 185, 129, 0.12);
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
          border: 1px solid #263449;
          border-radius: 999px;
          background: #101827;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .universe-games-search:focus-within {
          border-color: #059669;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .universe-games-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #f8fafc;
          font-size: 13px;
        }

        .universe-games-search input::placeholder {
          color: #718096;
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
          color: #94a3b8;
          cursor: pointer;
        }

        .universe-games-clear:hover {
          background: #263449;
          color: #f8fafc;
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
          border: 1px solid #263449;
          border-radius: 14px;
          outline: none;
          background: #0d131f;
          box-shadow: 0 5px 18px rgba(0, 0, 0, 0.34);
          cursor: pointer;
          isolation: isolate;
          transition: transform 180ms ease, border-color 180ms ease,
            box-shadow 180ms ease;
        }

        .universe-game-card:hover,
        .universe-game-card:focus-visible {
          z-index: 1;
          transform: translateY(-4px);
          border-color: #10b981;
          box-shadow: 0 12px 28px rgba(16, 185, 129, 0.2);
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

        /* Mobile Phone Screens (down to 340px) -> STRICTLY 3 CARDS IN ONE LINE */
        @media (max-width: 768px) {
          .universe-games-page {
            width: 100%;
            padding: 12px 6px;
          }

          .universe-games-toolbar {
            gap: 10px;
            margin-bottom: 14px;
            padding-bottom: 10px;
          }

          .universe-games-categories {
            flex-basis: 100%;
            gap: 6px;
          }

          .universe-category-btn {
            padding: 6px 12px;
            font-size: 11.5px;
          }

          .universe-games-search {
            flex: 1 1 100%;
            min-width: 0;
            min-height: 38px;
            padding: 0 12px;
          }

          /* Exactly 3 cards per row matching mobile screen */
          .universe-games-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }

          .universe-game-card {
            border-radius: 10px;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
          }
        }

        /* Very narrow screens (340px and below) */
        @media (max-width: 360px) {
          .universe-games-page {
            padding: 10px 4px;
          }

          .universe-games-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 5px;
          }

          .universe-game-card {
            border-radius: 8px;
          }
        }
      `}</style>

      {/* Category navigation and search. */}
      <div className="universe-games-toolbar">
        <div className="universe-games-categories">
          {categories.map((category) => {
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
