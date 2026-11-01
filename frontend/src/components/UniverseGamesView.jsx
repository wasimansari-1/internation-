import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, Shield, Globe, Sparkles, Search, X, Maximize2, ExternalLink } from 'lucide-react';
import axios from 'axios';
import CustomCasinoGameView from './CustomCasinoGameView';

const COVER_MAP = {
  '99.0010': { name: '20-20 TEENPATTI', image: '/casino_images/20-20teenpatti.jpg' },
  '99.0013': { name: '1 DAY TEENPATTI', image: '/casino_images/1Dayteenpatti.jpg' },
  '99.0016': { name: 'JOKER TEENPATTI', image: '/casino_images/joker.jpeg' },
  '99.0030': { name: 'LUCKY 7', image: '/casino_images/Lucky-7.jpg' },
  '99.0021': { name: '20-20 DRAGON TIGER', image: '/casino_images/2020dragon-tiger.png' },
  '99.0019': { name: 'DRAGON TIGER', image: '/casino_images/1DayDragontiger.jpg' },
  '99.0025': { name: 'ANDAR BAHAR', image: '/casino_images/AndarBahar.jpg' },
  '99.0001': { name: 'BACCARAT', image: '/casino_images/Baccarat.jpg' },
  '99.0022': { name: '32 CARDS', image: '/casino_images/32cards.jpg' },
  '99.0014': { name: 'MUFLIS TEEN PATTI', image: '/casino_images/mufli.jpeg' },
  '99.0041': { name: 'T20 LION', image: '/casino_images/t20lion.png' },
  '99.0046': { name: 'CARD RACE', image: '/casino_images/CardRace.jpeg' },
  'vimaan': { name: 'VIMAAN', image: 'https://nice444.com/api/users/images/Vimaan-min.png' },
  'ballbyball': { name: 'BALL BY BALL', image: 'https://nice444.com/api/users/images/Cricket%20Match-min.png' }
};

