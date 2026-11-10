import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, Shield, Search, X, Maximize2 } from 'lucide-react';
import axios from 'axios';
import CustomCasinoGameView from './CustomCasinoGameView';

export const ALLOWED_CASINO_IDS = [
  '99.0010', // 20-20 TEENPATTI
  '99.0030', // LUCKY 7
  '99.0013', // 1 DAY TEENPATTI
  '99.0016', // JOKER TEEN PATTI
  '99.0019', // DRAGON TIGER
  '99.0001', // BACCARAT
  '99.0025', // ANDAR BAHAR
  '99.0022', // 32 CARDS
  '99.0007', // POKER
  '99.0041', // DTL
  '99.0021', // 1 DAY DRAGON TIGER
  '99.0014', // MUFLIS TEEN PATTI
  '99.0046', // CARD RACE
  '99.0005', // AMAR AKBAR ANTHONY
  '99.0018', // DRAGON TIGER
];

export const TABLE_METADATA = {
  '99.0010': { name: '20-20 TEENPATTI', image: '/20-20teenpatti.jpg' },
  '99.0030': { name: 'LUCKY 7', image: '/Lucky-7.jpg' },
  '99.0013': { name: '1 DAY TEENPATTI', image: '/1Dayteenpatti.jpg' },
  '99.0016': { name: 'JOKER TEENPATTI', image: '/Jokerteenpatti.jpg' },
  '99.0019': { name: 'DRAGON TIGER', image: '/Dragontiger.jpg' },
  '99.0001': { name: 'BACCARAT', image: '/Baccarat.jpg' },
  '99.0025': { name: 'ANDAR BAHAR', image: '/AndarBahar.jpg' },
  '99.0022': { name: '32 CARDS', image: '/32cards.jpg' },
  '99.0007': { name: 'POKER', image: '/Poker.jpg' },
  '99.0041': { name: 'DTL', image: '/DTL.jpg' },
  '99.0021': { name: '1 DAY DRAGON TIGER', image: '/1DayDragontiger.jpg' },
  '99.0014': { name: 'MUFLIS TEENPATTI', image: '/muflisteenpatti-01.jpg' },
  '99.0046': { name: 'CARD RACE', image: '/CardRace.jpg' },
  '99.0005': { name: 'AMAR AKBAR ANTHONY', image: '/AmarAkbarAnthony-01.jpg' },
  '99.0018': { name: 'DRAGON TIGER', image: '/dragon-tiger-01.jpg' },
};

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
        // Filter strictly to allowed casino tables, removing extra games like Balloon, Vimaan, Heads & Tails, etc.
        const filtered = list
          .filter((t) => ALLOWED_CASINO_IDS.includes(String(t.eventId)))
          .map((t) => {
            const meta = TABLE_METADATA[String(t.eventId)] || {};
            return {
              ...t,
              eventName: meta.name || String(t.eventName || '').replace(/\s*-\s*[A-Z0-9]+$/g, '').trim(),
              image: meta.image || t.image || '/Lucky-7.jpg',
            };
          });

        // Exact indexing preservation matching user defined order
        filtered.sort((a, b) => {
          return ALLOWED_CASINO_IDS.indexOf(String(a.eventId)) - ALLOWED_CASINO_IDS.indexOf(String(b.eventId));
        });

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

      {/* Grid of Real Live Casino Tables - ONLY CLEAN ARTWORK IMAGES (Zero text overlay / Zero Live Play pills) */}
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
            const displayImg = game.image || '/Lucky-7.jpg';

            return (
              <div
                key={game.eventId || idx}
                onClick={() => setActiveGame(game)}
                style={{
                  background: '#141414',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  overflow: 'hidden',
                  position: 'relative',
                  aspectRatio: '0.96',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(16, 185, 129, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.45)';
                }}
              >
                {/* 100% Pure Clean Artwork Image - No overlay text, no live play badges */}
                <img
                  src={displayImg}
                  alt={game.eventName || 'Casino Table'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                />
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
