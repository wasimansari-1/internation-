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

function WhatsAppIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2ZM12.04 20.15C10.56 20.15 9.11 19.76 7.85 19.01L7.55 18.83L4.44 19.65L5.27 16.61L5.07 16.29C4.24 14.97 3.81 13.46 3.81 11.91C3.81 7.37 7.5 3.69 12.05 3.69C14.25 3.69 16.31 4.55 17.87 6.11C19.42 7.67 20.28 9.73 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15ZM16.57 14.39C16.32 14.26 15.11 13.67 14.88 13.59C14.66 13.5 14.5 13.46 14.33 13.71C14.17 13.96 13.71 14.5 13.56 14.67C13.42 14.83 13.28 14.86 13.03 14.73C12.78 14.61 11.99 14.35 11.05 13.51C10.31 12.85 9.82 12.04 9.68 11.79C9.53 11.54 9.66 11.41 9.79 11.28C9.9 11.17 10.03 11 10.16 10.85C10.29 10.7 10.33 10.59 10.42 10.42C10.5 10.26 10.46 10.11 10.4 9.99C10.33 9.86 9.84 8.66 9.63 8.16C9.43 7.68 9.23 7.74 9.07 7.73C8.93 7.73 8.76 7.72 8.59 7.72C8.42 7.72 8.15 7.78 7.92 8.03C7.69 8.28 7.05 8.88 7.05 10.1C7.05 11.32 7.94 12.49 8.06 12.66C8.19 12.83 9.81 15.33 12.3 16.4C12.89 16.66 13.35 16.81 13.71 16.93C14.31 17.12 14.85 17.09 15.28 17.03C15.76 16.96 16.76 16.42 16.97 15.83C17.18 15.24 17.18 14.74 17.11 14.62C17.05 14.51 16.82 14.51 16.57 14.39Z" />
    </svg>
  );
}

