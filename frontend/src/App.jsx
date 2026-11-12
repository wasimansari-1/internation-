import React, { useState, useEffect } from "react";
import axios from "axios";
import UniverseGamesView from "./components/UniverseGamesView";
import SportsOddsView from "./components/SportsOddsView";
import MatchDetailTablesView from "./components/MatchDetailTablesView";
import ApiInspector from "./components/ApiInspector";
import ApiManagementDashboard from "./components/ApiManagementDashboard";
import WingoGameView from "./components/WingoGameView";
import UniversalApiLogo from "./components/UniversalApiLogo";
import { RotateCw, Menu, X, ShieldCheck, Lock, User, LogOut, ArrowRight } from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPlatformAuth, setIsPlatformAuth] = useState(() => {
    return Boolean(
      sessionStorage.getItem("client_user_token") ||
      localStorage.getItem("client_user_token") ||
      sessionStorage.getItem("admin_auth_token") ||
      localStorage.getItem("admin_auth_token")
    );
  });
  const [operatorUser, setOperatorUser] = useState(() => {
    return localStorage.getItem("client_user_name") || "Igwasim";
  });
  const [loginId, setLoginId] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [selectedMatch, setSelectedMatch] = useState(() => {
    try {
      const saved = sessionStorage.getItem("app_selected_match");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const handleClientLogin = async (e) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPass.trim()) {
      setLoginError("Please enter User ID and Password.");
      return;
    }
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await axios.post("/api/auth/client-login", {
        username: loginId.trim(),
        password: loginPass,
      });
      if (res.data?.success && res.data?.token) {
        sessionStorage.setItem("client_user_token", res.data.token);
        localStorage.setItem("client_user_token", res.data.token);
        localStorage.setItem("client_user_name", res.data.user?.username || "Igwasim");
        axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
        axios.defaults.headers.common["x-client-token"] = res.data.token;
        setOperatorUser(res.data.user?.username || "Igwasim");
        setIsPlatformAuth(true);
      } else {
        setLoginError(res.data?.error || "Invalid User ID or Password");
      }
    } catch (err) {
      setLoginError(err.response?.data?.error || "Invalid User ID or Password");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleClientLogout = async () => {
    try {
      await axios.post("/api/auth/client-logout");
    } catch (e) {}
    sessionStorage.removeItem("client_user_token");
    localStorage.removeItem("client_user_token");
    sessionStorage.removeItem("admin_auth_token");
    localStorage.removeItem("admin_auth_token");
    delete axios.defaults.headers.common["Authorization"];
    delete axios.defaults.headers.common["x-client-token"];
    setIsPlatformAuth(false);
  };

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
    setMobileMenuOpen(false);
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

  // Platform Login Gate: If operator is not authenticated, render secure login gate
  if (!isPlatformAuth) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#070b12",
          backgroundImage: "radial-gradient(ellipse at 50% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 60%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
          color: "#f8fafc",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "380px",
            backgroundColor: "#0d141f",
            border: "1px solid #1e293b",
            borderRadius: "16px",
            padding: "32px 28px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "26px" }}>
            <div style={{ display: "inline-flex", marginBottom: "14px" }}>
              <UniversalApiLogo />
            </div>
            <h1 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 6px 0", letterSpacing: "-0.01em" }}>
              Universal API Gateway
            </h1>
            <p style={{ fontSize: "12px", color: "#64748b", margin: 0, fontWeight: 500 }}>
              Authorized Operator & Partner Sign In
            </p>
          </div>

          {loginError && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleClientLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "6px",
                }}
              >
                User ID
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Enter User ID"
                  autoFocus
                  required
                  style={{
                    width: "100%",
                    padding: "11px 14px 11px 36px",
                    backgroundColor: "#070b12",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                    color: "#f8fafc",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#10b981")}
                  onBlur={(e) => (e.target.style.borderColor = "#1e293b")}
                />
                <User size={15} color="#64748b" style={{ position: "absolute", left: "12px", top: "13px" }} />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "6px",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Enter Password"
                  required
                  style={{
                    width: "100%",
                    padding: "11px 14px 11px 36px",
                    backgroundColor: "#070b12",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                    color: "#f8fafc",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#10b981")}
                  onBlur={(e) => (e.target.style.borderColor = "#1e293b")}
                />
                <Lock size={15} color="#64748b" style={{ position: "absolute", left: "12px", top: "13px" }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                marginTop: "6px",
                width: "100%",
                padding: "11px",
                backgroundColor: loginLoading ? "#047857" : "#10b981",
                border: "none",
                borderRadius: "8px",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: loginLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
              }}
            >
              {loginLoading ? "Verifying..." : "Sign In to Gateway"}
              {!loginLoading && <ArrowRight size={15} />}
            </button>
          </form>

          <div
            style={{
              marginTop: "22px",
              paddingTop: "14px",
              borderTop: "1px solid #1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              fontSize: "11px",
              color: "#475569",
            }}
          >
            <ShieldCheck size={13} color="#10b981" />
            <span>256-Bit Cryptographic Firewall Protected</span>
          </div>
        </div>
      </div>
    );
  }

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
      {/* Top Header - Pure API Provider Theme */}
      <header
        style={{
          background: "#0a0e14",
          borderBottom: "1px solid #10b981",
          position: "sticky",
          top: 0,
          zIndex: 100,
          width: "100%",
        }}
      >
        <div
          className="app-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "56px",
          }}
        >
          {/* Left: Brand Emblem Logo */}
          <UniversalApiLogo
            size="md"
            onClick={() => switchTab("GAMES")}
          />

          {/* Right: Desktop Navigation Tabs */}
          <nav
            className="desktop-nav"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              height: "100%",
            }}
          >
            {["GAMES", "SPORTS", "DOCS"].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  style={{
                    background: "none",
                    border: "none",
                    color: isActive ? "#34d399" : "#94a3b8",
                    fontWeight: 800,
                    fontSize: "12px",
                    letterSpacing: "0.8px",
                    cursor: "pointer",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    borderBottom: isActive
                      ? "2px solid #10b981"
                      : "2px solid transparent",
                    transition: "all 0.15s",
                    padding: "0 4px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab}
                </button>
              );
            })}

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
              onMouseEnter={(e) => (e.currentTarget.style.color = "#34d399")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            >
              <RotateCw size={14} />
            </button>

            {/* Operator Session Badge & Logout */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "10px", paddingLeft: "10px", borderLeft: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 8px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "6px", fontSize: "11px", fontWeight: 700, color: "#34d399" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
                {operatorUser}
              </div>
              <button
                onClick={handleClientLogout}
                title="Sign Out"
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "4px",
                  borderRadius: "4px",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >
                <LogOut size={14} />
              </button>
            </div>
          </nav>

          {/* Mobile Hamburger Button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{
              background: "none",
              border: "none",
              color: "#f8fafc",
              cursor: "pointer",
              display: "none",
              padding: "6px",
            }}
          >
            {mobileMenuOpen ? <X size={22} color="#10b981" /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: "#0d141d",
            borderBottom: "1px solid #1e293b",
            position: "sticky",
            top: "56px",
            zIndex: 99,
            width: "100%",
          }}
        >
          <div
            className="app-container"
            style={{
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {["GAMES", "SPORTS", "DOCS"].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  style={{
                    background: isActive ? "#064e3b" : "transparent",
                    border: isActive ? "1px solid #059669" : "1px solid #1e293b",
                    borderRadius: "8px",
                    color: isActive ? "#34d399" : "#cbd5e1",
                    fontWeight: 800,
                    fontSize: "13px",
                    padding: "10px 14px",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{tab}</span>
                  {isActive && (
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "#10b981",
                      }}
                    />
                  )}
                </button>
              );
            })}

            {/* Mobile Operator Info & Logout */}
            <div
              style={{
                marginTop: "6px",
                paddingTop: "10px",
                borderTop: "1px solid #1e293b",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#34d399", fontWeight: 700 }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                <span>{operatorUser}</span>
              </div>
              <button
                onClick={handleClientLogout}
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified responsive container CSS */}
      <style>{`
        .app-container {
          width: 75%;
          max-width: 1140px;
          margin: 0 auto;
          padding: 0 16px;
          box-sizing: border-box;
        }

        @media (max-width: 1080px) {
          .app-container {
            width: 90%;
            max-width: 100%;
            padding: 0 14px;
          }
        }

        @media (max-width: 768px) {
          .app-container {
            width: 100%;
            padding: 0 16px;
          }
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
        }
      `}</style>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* 1. GAMES TAB */}
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

        {/* 3. GATEWAY HUB TAB */}
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

      {/* Footer matching user reference image media_1794350652170_5456cb32.png */}
      <footer
        style={{
          backgroundColor: "#070b10",
          borderTop: "1px solid #10b981",
          padding: "44px 0 36px",
          marginTop: "auto",
          width: "100%",
        }}
      >
        <div
          className="app-container"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {/* Center Logo */}
          <div style={{ marginBottom: "14px" }}>
            <UniversalApiLogo
              size="lg"
              align="center"
              onClick={() => switchTab("GAMES")}
            />
          </div>

          {/* Tagline */}
          <p
            style={{
              color: "#8e9eb3",
              fontSize: "13px",
              lineHeight: 1.5,
              margin: "0 0 22px 0",
              maxWidth: "520px",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Live tables, sports odds, TV, and a single partner contract.
          </p>

          {/* Footer Navigation Links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "28px",
              flexWrap: "wrap",
            }}
          >
            {["GAMES", "SPORTS", "DOCS"].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  style={{
                    background: "none",
                    border: "none",
                    color: isActive ? "#34d399" : "#cbd5e1",
                    fontWeight: 800,
                    fontSize: "12px",
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    padding: "4px 8px",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#34d399")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = isActive ? "#34d399" : "#cbd5e1")
                  }
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
}
