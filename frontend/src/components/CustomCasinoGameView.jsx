import React, { useState, useEffect, useRef } from 'react';
import { X, Maximize2, Minimize2, RefreshCw, Trophy, GlassWater, ShieldAlert, AlertCircle, Info } from 'lucide-react';
import axios from 'axios';

// Helper to resolve card image path
const getCardImg = (val) => {
  if (!val || val === '0' || val === '1') {
    return '/card/0.png';
  }
  // If card is like "HA_" or "H8_" or "10"
  const clean = String(val).trim();
  return `/card/${clean}.png`;
};

export default function CustomCasinoGameView({ gameId, gameName, onClose }) {
  const [oddsData, setOddsData] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [watchUrl, setWatchUrl] = useState('');

  const containerRef = useRef(null);
  const timerRef = useRef(null);

  // 1. Fetch Decrypted Recent Results
  const fetchRecentResults = async () => {
    try {
      const res = await axios.get(`/api/casino/results/${gameId}`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setResults(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching recent results:', err);
    }
  };

  // 2. Fetch Initial Cached Live Odds
  const fetchInitialOdds = async () => {
    try {
      const res = await axios.get(`/api/casino/live-odds/${gameId}`);
      if (res.data?.success && res.data?.data) {
        setOddsData(res.data.data);
        if (res.data.data.leftSec !== undefined) {
          setTimeLeft(res.data.data.leftSec);
        }
      }
    } catch (err) {
      console.warn('Initial odds fetch error:', err.message);
    }
  };

  // 3. Fetch Real Live Casino Dealer Watch Link (Native Nice444 Stream)
  const fetchWatchUrl = async () => {
    try {
      const res = await axios.get(`/api/casino/watch-link/${gameId}`);
      if (res.data?.success && res.data?.url) {
        setWatchUrl(res.data.url);
      }
    } catch (err) {
      console.warn('Watch link fetch error:', err.message);
    }
  };

  // 4. Poll Real-Time Odds & Results via REST API (1000ms)
  useEffect(() => {
    fetchRecentResults();
    fetchWatchUrl();

    let isMounted = true;
    let lastFetchedRoundId = null;
    let lastResultsFetchTime = Date.now();

    const pollCasino = async () => {
      try {
        const res = await axios.get(`/api/casino/live-odds/${gameId}`);
        if (isMounted && res.data?.success && res.data?.data) {
          const data = res.data.data;
          setOddsData(data);
          if (typeof data.leftSec === 'number') {
            setTimeLeft(data.leftSec);
          }
          const now = Date.now();
          if (
            (data.roundId && data.roundId !== lastFetchedRoundId) ||
            now - lastResultsFetchTime > 15000
          ) {
            lastFetchedRoundId = data.roundId;
            lastResultsFetchTime = now;
            fetchRecentResults();
          }
        }
      } catch (err) {}
    };

    pollCasino();
    const interval = setInterval(pollCasino, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [gameId]);

  // 4. Smooth Local Timer countdown between server tick updates
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Helper to open official authorized stream window
  const handleOpenOfficialStream = async () => {
    try {
      const res = await axios.post('/api/casino/launch-url', { eventId: gameId });
      if (res.data?.launchUrl) {
        window.open(res.data.launchUrl, 'NiceLiveStream', 'width=1024,height=720,menubar=no,toolbar=no,location=no');
      }
    } catch (e) {
      console.error('Launch url error:', e);
    }
  };

  // Extract cards dynamically from live odds data (supports 32 Cards, Dragon Tiger, Lucky 7, Teen Patti, etc.)
  const cardsArr = oddsData?.cardsArr || {};
  const cardEntries = Object.entries(cardsArr).filter(([k]) => k !== 'eventId' && k !== 'roundId');

  const getCardsList = (val) => {
    if (!val) return ['0'];
    if (Array.isArray(val)) {
      return val.length > 0 ? val : ['0'];
    }
    if (typeof val === 'object') {
      const cards = [val.card_1, val.card_2, val.card_3].filter(Boolean);
      return cards.length > 0 ? cards : ['0'];
    }
    if (typeof val === 'string') {
      return [val];
    }
    return ['0'];
  };

  // Global suspension condition
  const isTableSuspended =
    oddsData?.status === 'SUSPEND' ||
    oddsData?.roundStatus === 'SUSPENDED' ||
    timeLeft <= 2;

  const marketList = oddsData?.marketArr || [];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        overflowY: 'auto'
      }}
    >
      {/* Main Table Modal Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#0f172a',
          borderRadius: '12px',
          border: '1px solid #334155',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '94vh'
        }}
      >
        {/* Top Header Bar matching user UI */}
        <div
          style={{
            backgroundColor: '#090d16',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1e293b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isTableSuspended ? '#ef4444' : '#10b981',
                boxShadow: isTableSuspended ? '0 0 8px #ef4444' : '0 0 8px #10b981'
              }}
            />
            <h2
              style={{
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '15px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                margin: 0
              }}
            >
              {gameName || 'CASINO TABLE'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleOpenOfficialStream}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.4)'
              }}
              title="Open Official Live Stream"
            >
              <span>📺 LIVE TV</span>
            </button>
            <button
              onClick={() => setRulesOpen(!rulesOpen)}
              style={{
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Rules
            </button>
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px'
              }}
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                padding: '4px'
              }}
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Game Canvas */}
        <div style={{ overflowY: 'auto', flex: 1, backgroundColor: '#020617' }}>
          {/* Rules Dropdown if toggled */}
          {rulesOpen && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#1e293b',
                fontSize: '12px',
                color: '#94a3b8',
                borderBottom: '1px solid #334155'
              }}
            >
              <p style={{ margin: 0, fontWeight: 600, color: '#f1f5f9' }}>
                Standard 3-Card rules apply. Bets are accepted when the countdown timer is active. High card beats low card. Pairs, flushes, and straights payout per designated market rates.
              </p>
            </div>
          )}

          {/* Video & Dealer Table Board (16:9) */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              paddingTop: '56.25%', // 16:9 Aspect Ratio
              backgroundColor: '#000000',
              overflow: 'hidden'
            }}
          >
            {/* Live TV Video Dealer Feed from Nice444 Stream via Stream-Proxy */}
            <iframe
              src={`/api/casino/stream-proxy/${gameId}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                zIndex: 2,
              }}
              title="Nice444 Live Dealer Stream"
              allow="autoplay; fullscreen"
            />

            {/* Backdrop Center - Universe Casino Logo when stream is connecting */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'radial-gradient(circle, #1a0b2e 0%, #050508 100%)',
                zIndex: 1
              }}
            >
              <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '2px solid rgba(168, 85, 247, 0.4)',
                  animation: 'spin 12s linear infinite'
                }} />
                <div style={{
                  position: 'absolute',
                  inset: '8px',
                  borderRadius: '50%',
                  border: '2px dashed rgba(236, 72, 153, 0.5)',
                  animation: 'spin 8s linear infinite reverse'
                }} />
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 16px rgba(236, 72, 153, 0.6)'
                }}>
                  <span style={{ fontSize: '20px' }}>🎲</span>
                </div>
              </div>
              <div style={{
                color: '#ec4899',
                fontWeight: 900,
                fontSize: '15px',
                letterSpacing: '2px',
                marginTop: '8px',
                textTransform: 'uppercase'
              }}>
                Universe
              </div>
              <div style={{
                color: '#94a3b8',
                fontWeight: 700,
                fontSize: '9px',
                letterSpacing: '3px',
                textTransform: 'uppercase'
              }}>
                {watchUrl ? 'Connecting Live Stream...' : 'Casino'}
              </div>
            </div>

            {/* Top-Left: Live Dealt Cards & Round ID Overlay (Dynamic for all games: 32 Cards, Dragon Tiger, Lucky 7, etc.) */}
            <div
              style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.82)',
                backdropFilter: 'blur(6px)',
                borderRadius: '6px',
                padding: '6px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                zIndex: 10,
                maxHeight: '85%',
                overflowY: 'auto'
              }}
            >
              <div style={{ color: '#ffffff', fontSize: '9px', fontWeight: 800, letterSpacing: '0.5px' }}>
                RID: {oddsData?.roundId || 'CONNECTING...'}
              </div>

              {cardEntries.length > 0 ? (
                cardEntries.map(([key, val], idx) => {
                  const label = key.replace(/_/g, ' ');
                  const cards = getCardsList(val);
                  const isJoker = key.toUpperCase() === 'JOKER';
                  const labelColor = isJoker
                    ? '#f59e0b'
                    : idx === 0
                    ? '#38bdf8'
                    : idx === 1
                    ? '#f472b6'
                    : idx === 2
                    ? '#34d399'
                    : '#a78bfa';

                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: labelColor, fontSize: '10px', fontWeight: 800, minWidth: '55px' }}>
                        {label}
                      </span>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {cards.map((c, i) => (
                          <img
                            key={i}
                            src={getCardImg(c)}
                            alt={`${key}-${i}`}
                            style={{ width: '22px', height: '32px', borderRadius: '2px', objectFit: 'contain' }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#38bdf8', fontSize: '10px', fontWeight: 800 }}>
                    WAITING FOR ROUND...
                  </span>
                </div>
              )}
            </div>

            {/* Top-Right: Circular Countdown Timer Wheel */}
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '12px',
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                border: `3px solid ${timeLeft <= 5 ? '#ef4444' : '#10b981'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: timeLeft <= 5 ? '#ef4444' : '#ffffff',
                fontWeight: 900,
                fontSize: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                zIndex: 10
              }}
            >
              {timeLeft}
            </div>
          </div>

          {/* Betting Markets Container */}
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {marketList.length > 0 ? (
              marketList.map((m, mIdx) => {
                const isMarketSuspended =
                  isTableSuspended ||
                  m.runners?.every((r) => r.status === 'SUSPEND');

                return (
                  <div
                    key={m.marketId || mIdx}
                    style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid #334155'
                    }}
                  >
                    {/* Market Header */}
                    <div
                      style={{
                        backgroundColor: '#0f172a',
                        padding: '6px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#cbd5e1'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ textTransform: 'uppercase', color: '#ffffff', fontWeight: 800, fontSize: '12px' }}>
                          {m.marketName || 'WINNER'}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>ⓘ</span>
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                        Min/Max: {m.min || 100} - {m.max || 500000}
                      </span>
                    </div>

                    {/* Runners Odds Row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: m.runners?.length > 4 ? 'repeat(auto-fit, minmax(105px, 1fr))' : `repeat(${m.runners?.length || 2}, 1fr)`,
                        gap: '6px',
                        padding: '6px',
                        position: 'relative'
                      }}
                    >
                      {/* Suspended Overlay */}
                      {isMarketSuspended && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(15, 23, 42, 0.88)',
                            backdropFilter: 'blur(2px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ef4444',
                            fontWeight: 900,
                            fontSize: '14px',
                            letterSpacing: '1px',
                            zIndex: 5
                          }}
                        >
                          SUSPENDED
                        </div>
                      )}

                      {m.runners?.map((r, rIdx) => {
                        const backPrice = r.price?.back?.[0]?.price ?? 1.98;
                        const backSize = r.price?.back?.[0]?.size ?? 100000;
                        const runnerName =
                          m.runnersName?.[String(r.selectionId)] ||
                          r.runnerName ||
                          r.name ||
                          (rIdx === 0 ? 'PLAYER A' : rIdx === 1 ? 'PLAYER B' : `OPTION ${rIdx + 1}`);

                        return (
                          <div
                            key={r.selectionId || rIdx}
                            style={{
                              backgroundColor: '#72bbef',
                              borderRadius: '4px',
                              padding: '8px 4px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                              transition: 'transform 0.1s'
                            }}
                          >
                            <span
                              style={{
                                color: '#0f172a',
                                fontWeight: 800,
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                marginBottom: '2px'
                              }}
                            >
                              {runnerName}
                            </span>
                            <span
                              style={{
                                color: '#020617',
                                fontWeight: 900,
                                fontSize: '16px',
                                lineHeight: '1.1'
                              }}
                            >
                              {backPrice}
                            </span>
                            <span
                              style={{
                                color: '#1e293b',
                                fontSize: '10px',
                                fontWeight: 700
                              }}
                            >
                              {Number(backSize).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              // Clean Loader while live markets stream connects
              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '6px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #334155'
                }}
              >
                <RefreshCw size={24} className="live-indicator" style={{ color: '#38bdf8', marginBottom: '8px' }} />
                <span style={{ color: '#cbd5e1', fontWeight: 800, fontSize: '13px' }}>
                  Loading Real-Time Table Markets...
                </span>
                <span style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                  Streaming live rates, runner sizes & card calculations
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Results Strip matching screenshot */}
        <div
          style={{
            backgroundColor: '#000000',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderTop: '1px solid #1e293b'
          }}
        >
          <span
            style={{
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            Recent Result
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              flex: 1
            }}
          >
            {results.map((r, i) => {
              const isWinnerA = r.winner === 'A';
              const isWinnerB = r.winner === 'B';
              const bg = isWinnerA ? '#72bbef' : isWinnerB ? '#f9a9ba' : '#facc15';

              return (
                <button
                  key={r.roundId || i}
                  onClick={() => {
                    setSelectedResult(r);
                    setShowResultModal(true);
                  }}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: bg,
                    color: '#000000',
                    fontWeight: 900,
                    fontSize: '12px',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'transform 0.15s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
                  }}
                  title={`Round ${r.roundId}: Winner ${r.winner}`}
                >
                  {r.winner || '?'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Round Result Detailed Modal (Exact match to user screenshot) */}
      {showResultModal && selectedResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '380px',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
              color: '#0f172a'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800 }}>
                {gameName || '20-20 TEEN PATTI'}
              </h3>
              <button
                onClick={() => setShowResultModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Round Id */}
            <div
              style={{
                textAlign: 'right',
                padding: '8px 14px 4px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#334155'
              }}
            >
              Round Id: {selectedResult.roundId}
            </div>

            {/* Cards Showcase & Winner Badge */}
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {/* Player A Dealt Cards */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '4px' }}>Player A</div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  {['card_1', 'card_2', 'card_3'].map((ck) => {
                    const cardVal = selectedResult.cards?.PLAYER_A?.[ck];
                    return (
                      <img
                        key={ck}
                        src={getCardImg(cardVal)}
                        alt={`A-${ck}`}
                        style={{ width: '42px', height: '60px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Winner Green Pill */}
              <div
                style={{
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  padding: '4px 18px',
                  borderRadius: '4px',
                  fontWeight: 900,
                  fontSize: '12px',
                  margin: '4px 0',
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.4)'
                }}
              >
                Winner: Player {selectedResult.winner}
              </div>

              {/* Player B Dealt Cards */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '4px' }}>Player B</div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  {['card_1', 'card_2', 'card_3'].map((ck) => {
                    const cardVal = selectedResult.cards?.PLAYER_B?.[ck];
                    return (
                      <img
                        key={ck}
                        src={getCardImg(cardVal)}
                        alt={`B-${ck}`}
                        style={{ width: '42px', height: '60px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Market Outcomes List */}
            <div style={{ borderTop: '1px solid #e2e8f0', padding: '8px 14px' }}>
              {selectedResult.results?.map((resItem, idx) => (
                <div
                  key={resItem.marketId || idx}
                  style={{
                    padding: '6px 0',
                    borderBottom: idx !== selectedResult.results.length - 1 ? '1px solid #f1f5f9' : 'none',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '11px', color: '#0f172a', marginBottom: '2px' }}>
                    {resItem.marketName}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-around',
                      fontSize: '11px',
                      color: '#475569',
                      fontWeight: 600
                    }}
                  >
                    {resItem.runners?.map((run, rIdx) => {
                      const rName =
                        resItem.runnersName?.[run.selectionId] ||
                        (rIdx === 0 ? 'PLAYER A' : 'PLAYER B');
                      const isWin = run.result === 'WINNER';

                      return (
                        <div key={run.selectionId || rIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{rName}</span>
                          <span>-</span>
                          {isWin ? (
                            <span style={{ color: '#16a34a', fontWeight: 800 }}>🏆 WIN</span>
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: 800 }}>🍸 LOSS</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