function getTabFromUrl() {
  const path = (window.location.pathname || "").toLowerCase();
  const hash = (window.location.hash || "").toLowerCase();
  const search = new URLSearchParams(window.location.search);
  const tabParam = (search.get("tab") || "").toUpperCase();

  if (["GAMES", "SPORTS", "DOCS", "WINGO", "GATEWAY"].includes(tabParam)) {
    return tabParam;
  }

  if (
    path.includes("/master") ||
    path.includes("/admin") ||
    path.includes("/dashboard") ||
    path.includes("/gateway") ||
    hash.includes("master") ||
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
    if (activeTab === "GATEWAY") targetPath = "/master";
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
    if (tab === "GATEWAY") newPath = "/master";
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

  // Dedicated View for Admin/Gateway (Admin authentication handled inside ApiManagementDashboard)
  if (activeTab === "GATEWAY") {
    return <ApiManagementDashboard onSwitchTab={switchTab} />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F7F5EF",
        color: "#1e261f",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top Header - Pure Off-White & Sage Theme */}
      <header
        style={{
          background: "#F7F5EF",
          borderBottom: "1.5px solid #cad7c3",
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
            height: "58px",
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
              gap: "24px",
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
                    color: isActive ? "#E8412C" : "#4e5a4d",
                    fontWeight: 800,
                    fontSize: "13px",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    borderBottom: isActive
                      ? "2.5px solid #E8412C"
                      : "2.5px solid transparent",
                    transition: "all 0.15s ease",
                    padding: "0 6px",
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
                color: "#748373",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: "4px",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#E8412C")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#748373")}
            >
              <RotateCw size={14} />
            </button>

            {/* WhatsApp Direct Sales & Integration Link */}
            <a
              href="https://wa.me/639159224695?text=Hello%2C%20I%20want%20to%20purchase%20API%20access"
              target="_blank"
              rel="noopener noreferrer"
              title="Chat on WhatsApp: +63 915 922 4695"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "6px 14px",
                backgroundColor: "#25D366",
                color: "#FFFFFF",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(37, 211, 102, 0.28)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#20BA5A")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#25D366")}
            >
              <WhatsAppIcon size={15} color="#FFFFFF" />
              <span>+63 915 922 4695</span>
            </a>

            {/* Operator Session Badge & Logout (when signed in) */}
            {isPlatformAuth && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "4px", paddingLeft: "8px", borderLeft: "1.5px solid #cad7c3" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", background: "#e3ebd9", border: "1px solid #9CAF88", borderRadius: "6px", fontSize: "11px", fontWeight: 800, color: "#1e261f" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#9CAF88", display: "inline-block" }}></span>
                  {operatorUser}
                </div>
                <button
                  onClick={handleClientLogout}
                  title="Sign Out"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#748373",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    padding: "4px",
                    borderRadius: "4px",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#E8412C")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#748373")}
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </nav>

          {/* Mobile Hamburger Button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{
              background: "none",
              border: "none",
              color: "#1c2721",
              cursor: "pointer",
              display: "none",
              padding: "6px",
            }}
          >
            {mobileMenuOpen ? <X size={22} color="#e04838" /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: "#edf2ee",
            borderBottom: "1px solid #cad7cf",
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
                    background: isActive ? "#fce8e6" : "#ffffff",
                    border: isActive ? "1px solid #f5c2be" : "1px solid #cad7cf",
                    borderRadius: "8px",
                    color: isActive ? "#c5221f" : "#4a5b52",
                    fontWeight: 700,
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

            {/* Mobile WhatsApp Direct Button */}
            <a
              href="https://wa.me/639159224695?text=Hello%2C%20I%20want%20to%20purchase%20API%20access"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#25D366",
                color: "#FFFFFF",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "13px",
                padding: "10px 14px",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                justifyContent: "center",
                marginTop: "4px",
                boxShadow: "0 2px 8px rgba(37, 211, 102, 0.28)",
              }}
            >
              <WhatsAppIcon size={16} color="#FFFFFF" />
              <span>WhatsApp: +63 915 922 4695</span>
            </a>

            {/* Mobile Operator Info & Logout (Only when signed in) */}
            {isPlatformAuth && (
              <div
                style={{
                  marginTop: "6px",
                  paddingTop: "10px",
                  borderTop: "1px solid #cad7cf",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#1b6e38", fontWeight: 700 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1b6e38" }} />
                  <span>{operatorUser}</span>
                </div>
                <button
                  onClick={handleClientLogout}
                  style={{
                    background: "#e04838",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 6px rgba(224, 72, 56, 0.25)",
                  }}
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
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
                    color: "#1c2721",
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
                  color: "#1c2721",
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

      {/* Footer - Faded Sage & Off-White Professional Theme */}
      <footer
        style={{
          backgroundColor: "#edf2ee",
          borderTop: "1px solid #cad7cf",
          padding: "36px 0 28px",
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
          <div style={{ marginBottom: "12px" }}>
            <UniversalApiLogo
              size="lg"
              align="center"
              onClick={() => switchTab("GAMES")}
            />
          </div>

          {/* Tagline */}
          <p
            style={{
              color: "#4a5b52",
              fontSize: "13px",
              lineHeight: 1.5,
              margin: "0 0 14px 0",
              maxWidth: "520px",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Live tables, sports odds, TV, and unified partner integration.
          </p>

          {/* WhatsApp Direct Sales & Integration Bar */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              flexWrap: "wrap",
              margin: "0 0 20px 0",
              padding: "10px 20px",
              background: "#FFFFFF",
              border: "1px solid #cad7c3",
              borderRadius: "10px",
              boxShadow: "0 2px 8px rgba(30, 38, 31, 0.04)",
            }}
          >
            <a
              href="https://wa.me/639159224695?text=Hello%2C%20I%20want%20to%20purchase%20API%20access"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                color: "#1e261f",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              <WhatsAppIcon size={16} color="#25D366" />
              <span>WhatsApp: +63 915 922 4695</span>
            </a>
            <span style={{ color: "#cad7c3" }}>•</span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#4e5a4d" }}>
              Call / Inquiry: +63 945 146 9623
            </span>
          </div>

          {/* Footer Navigation Links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "24px",
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
                    color: isActive ? "#e04838" : "#4a5b52",
                    fontWeight: 800,
                    fontSize: "12px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    padding: "4px 8px",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#e04838")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = isActive ? "#e04838" : "#4a5b52")
                  }
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Action Button */}
      <aside
        style={{
          position: "fixed",
          bottom: "22px",
          right: "22px",
          zIndex: 9999,
        }}
      >
        <a
          href="https://wa.me/639159224695?text=Hello%2C%20I%20want%20to%20purchase%20API%20access"
          target="_blank"
          rel="noopener noreferrer"
          title="Chat on WhatsApp: +63 915 922 4695"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            backgroundColor: "#25D366",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "50px",
            boxShadow: "0 6px 20px rgba(37, 211, 102, 0.45)",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: "13px",
            letterSpacing: "0.2px",
            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px) scale(1.03)";
            e.currentTarget.style.backgroundColor = "#20BA5A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.backgroundColor = "#25D366";
          }}
        >
          <WhatsAppIcon size={20} color="#FFFFFF" />
          <span>Buy API Access</span>
        </a>
      </aside>
    </div>
  );
}
