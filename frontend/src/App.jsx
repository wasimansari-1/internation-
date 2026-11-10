import React, { useState, useEffect } from "react";
import UniverseGamesView from "./components/UniverseGamesView";
import SportsOddsView from "./components/SportsOddsView";
import MatchDetailTablesView from "./components/MatchDetailTablesView";
import ApiInspector from "./components/ApiInspector";
import ApiManagementDashboard from "./components/ApiManagementDashboard";
import WingoGameView from "./components/WingoGameView";
import { RotateCw, ShieldCheck, Activity } from "lucide-react";

function getTabFromUrl() {
  const path = (window.location.pathname || "").toLowerCase();
  const hash = (window.location.hash || "").toLowerCase();
  const search = new URLSearchParams(window.location.search);
  const tabParam = (search.get("tab") || "").toUpperCase();

  if (["GAMES", "SPORTS", "DOCS", "WINGO", "GATEWAY"].includes(tabParam)) {
    return tabParam;
  }

  if (
    path.includes("/admin") ||
    path.includes("/dashboard") ||
    path.includes("/gateway") ||
    path.includes("/telemetry") ||
    hash.includes("admin") ||
    hash.includes("dashboard") ||
    hash.includes("gateway")
  ) {
    return "GATEWAY";
  }
  if (path.includes("/wingo") || hash.includes("wingo")) return "WINGO";
  if (path.includes("/sports") || hash.includes("sports")) return "SPORTS";
  if (path.includes("/docs") || hash.includes("docs")) return "DOCS";

  // Persistent tab retention across browser refreshes
  try {
    const saved = localStorage.getItem("app_active_tab");
    if (saved && ["GAMES", "SPORTS", "DOCS", "WINGO", "GATEWAY"].includes(saved)) {
      return saved;
    }
  } catch (e) {}

  return "GAMES";
}

