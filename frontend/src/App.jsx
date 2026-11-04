import React, { useState } from 'react';
import UniverseGamesView from './components/UniverseGamesView';
import SportsOddsView from './components/SportsOddsView';
import MatchDetailTablesView from './components/MatchDetailTablesView';
import ApiInspector from './components/ApiInspector';
import ApiManagementDashboard from './components/ApiManagementDashboard';
import { RotateCw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('GAMES'); // 'GAMES' | 'SPORTS' | 'GATEWAY' | 'DOCS'
  const [selectedMatch, setSelectedMatch] = useState(null);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0d',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    }}>
      {/* Top Header Matching Screenshot media_1793547711623_2f4e7a73.jpg */}
      <header style={{
        background: '#080808',
        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
        padding: '0 28px',
        height: '64px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        {/* Left: [U] UNIVERSAL API Logo */}
        <div 
          onClick={() => { setActiveTab('GAMES'); setSelectedMatch(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
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
              fontSize: '14px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              lineHeight: 1.1
            }}>
              UNIVERSAL
            </div>
            <div style={{
              fontSize: '9px',
              fontWeight: 700,
              color: '#6b7280',
              letterSpacing: '1px'
            }}>
              API
            </div>
          </div>
        </div>

        {/* Right: GAMES | SPORTS | DOCS | Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px', height: '100%' }}>
          <button
            onClick={() => { setActiveTab('GAMES'); setSelectedMatch(null); }}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'GAMES' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '1px',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              borderBottom: activeTab === 'GAMES' ? '2px solid #10b981' : '2px solid transparent',
              transition: 'all 0.2s',
              padding: '0 4px'
            }}
          >
            GAMES
          </button>

          <button
            onClick={() => { setActiveTab('SPORTS'); setSelectedMatch(null); }}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'SPORTS' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '1px',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              borderBottom: activeTab === 'SPORTS' ? '2px solid #10b981' : '2px solid transparent',
              transition: 'all 0.2s',
              padding: '0 4px'
            }}
          >
            SPORTS
          </button>

          <button
            onClick={() => { setActiveTab('DOCS'); setSelectedMatch(null); }}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'DOCS' ? '#ffffff' : '#94a3b8',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '1px',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              borderBottom: activeTab === 'DOCS' ? '2px solid #10b981' : '2px solid transparent',
              transition: 'all 0.2s',
              padding: '0 4px'
            }}
          >
            DOCS
          </button>

          <button
            onClick={() => { setActiveTab('GATEWAY'); setSelectedMatch(null); }}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'GATEWAY' ? '#38bdf8' : '#94a3b8',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '1px',
              cursor: 'pointer',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderBottom: activeTab === 'GATEWAY' ? '2px solid #38bdf8' : '2px solid transparent',
              transition: 'all 0.2s',
              padding: '0 4px'
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
            GATEWAY HUB
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
              alignItems: 'center'
            }}
          >
            <RotateCw size={15} />
          </button>
        </div>
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
