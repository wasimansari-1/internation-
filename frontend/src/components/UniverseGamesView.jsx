import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, Shield, Search, X, Maximize2 } from 'lucide-react';
import axios from 'axios';
import CustomCasinoGameView from './CustomCasinoGameView';

export default function UniverseGamesView() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGame, setActiveGame] = useState(null);

  // Fetch Real Universe Casino Tables
  const fetchTables = async () => {
    try {
      setLoading(true);
      const res = await axios.post('/api/casino/tables', { id: 110 });
      const list = res.data?.data?.data || res.data?.data || [];
      if (Array.isArray(list)) {
        // Filter out Balloon and Vimaan/Aviator as requested
        const filtered = list.filter(
          (t) =>
            t.eventId !== '88.0022' &&
            t.eventId !== '88.0023' &&
            !(t.eventName || '').toUpperCase().includes('BALLOON') &&
            !(t.eventName || '').toUpperCase().includes('VIMAAN') &&
            !(t.eventName || '').toUpperCase().includes('AVIATOR')
        );
        setTables(filtered);
      }
    } catch (err) {
      console.error('Error fetching real casino tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // Filter tables by search query
  const displayList = tables.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (g.eventName || '').toLowerCase().includes(q) ||
      (g.eventId || '').toLowerCase().includes(q) ||
      (g.companyName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 20px', width: '100%' }}>
      {/* Top Header & Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          gap: '16px'
        }}
      >
        <div>
          <div
            style={{
              color: '#10b981',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}
          >
            NATIVE LIVE DEALER CASINO
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.5px',
              margin: 0
            }}
          >
            OUR CASINO ({tables.length})
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: '#94a3b8',
              marginTop: '6px',
              marginBottom: 0
            }}
          >
            Real-time scraped Indian Live Tables with live cards, round timer, runner rates & round results.
          </p>
        </div>

        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#141414',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            padding: '8px 14px',
            gap: '8px',
            width: '100%',
            maxWidth: '320px'
          }}
        >
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search casino tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '13px',
              width: '100%'
            }}
          />
          {searchQuery && (
            <X
              size={14}
              color="#94a3b8"
              style={{ cursor: 'pointer' }}
              onClick={() => setSearchQuery('')}
            />
          )}
        </div>
      </div>

      {/* Grid of Real Live Casino Tables */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8' }}>
          <RefreshCw size={32} className="live-indicator" style={{ margin: '0 auto 12px', color: '#10b981' }} />
          <p style={{ fontSize: '14px', fontWeight: 600 }}>Loading Real Casino Tables...</p>
        </div>
      ) : displayList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          No tables found matching "{searchQuery}".
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '16px'
          }}
        >
          {displayList.map((game, idx) => {
            const displayImg = game.image || '/casino_images/20-20teenpatti.jpg';
            const displayName = game.eventName?.toUpperCase() || 'CASINO GAME';
            const providerName = game.companyName || 'UNIVERSE';

            return (
              <div
                key={game.eventId || idx}
                onClick={() => setActiveGame(game)}
                style={{
                  background: '#141414',
                  borderRadius: '12px',
                  border: '1px solid #222222',
                  overflow: 'hidden',
                  position: 'relative',
                  aspectRatio: '0.85',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(16, 185, 129, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#222222';
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.45)';
                }}
              >
                {/* Background Artwork */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${displayImg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'brightness(0.96)'
                  }}
                />

                {/* Top Badge: Provider Tag */}
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(4px)',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    border: '1px solid rgba(255,255,255,0.12)'
                  }}
                >
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 900,
                      color: '#ffffff',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase'
                    }}
                  >
                    {providerName}
                  </span>
                </div>

                {/* Dark Vignette Gradient */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(180deg, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.85) 85%, rgba(0,0,0,0.98) 100%)'
                  }}
                />

                {/* Card Bottom Content */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 900,
                      color: '#ffffff',
                      letterSpacing: '-0.3px',
                      textTransform: 'uppercase',
                      textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                      lineHeight: '1.2'
                    }}
                  >
                    {displayName}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '4px'
                    }}
                  >
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.25)',
                        border: '1px solid rgba(16, 185, 129, 0.5)',
                        color: '#34d399',
                        fontSize: '9px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          background: 'currentColor',
                          borderRadius: '50%'
                        }}
                      />
                      LIVE
                    </span>

                    <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 800 }}>
                      PLAY ➔
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Real Live Native Universe Casino Modal */}
      {activeGame && (
        <CustomCasinoGameView
          gameId={activeGame.eventId || '99.0010'}
          gameName={activeGame.eventName}
          onClose={() => setActiveGame(null)}
        />
      )}
    </div>
  );
}
