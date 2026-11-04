import React, { useState, useEffect } from 'react';
import UniverseGamesView from './components/UniverseGamesView';
import SportsOddsView from './components/SportsOddsView';
import MatchDetailTablesView from './components/MatchDetailTablesView';
import ApiInspector from './components/ApiInspector';
import ApiManagementDashboard from './components/ApiManagementDashboard';
import { RotateCw, ShieldCheck, Activity } from 'lucide-react';

function getTabFromUrl() {
  const path = (window.location.pathname || '').toLowerCase();
  const hash = (window.location.hash || '').toLowerCase();
  if (
    path.includes('/admin') ||
    path.includes('/dashboard') ||
    path.includes('/gateway') ||
    path.includes('/telemetry') ||
    hash.includes('admin') ||
    hash.includes('dashboard') ||
    hash.includes('gateway')
  ) {
    return 'GATEWAY';
  }
  if (path.includes('/sports') || hash.includes('sports')) return 'SPORTS';
  if (path.includes('/docs') || hash.includes('docs')) return 'DOCS';
  return 'GAMES';
}

export default function App() {
  const [activeTab, setActiveTab] = useState(getTabFromUrl); // 'GAMES' | 'SPORTS' | 'GATEWAY' | 'DOCS'
  const [selectedMatch, setSelectedMatch] = useState(null);

  // Sync tab with browser URL history
  useEffect(() => {
    const onPopState = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSelectedMatch(null);
    let newPath = '/';
    if (tab === 'GATEWAY') newPath = '/admin';
    else if (tab === 'SPORTS') newPath = '/sports';
    else if (tab === 'DOCS') newPath = '/docs';
    try {
      window.history.pushState(null, '', newPath);
    } catch (e) {}
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0d',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    }}>
      {/* Top Header */}
      <header style={{
        background: '#080808',
        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
        padding: '0 16px',
        height: '58px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: '12px',
      }}>
        {/* Left: [U] UNIVERSAL API Logo */}
        <div 
          onClick={() => switchTab('GAMES')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            border: '2px solid #ffffff',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '15px',
            color: '#ffffff',
            lineHeight: 1
          }}>
            U
          </div>
          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              lineHeight: 1.1
            }}>
              UNIVERSAL
            </div>
            <div style={{
              fontSize: '8px',
              fontWeight: 700,
              color: '#6b7280',
              letterSpacing: '1px'
            }}>
              API
            </div>
          </div>
        </div>

        {/* Right: Scrollable Navigation Tabs (Mobile-Friendly) */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          height: '100%',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          <button
            onClick={() => switchTab('GAMES')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'GAMES' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '0.8px',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              borderBottom: activeTab === 'GAMES' ? '2px solid #10b981' : '2px solid transparent',
              transition: 'all 0.2s',
              padding: '0 4px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            GAMES
          </button>

          <button
            onClick={() => switchTab('SPORTS')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'SPORTS' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '0.8px',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              borderBottom: activeTab === 'SPORTS' ? '2px solid #10b981' : '2px solid transparent',
              transition: 'all 0.2s',
              padding: '0 4px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            SPORTS
          </button>

          {/* ADMIN / GATEWAY DASHBOARD TAB */}
          <button
            onClick={() => switchTab('GATEWAY')}
            title="Open API Gateway & Origin Management Dashboard"
            style={{
              background: activeTab === 'GATEWAY' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
              border: activeTab === 'GATEWAY' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
              color: activeTab === 'GATEWAY' ? '#38bdf8' : '#e2e8f0',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '6px',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#38bdf8',
              boxShadow: '0 0 8px #38bdf8'
            }} />
            <Activity size={12} style={{ color: '#38bdf8' }} />
            ADMIN HUB
          </button>

          <button
            onClick={() => switchTab('DOCS')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'DOCS' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '0.8px',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              borderBottom: activeTab === 'DOCS' ? '2px solid #10b981' : '2px solid transparent',
              transition: 'all 0.2s',
              padding: '0 4px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            DOCS
          </button>

          {/* Refresh icon */}
          <button
            onClick={() => window.location.reload()}
            title="Reload live feeds"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              padding: '4px'
            }}
          >
            <RotateCw size={15} />
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 1. GAMES TAB (Exact matching screenshot media_1793547711623_2f4e7a73.jpg) */}
        {activeTab === 'GAMES' && (
          <UniverseGamesView />
        )}

        {/* 2. SPORTS TAB */}
        {activeTab === 'SPORTS' && (
          selectedMatch ? (
            <div style={{ padding: '16px' }}>
              <MatchDetailTablesView
                event={selectedMatch}
                onBack={() => setSelectedMatch(null)}
              />
            </div>
          ) : (
            <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', padding: '24px 20px' }}>
              {/* Header */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  MARKETS
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.5px', margin: 0 }}>
                  EXCHANGE LIVE SPORTS
                </h1>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
                  Live Match Odds, Bookmaker Cup Bhav, and Fancy session markets.
                </p>
              </div>

              <SportsOddsView
                onSwitchToCasino={() => setActiveTab('GAMES')}
                onSelectMatch={(m) => setSelectedMatch(m)}
              />
            </div>
          )
        )}

        {/* 3. GATEWAY HUB TAB (Enterprise API Load & Origin Block Telemetry) */}
        {activeTab === 'GATEWAY' && (
          <ApiManagementDashboard />
        )}

        {/* 4. DOCS TAB */}
        {activeTab === 'DOCS' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '24px 20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
                DOCUMENTATION
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                API ENDPOINTS & SCRAPER DEBUGGER
              </h1>
            </div>
            <ApiInspector />
          </div>
        )}
      </main>
    </div>
  );
}