export default function App() {
  const [activeTab, setActiveTab] = useState(getTabFromUrl);
  const [selectedMatch, setSelectedMatch] = useState(() => {
    try {
      const saved = sessionStorage.getItem("app_selected_match");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Sync tab with browser URL history
  useEffect(() => {
    const onPopState = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Ensure browser URL pathname reflects restored tab on page load
  useEffect(() => {
    let targetPath = "/";
    if (activeTab === "GATEWAY") targetPath = "/admin";
    else if (activeTab === "WINGO") targetPath = "/wingo";
    else if (activeTab === "SPORTS") targetPath = "/sports";
    else if (activeTab === "DOCS") targetPath = "/docs";

    if (window.location.pathname !== targetPath && !window.location.pathname.includes("/api")) {
      try {
        window.history.replaceState(null, "", targetPath + window.location.search);
      } catch (e) {}
    }
  }, [activeTab]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem("app_active_tab", tab);
    } catch (e) {}

    if (tab !== "SPORTS") {
      setSelectedMatch(null);
      try {
        sessionStorage.removeItem("app_selected_match");
      } catch (e) {}
    }

    let newPath = "/";
    if (tab === "GATEWAY") newPath = "/admin";
    else if (tab === "WINGO") newPath = "/wingo";
    else if (tab === "SPORTS") newPath = "/sports";
    else if (tab === "DOCS") newPath = "/docs";
    try {
      window.history.pushState(null, "", newPath);
    } catch (e) {}
  };

  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
    try {
      if (match) {
        sessionStorage.setItem("app_selected_match", JSON.stringify(match));
      } else {
        sessionStorage.removeItem("app_selected_match");
      }
    } catch (e) {}
  };

  // Dedicated Full-Page Senior Enterprise View for Admin/Gateway (White & Fade Blue, No Consumer Header)
  if (activeTab === "GATEWAY") {
    return <ApiManagementDashboard onSwitchTab={switchTab} />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080b11",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top Header */}
      <header
        style={{
          background: "#0c1017",
          borderBottom: "1px solid #1a2230",
          padding: "0 20px",
          height: "54px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 100,
          gap: "16px",
        }}
      >
        {/* Left: Professional API Provider Logo */}
        <div
          onClick={() => switchTab("GAMES")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "14px",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
            }}
          >
            U
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 900,
                color: "#f8fafc",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              UNIVERSAL
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                color: "#38bdf8",
                letterSpacing: "0.8px",
              }}
            >
              EXCHANGE
            </span>
          </div>
        </div>

        {/* Right: Clean Professional Navigation Tabs */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            height: "100%",
          }}
        >
          <button
            onClick={() => switchTab("GAMES")}
            style={{
              background: "none",
              border: "none",
              color: activeTab === "GAMES" ? "#38bdf8" : "#94a3b8",
              fontWeight: 800,
              fontSize: "12px",
              letterSpacing: "0.6px",
              cursor: "pointer",
              height: "100%",
              display: "flex",
              alignItems: "center",
              borderBottom:
                activeTab === "GAMES"
                  ? "2px solid #38bdf8"
                  : "2px solid transparent",
              transition: "all 0.15s",
              padding: "0 4px",
              whiteSpace: "nowrap",
            }}
          >
            GAMES
          </button>

          <button
            onClick={() => switchTab("SPORTS")}
            style={{
              background: "none",
              border: "none",
              color: activeTab === "SPORTS" ? "#38bdf8" : "#94a3b8",
              fontWeight: 800,
              fontSize: "12px",
              letterSpacing: "0.6px",
              cursor: "pointer",
              height: "100%",
              display: "flex",
              alignItems: "center",
              borderBottom:
                activeTab === "SPORTS"
                  ? "2px solid #38bdf8"
                  : "2px solid transparent",
              transition: "all 0.15s",
              padding: "0 4px",
              whiteSpace: "nowrap",
            }}
          >
            SPORTS
          </button>

          <button
            onClick={() => switchTab("DOCS")}
            style={{
              background: "none",
              border: "none",
              color: activeTab === "DOCS" ? "#38bdf8" : "#94a3b8",
              fontWeight: 800,
              fontSize: "12px",
              letterSpacing: "0.6px",
              cursor: "pointer",
              height: "100%",
              display: "flex",
              alignItems: "center",
              borderBottom:
                activeTab === "DOCS"
                  ? "2px solid #38bdf8"
                  : "2px solid transparent",
              transition: "all 0.15s",
              padding: "0 4px",
              whiteSpace: "nowrap",
            }}
          >
            DOCS
          </button>

          {/* Refresh icon */}
          <button
            onClick={() => window.location.reload()}
            title="Reload live feeds"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "4px",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
          >
            <RotateCw size={14} />
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* 1. GAMES TAB (Exact matching screenshot media_1793547711623_2f4e7a73.jpg) */}
        {activeTab === "GAMES" && <UniverseGamesView />}

        {/* 1.5 WINGO LOTTERY TAB */}
        {activeTab === "WINGO" && <WingoGameView />}

        {/* 2. SPORTS TAB */}
        {activeTab === "SPORTS" &&
          (selectedMatch ? (
            <div style={{ padding: "16px" }}>
              <MatchDetailTablesView
                event={selectedMatch}
                onBack={() => handleSelectMatch(null)}
              />
            </div>
          ) : (
            <div
              style={{
                maxWidth: "1400px",
                margin: "0 auto",
                width: "100%",
                padding: "20px",
              }}
            >
              {/* Clean Professional Header */}
              <div style={{ marginBottom: "20px" }}>
                <h1
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    color: "#f8fafc",
                    letterSpacing: "-0.3px",
                    margin: 0,
                  }}
                >
                  Live Sports Markets
                </h1>
              </div>

              <SportsOddsView
                onSwitchToCasino={() => switchTab("GAMES")}
                onSelectMatch={(m) => handleSelectMatch(m)}
              />
            </div>
          ))}

        {/* 3. GATEWAY HUB TAB (Enterprise API Load & Origin Block Telemetry) */}
        {activeTab === "GATEWAY" && <ApiManagementDashboard />}

        {/* 4. DOCS TAB */}
        {activeTab === "DOCS" && (
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              width: "100%",
              padding: "20px",
            }}
          >
            <div style={{ marginBottom: "20px" }}>
              <h1
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#f8fafc",
                  letterSpacing: "-0.3px",
                  margin: 0,
                }}
              >
                API Documentation
              </h1>
            </div>
            <ApiInspector />
          </div>
        )}
      </main>
    </div>
  );
}