export default function UniverseGamesView() {
  const [activeCategory, setActiveCategory] = useState('UNIVERSE'); // 'UNIVERSE' | 'INTERNATIONAL' | 'SLOTS'
  const [universeTables, setUniverseTables] = useState([]);
  const [intlTables, setIntlTables] = useState([]);
  const [slotTables, setSlotTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [activeUniverseGame, setActiveUniverseGame] = useState(null);
  const [activeIntlGame, setActiveIntlGame] = useState(null);
  const [launchUrl, setLaunchUrl] = useState('');
  const [launchLoading, setLaunchLoading] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [customSessionOpen, setCustomSessionOpen] = useState(false);
  const [customSessionInput, setCustomSessionInput] = useState('');

  const handleUpdateSessionUrl = async () => {
    const val = customSessionInput.trim();
    if (!val) return;
    try {
      const res = await axios.post('/api/casino/update-evo-session', { fullUrl: val, launchId: val });
      if (res.data?.success) {
        setLaunchUrl(val);
        setCustomSessionOpen(false);
      }
    } catch (e) {
      console.error('Session update error:', e);
    }
  };

  // Fetch Universe Tables
  const fetchUniverseTables = async () => {
    try {
      const res = await axios.post('/api/casino/tables', { id: 12 });
      const list = res.data?.data?.data || res.data?.data || [];
      if (Array.isArray(list)) {
        setUniverseTables(list);
      }
    } catch (err) {
      console.error('Error fetching universe tables:', err);
    }
  };

  // Fetch International Tables (Evolution + Ezugi)
  const fetchIntlTables = async () => {
    try {
      const res = await axios.get('/api/casino/international-tables');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setIntlTables(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching international tables:', err);
    }
  };

  // Fetch Slot Tables (Platin Games)
  const fetchSlotTables = async () => {
    try {
      const res = await axios.get('/api/casino/slots-tables');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setSlotTables(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching slot tables:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUniverseTables(), fetchIntlTables(), fetchSlotTables()]).finally(() => {
      setLoading(false);
    });
  }, []);

  // Handle Game Launch
  const handleOpenGame = async (game) => {
    if (activeCategory === 'UNIVERSE') {
      setActiveUniverseGame(game);
    } else {
      // International / Slot Game
      setActiveIntlGame(game);
      setLaunchLoading(true);
      setLaunchUrl('');
      setLaunchError(null);
      try {
        const res = await axios.post('/api/casino/launch-game', {
          eventId: game.eventId,
          companyName: game.companyName,
          rawLink: game.link
        });
        if (res.data?.permissionRequired) {
          setLaunchError(res.data.error || 'International Casino permission required by your upline.');
          if (res.data.launchUrl) setLaunchUrl(res.data.launchUrl);
        } else if (res.data?.success && res.data?.launchUrl) {
          setLaunchUrl(res.data.launchUrl);
        } else {
          setLaunchError(res.data?.error || 'Unable to start game session');
        }
      } catch (err) {
        console.error('Error launching game:', err);
        setLaunchError(err.response?.data?.error || err.message);
      } finally {
        setLaunchLoading(false);
      }
    }
  };

  // Filter current list
  const getDisplayList = () => {
    let rawList = [];
    if (activeCategory === 'UNIVERSE') rawList = universeTables;
    if (activeCategory === 'INTERNATIONAL') rawList = intlTables;
    if (activeCategory === 'SLOTS') rawList = slotTables;

    if (!searchQuery.trim()) return rawList;
    const q = searchQuery.toLowerCase();
    return rawList.filter((g) =>
      (g.eventName || '').toLowerCase().includes(q) ||
      (g.eventId || '').toLowerCase().includes(q) ||
      (g.companyName || '').toLowerCase().includes(q)
    );
  };

  const displayList = getDisplayList();

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 20px', width: '100%' }}>
      {/* Top Header & Categories Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        gap: '16px'
      }}>
        <div>
          <div style={{
            color: '#10b981',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            CASINO & GAMING HUB
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.5px',
            margin: 0
          }}>
            {activeCategory === 'UNIVERSE'
              ? 'UNIVERSE LIVE CASINO'
              : activeCategory === 'INTERNATIONAL'
              ? 'INTERNATIONAL CASINO'
              : 'SLOTS & ARCADE'}
          </h1>
          <p style={{
            fontSize: '13px',
            color: '#94a3b8',
            marginTop: '6px',
            marginBottom: 0
          }}>
            {activeCategory === 'UNIVERSE'
              ? 'Real-time Indian Live Tables with custom odds and results.'
              : activeCategory === 'INTERNATIONAL'
              ? 'Evolution Gaming & Ezugi Live Dealer International Tables.'
              : 'Platin & Evolution RNG Slots and Jackpots.'}
          </p>
        </div>

        {/* Search Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#141414',
          border: '1px solid #2a2a2a',
          borderRadius: '8px',
          padding: '8px 14px',
          gap: '8px',
          width: '100%',
          maxWidth: '300px'
        }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder={`Search ${activeCategory.toLowerCase()}...`}
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
            <X size={14} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
          )}
        </div>
      </div>

      {/* 3 Dedicated Sections / Category Pills */}
      <div style={{
        display: 'flex',
        gap: '10px',
        borderBottom: '1px solid #1e293b',
        paddingBottom: '16px',
        marginBottom: '24px',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => { setActiveCategory('UNIVERSE'); setSearchQuery(''); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeCategory === 'UNIVERSE' ? '1px solid #10b981' : '1px solid #222222',
            background: activeCategory === 'UNIVERSE' ? 'rgba(16, 185, 129, 0.15)' : '#121212',
            color: activeCategory === 'UNIVERSE' ? '#10b981' : '#cbd5e1',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Shield size={16} />
          <span>UNIVERSE LIVE ({universeTables.length})</span>
        </button>

        <button
          onClick={() => { setActiveCategory('INTERNATIONAL'); setSearchQuery(''); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeCategory === 'INTERNATIONAL' ? '1px solid #38bdf8' : '1px solid #222222',
            background: activeCategory === 'INTERNATIONAL' ? 'rgba(56, 189, 248, 0.15)' : '#121212',
            color: activeCategory === 'INTERNATIONAL' ? '#38bdf8' : '#cbd5e1',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Globe size={16} />
          <span>INTERNATIONAL CASINO ({intlTables.length})</span>
        </button>

        <button
          onClick={() => { setActiveCategory('SLOTS'); setSearchQuery(''); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: activeCategory === 'SLOTS' ? '1px solid #f59e0b' : '1px solid #222222',
            background: activeCategory === 'SLOTS' ? 'rgba(245, 158, 11, 0.15)' : '#121212',
            color: activeCategory === 'SLOTS' ? '#f59e0b' : '#cbd5e1',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <Sparkles size={16} />
          <span>SLOTS & ARCADE ({slotTables.length})</span>
        </button>
      </div>

      {/* Evolution Gaming Featured Banner when on International Tab */}
      {activeCategory === 'INTERNATIONAL' && (
        <div style={{
          backgroundColor: '#0c1a2e',
          border: '1px solid #1e3a8a',
          borderRadius: '10px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div>
            <div style={{ color: '#38bdf8', fontWeight: 900, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>👑</span>
              <span>EVOLUTION GAMING LIVE LOBBY ACTIVE</span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
              Direct live access to 1,556+ Evolution & Ezugi tables: Crazy Time, Lightning Roulette, Monopoly Live, Blackjack, Baccarat & Slots.
            </div>
          </div>
          <button
            onClick={() => {
              handleOpenGame({
                eventId: 'EVOLUTION-LOBBY',
                eventName: 'Evolution Gaming Live Lobby',
                companyName: 'INTERNATIONAL'
              });
            }}
            style={{
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
            }}
          >
            LAUNCH FULL EVOLUTION LOBBY ➔
          </button>
        </div>
      )}

      {/* Grid of Game Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#94a3b8' }}>
          <RefreshCw size={32} className="live-indicator" style={{ margin: '0 auto 12px', color: '#10b981' }} />
          <p style={{ fontSize: '14px', fontWeight: 600 }}>Loading Games Catalog...</p>
        </div>
      ) : displayList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          No games found matching "{searchQuery}".
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '20px'
        }}>
          {displayList.slice(0, 100).map((game, idx) => {
            const cover = COVER_MAP[game.eventId] || {};
            const displayImg = cover.image || game.image || '/casino_images/20-20teenpatti.jpg';
            const displayName = cover.name || game.eventName?.toUpperCase() || 'CASINO GAME';
            const providerName = game.companyName || (game.eventId.startsWith('EVOLUTION') ? 'EVOLUTION' : game.eventId.startsWith('EZUGI') ? 'EZUGI' : 'NICE444');

            return (
              <div
                key={game.eventId || idx}
                onClick={() => handleOpenGame(game)}
                style={{
                  background: '#141414',
                  borderRadius: '14px',
                  border: '1px solid #222222',
                  overflow: 'hidden',
                  position: 'relative',
                  height: '320px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  transition: 'transform 0.2s, border-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = activeCategory === 'UNIVERSE' ? '#10b981' : activeCategory === 'INTERNATIONAL' ? '#38bdf8' : '#f59e0b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#222222';
                }}
              >
                {/* Background Image */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${displayImg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'brightness(0.92)'
                }} />

                {/* Top Badge: Provider Tag */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(4px)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {providerName}
                  </span>
                </div>

                {/* Dark Vignette Gradient */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.85) 85%, rgba(0,0,0,0.98) 100%)'
                }} />

                {/* Card Bottom Content */}
                <div style={{
                  position: 'relative',
                  zIndex: 2,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 900,
                    color: '#ffffff',
                    letterSpacing: '-0.3px',
                    textTransform: 'uppercase',
                    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                    lineHeight: '1.2'
                  }}>
                    {displayName}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{
                      background: activeCategory === 'SLOTS' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                      border: activeCategory === 'SLOTS' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(16, 185, 129, 0.5)',
                      color: activeCategory === 'SLOTS' ? '#fbbf24' : '#34d399',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ width: '6px', height: '6px', background: 'currentColor', borderRadius: '50%' }}></span>
                      {activeCategory === 'SLOTS' ? 'SLOT' : 'LIVE'}
                    </span>

                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                      PLAY ➔
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. Real Live Native Universe Casino Modal */}
      {activeUniverseGame && (
        <CustomCasinoGameView
          gameId={activeUniverseGame.eventId || '99.0010'}
          gameName={activeUniverseGame.eventName}
          onClose={() => setActiveUniverseGame(null)}
        />
      )}

      {/* 2. International & Slot Game Launcher Modal */}
      {activeIntlGame && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.88)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '960px',
            height: '85vh',
            backgroundColor: '#0f172a',
            borderRadius: '12px',
            border: '1px solid #334155',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0,0,0,0.8)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '12px 18px',
              backgroundColor: '#090d16',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #1e293b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  {activeIntlGame.companyName || 'CASINO'}
                </span>
                <h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 800, margin: 0 }}>
                  {activeIntlGame.eventName}
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCustomSessionOpen(!customSessionOpen)}
                  style={{
                    background: '#334155',
                    color: '#cbd5e1',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Update Evolution Session Link"
                >
                  🔗 Session Link
                </button>
                {launchUrl && (
                  <button
                    onClick={() => window.open(launchUrl, '_blank', 'width=1200,height=800')}
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>OPEN FULLSCREEN</span>
                    <ExternalLink size={13} />
                  </button>
                )}
                <button
                  onClick={() => { setActiveIntlGame(null); setLaunchUrl(''); setCustomSessionOpen(false); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Quick Session Link Bar if toggled */}
            {customSessionOpen && (
              <div style={{
                padding: '10px 18px',
                backgroundColor: '#1e293b',
                display: 'flex',
                gap: '8px',
                borderBottom: '1px solid #334155'
              }}>
                <input
                  type="text"
                  placeholder="Paste fresh Evolution Launch URL (e.g. https://evo.wcentertainments.com/...ua_launch_id=...)..."
                  value={customSessionInput}
                  onChange={(e) => setCustomSessionInput(e.target.value)}
                  style={{
                    flex: 1,
                    backgroundColor: '#090d16',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: '#ffffff',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleUpdateSessionUrl}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Update & Load
                </button>
              </div>
            )}

            {/* Modal Body / Game Frame */}
            <div style={{ flex: 1, position: 'relative', backgroundColor: '#020617' }}>
              {launchLoading ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={36} className="live-indicator" style={{ color: '#10b981', marginBottom: '12px' }} />
                  <p style={{ fontWeight: 700, fontSize: '15px' }}>Creating Authorized Game Session...</p>
                </div>
              ) : launchError ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid #ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}>
                    <Shield size={32} style={{ color: '#ef4444' }} />
                  </div>
                  <h3 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>
                    International Permission Required
                  </h3>
                  <p style={{ color: '#f87171', fontSize: '13px', maxWidth: '520px', lineHeight: '1.5', marginBottom: '16px' }}>
                    {launchError}
                  </p>
                  <div style={{
                    backgroundColor: '#1e293b',
                    padding: '12px 18px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    maxWidth: '520px',
                    fontSize: '12px',
                    color: '#94a3b8',
                    textAlign: 'left',
                    lineHeight: '1.6'
                  }}>
                    <strong style={{ color: '#cbd5e1' }}>Note:</strong> Nice444 account <code style={{ color: '#38bdf8' }}>demo52</code> is a demo account with <code style={{ color: '#ef4444' }}>isInternationalCasino: false</code>. Evolution & Ezugi tables require an account activated by your upline agent with international privileges.
                  </div>
                  {launchUrl && (
                    <button
                      onClick={() => window.open(launchUrl, '_blank', 'width=1200,height=800')}
                      style={{
                        marginTop: '20px',
                        background: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 18px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Try Opening Direct Game Link In New Window ➔
                    </button>
                  )}
                </div>
              ) : launchUrl ? (
                <iframe
                  src={launchUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  title={activeIntlGame.eventName}
                  allow="autoplay; fullscreen"
                />
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                  <p style={{ color: '#ef4444', fontWeight: 700 }}>Unable to create game session for this table.</p>
                  <p style={{ color: '#94a3b8', fontSize: '12px' }}>Please ensure you are connected to the exchange network.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
