import React, { useState, useEffect, useRef } from 'react';
import { X, Maximize2, Minimize2, RefreshCw, Trophy, GlassWater, ShieldAlert, AlertCircle, Info, Lock } from 'lucide-react';
import axios from 'axios';

// Helper to resolve card image path strictly according to API values
const getCardImg = (val) => {
  if (!val || val === '0' || val === 'null' || val === '-' || val === 'undefined') {
    return '/card/0.png';
  }
  let clean = String(val).trim().toUpperCase();

  // If number 1..13 (e.g. Lucky 7 numbered card assets)
  if (/^([1-9]|1[0-3])$/.test(clean)) {
    return `/card/${clean}.jpeg`;
  }

  // Ensure suit + rank has trailing underscore matching static assets
  if (!clean.endsWith('_') && /^[CDHS][0-9AKQJ]+$/i.test(clean)) {
    clean += '_';
  }
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
  const [dtlTab, setDtlTab] = useState('DRAGON'); // 'DRAGON' | 'TIGER' | 'LION' for DTL games

  const containerRef = useRef(null);
  const targetEndRef = useRef(0);
  const lastRoundIdRef = useRef(null);

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

  // 4. Poll Real-Time Odds & Results via REST API (1000ms exact socket sync)
  useEffect(() => {
    fetchRecentResults();
    fetchWatchUrl();

    let isMounted = true;
    let lastFetchedRoundId = null;
    let lastResultsFetchTime = Date.now();

    const pollCasino = async () => {
      try {
        const res = await axios.get(`/api/casino/live-odds/${gameId}?_t=${Date.now()}`);
        if (isMounted && res.data?.success && res.data?.data) {
          const data = res.data.data;
          setOddsData(data);

          const serverSec = Number(data.leftSec ?? 0);
          const isRoundOver =
            data.roundStatus === 'RESULT_DECLARED' ||
            data.roundStatus === 'CARD_SCAN' ||
            data.roundStatus === 'SUSPEND' ||
            data.status === 'SUSPEND' ||
            data.status === 'SUSPENDED' ||
            serverSec <= 0;

          if (isRoundOver) {
            targetEndRef.current = 0;
            setTimeLeft(0);
          } else {
            // New round started or local timer was 0
            if (data.roundId !== lastRoundIdRef.current || targetEndRef.current === 0) {
              lastRoundIdRef.current = data.roundId;
              targetEndRef.current = Date.now() + serverSec * 1000;
              setTimeLeft(serverSec);
            } else {
              // Drift correction if local timer deviates by > 1 second
              const currentRem = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
              if (Math.abs(currentRem - serverSec) > 1) {
                targetEndRef.current = Date.now() + serverSec * 1000;
                setTimeLeft(serverSec);
              }
            }
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
    const interval = setInterval(pollCasino, 700);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [gameId]);

  // High-precision smooth countdown ticking every 200ms based on wall-clock target timestamp
  useEffect(() => {
    const timer = setInterval(() => {
      if (targetEndRef.current > 0) {
        const remaining = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
        setTimeLeft(remaining);
      }
    }, 200);
    return () => clearInterval(timer);
  }, []);

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

  // Template layout generator so cards are ALWAYS shown face-down ('0') even before first socket packet
  const getDefaultCardEntries = (name = '', id = '') => {
    const gName = String(name || '').toUpperCase();
    const gId = String(id || '');

    if (
      gName.includes('DTL') ||
      gId === '99.0041' ||
      gId === '99.0004'
    ) {
      return [
        ['DRAGON', ['0']],
        ['TIGER', ['0']],
        ['LION', ['0']]
      ];
    }
    if (
      gName.includes('TEEN PATTI') ||
      gId === '99.0010' ||
      gId === '99.0013' ||
      gId === '99.0014' ||
      gId === '99.0015' ||
      gId === '99.0016'
    ) {
      return [
        ['PLAYER_A', ['0', '0', '0']],
        ['PLAYER_B', ['0', '0', '0']]
      ];
    }
    if (
      gName.includes('DRAGON') ||
      gId === '99.0018' ||
      gId === '99.0019' ||
      gId === '99.0020' ||
      gId === '99.0021'
    ) {
      return [
        ['DRAGON', ['0']],
        ['TIGER', ['0']]
      ];
    }
    if (
      gName.includes('LUCKY') ||
      gId === '99.0030' ||
      gId === '99.0031' ||
      gId === '99.0032'
    ) {
      return [['CARD', ['0']]];
    }
    if (gName.includes('32 CARDS') || gId === '99.0022' || gId === '99.0023') {
      return [
        ['PLAYER_8', ['0']],
        ['PLAYER_9', ['0']],
        ['PLAYER_10', ['0']],
        ['PLAYER_11', ['0']]
      ];
    }
    if (gName.includes('ANDAR') || gId === '99.0025' || gId === '99.0034') {
      return [
        ['ANDAR', ['0']],
        ['BAHAR', ['0']]
      ];
    }
    if (gName.includes('BACCARAT') || gId === '99.0001' || gId === '99.0002') {
      return [
        ['PLAYER', ['0', '0']],
        ['BANKER', ['0', '0']]
      ];
    }
    return [
      ['PLAYER_A', ['0']],
      ['PLAYER_B', ['0']]
    ];
  };

  // Extract cards dynamically from live odds data
  const rawCardsArr = oddsData?.cardsArr || {};
  let cardEntries = Object.entries(rawCardsArr).filter(
    ([k]) => k !== 'eventId' && k !== 'roundId'
  );

  // Guarantee card back display so "WAITING FOR ROUND..." is NEVER shown
  if (cardEntries.length === 0) {
    cardEntries = getDefaultCardEntries(gameName, gameId);
  }

  // Extract real cards directly from live scraped API data
  // When card is "0" or not yet dealt, getCardImg renders /card/0.png (Card Back)
  // As dealer flips each card in stream and API responds, that specific card flips open
  const getCardsList = (val) => {
    if (!val) return ['0'];
    let list = [];
    if (Array.isArray(val)) {
      list = val.length > 0 ? val : ['0'];
    } else if (typeof val === 'object') {
      list = [val.card_1, val.card_2, val.card_3, val.card_4, val.card_5, val.card_6].filter(
        (c) => c !== undefined && c !== null
      );
    } else if (typeof val === 'string') {
      list = [val];
    }
    if (list.length === 0) list = ['0'];
    return list;
  };

  const getWinnerBadge = (winner) => {
    if (!winner) return { label: '?', bg: '#facc15' };
    const w = String(winner).toUpperCase().trim();
    if (w === 'L' || w === 'LION') {
      return { label: 'L', bg: '#facc15' }; // Lion (Yellow)
    }
    if (w === 'D' || w === 'DRAGON') {
      return { label: 'D', bg: '#72bbef' }; // Dragon (Blue)
    }
    if (w === 'T' || w === 'TIGER') {
      return { label: 'T', bg: '#f97316' }; // Tiger (Orange)
    }
    if (w === 'A' || w === 'PLAYER A' || w === 'H' || w === 'LOW') {
      return { label: w.startsWith('P') ? 'A' : w[0], bg: '#72bbef' };
    }
    if (w === 'B' || w === 'PLAYER B' || w === 'HIGH') {
      return { label: w.startsWith('P') ? 'B' : w[0], bg: '#f9a9ba' };
    }
    if (w.includes('PLAYER_') || w.startsWith('PLAYER ')) {
      const num = w.replace(/[^0-9]/g, '');
      return { label: num || 'W', bg: '#c084fc' };
    }
    if (w === 'TIE') {
      return { label: 'T', bg: '#10b981' };
    }
    return { label: w.slice(0, 2), bg: '#10b981' };
  };

  // Live API-driven suspension condition
  const isTableSuspended =
    oddsData?.status === 'SUSPEND' ||
    oddsData?.status === 'SUSPENDED' ||
    oddsData?.roundStatus === 'SUSPEND' ||
    oddsData?.roundStatus === 'SUSPENDED' ||
    oddsData?.roundStatus === 'RESULT_DECLARED' ||
    (oddsData?.roundStatus && oddsData?.roundStatus !== 'PLACE_THE_BET') ||
    timeLeft <= 0;

  const getDefaultMarketsForTable = () => {
    const name = (gameName || '').toUpperCase();
    const id = String(gameId || '');

    if (name.includes('DTL') || id === '99.0041' || id === '99.0004') {
      return [
        {
          marketId: 'winner_def',
          marketName: 'WINNER',
          min: 100,
          max: 500000,
          runners: [
            { selectionId: '1', runnerName: 'DRAGON', status: 'OPEN', price: { back: [{ price: 2.94, size: 250000 }] } },
            { selectionId: '2', runnerName: 'TIGER', status: 'OPEN', price: { back: [{ price: 2.94, size: 250000 }] } },
            { selectionId: '3', runnerName: 'LION', status: 'OPEN', price: { back: [{ price: 2.94, size: 250000 }] } }
          ]
        }
      ];
    }

    if (name.includes('LUCKY 7') || id === '99.0030' || id === '99.0031' || id === '99.0032') {
      return [
        {
          marketId: 'winner_def',
          marketName: 'WINNER',
          min: 100,
          max: 100000,
          runners: [
            { selectionId: '1', runnerName: 'LOW CARD ( A to 6 )', status: 'OPEN', price: { back: [{ price: 2.0, size: 500000 }] } },
            { selectionId: '2', runnerName: 'HIGH CARD ( 8 to K )', status: 'OPEN', price: { back: [{ price: 2.0, size: 500000 }] } }
          ]
        },
        {
          marketId: 'oddeven_def',
          marketName: 'LUCKY ODD/EVEN',
          min: 100,
          max: 100000,
          runners: [
            { selectionId: '3', runnerName: 'EVEN', status: 'OPEN', price: { back: [{ price: 2.14, size: 300000 }] } },
            { selectionId: '4', runnerName: 'ODD', status: 'OPEN', price: { back: [{ price: 1.81, size: 300000 }] } }
          ]
        },
        {
          marketId: 'color_def',
          marketName: 'LUCKY COLOR',
          min: 100,
          max: 100000,
          runners: [
            { selectionId: '5', runnerName: 'RED', status: 'OPEN', price: { back: [{ price: 1.95, size: 300000 }] } },
            { selectionId: '6', runnerName: 'BLACK', status: 'OPEN', price: { back: [{ price: 1.95, size: 300000 }] } }
          ]
        }
      ];
    }

    if (name.includes('DRAGON') && name.includes('TIGER')) {
      return [
        {
          marketId: 'winner_def',
          marketName: 'WINNER',
          min: 100,
          max: 500000,
          runners: [
            { selectionId: '1', runnerName: 'DRAGON', status: 'OPEN', price: { back: [{ price: 1.98, size: 250000 }] } },
            { selectionId: '2', runnerName: 'TIGER', status: 'OPEN', price: { back: [{ price: 1.98, size: 250000 }] } },
            { selectionId: '3', runnerName: 'TIE', status: 'OPEN', price: { back: [{ price: 10.0, size: 50000 }] } }
          ]
        }
      ];
    }

    return [
      {
        marketId: 'winner_def',
        marketName: 'WINNER',
        min: 100,
        max: 500000,
        runners: [
          { selectionId: '1', runnerName: 'PLAYER A', status: 'OPEN', price: { back: [{ price: 1.98, size: 250000 }] } },
          { selectionId: '2', runnerName: 'PLAYER B', status: 'OPEN', price: { back: [{ price: 1.98, size: 250000 }] } }
        ]
      }
    ];
  };

  const isDTL =
    gameName?.toUpperCase().includes('DTL') ||
    gameId === '99.0041' ||
    gameId === '99.0004';

  const marketList =
    oddsData?.marketArr && oddsData.marketArr.length > 0
      ? oddsData.marketArr
      : getDefaultMarketsForTable();
  const displayedMarkets = isDTL
    ? marketList.filter((m) => {
        const mName = (m.marketName || '').toUpperCase();
        return mName === 'WINNER' || mName.includes(dtlTab);
      })
    : marketList;

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

            {/* Universe Casino Planetary Orbit + 3D Dice Result Banner (Exact matching user design) */}
            {(oddsData?.roundStatus === 'RESULT_DECLARED' || oddsData?.gameResult) ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(3, 2, 8, 0.82)',
                  backdropFilter: 'blur(3px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 8,
                  pointerEvents: 'none'
                }}
              >
                <div style={{ position: 'relative', width: '220px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Outer Blue Orbit */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '180px',
                      height: '180px',
                      borderRadius: '50%',
                      border: '2.5px solid #3b82f6',
                      boxShadow: '0 0 16px rgba(59, 130, 246, 0.45)',
                      transform: 'rotate(-15deg)'
                    }}
                  >
                    <div style={{ position: 'absolute', top: '16px', right: '28px', width: '9px', height: '9px', backgroundColor: '#e2e8f0', borderRadius: '2px', border: '1px solid #94a3b8', transform: 'rotate(25deg)' }} />
                  </div>

                  {/* Middle Magenta/Pink Orbit */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '146px',
                      height: '146px',
                      borderRadius: '50%',
                      border: '2.5px solid #ec4899',
                      boxShadow: '0 0 16px rgba(236, 72, 153, 0.45)',
                      transform: 'rotate(25deg)'
                    }}
                  >
                    <div style={{ position: 'absolute', bottom: '12px', left: '24px', width: '9px', height: '9px', backgroundColor: '#e2e8f0', borderRadius: '2px', border: '1px solid #94a3b8', transform: 'rotate(-15deg)' }} />
                  </div>

                  {/* Inner Yellow Orbit */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '116px',
                      height: '116px',
                      borderRadius: '50%',
                      border: '2px solid #eab308',
                      boxShadow: '0 0 12px rgba(234, 179, 8, 0.4)',
                      transform: 'rotate(-35deg)'
                    }}
                  >
                    <div style={{ position: 'absolute', bottom: '10px', right: '22px', width: '8px', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '2px', border: '1px solid #94a3b8' }} />
                  </div>

                  {/* Glowing Purple Core Aura */}
                  <div
                    style={{
                      position: 'absolute',
                      width: '86px',
                      height: '86px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #9333ea 0%, #ec4899 65%, transparent 100%)',
                      opacity: 0.9,
                      boxShadow: '0 0 25px rgba(168, 85, 247, 0.7)'
                    }}
                  />

                  {/* 3D Casino Dice SVG */}
                  <div style={{ position: 'relative', zIndex: 3, marginTop: '-14px' }}>
                    <svg width="68" height="68" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M50 15 L82 32 L50 49 L18 32 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round"/>
                      <circle cx="34" cy="28" r="3.2" fill="#0f172a"/>
                      <circle cx="50" cy="32" r="3.2" fill="#0f172a"/>
                      <circle cx="66" cy="36" r="3.2" fill="#0f172a"/>
                      <path d="M18 32 L50 49 L50 85 L18 68 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round"/>
                      <circle cx="34" cy="54" r="3.2" fill="#0f172a"/>
                      <circle cx="34" cy="68" r="3.2" fill="#0f172a"/>
                      <path d="M50 49 L82 32 L82 68 L50 85 Z" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round"/>
                      <circle cx="62" cy="52" r="3.2" fill="#0f172a"/>
                      <circle cx="70" cy="48" r="3.2" fill="#0f172a"/>
                      <circle cx="62" cy="68" r="3.2" fill="#0f172a"/>
                      <circle cx="70" cy="64" r="3.2" fill="#0f172a"/>
                    </svg>
                  </div>

                  {/* Iconic Orange Winner Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '22px',
                      zIndex: 6,
                      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      borderRadius: '22px 6px 22px 6px',
                      padding: '7px 22px',
                      boxShadow: '0 4px 18px rgba(234, 88, 12, 0.75)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span
                      style={{
                        color: '#000000',
                        fontWeight: 900,
                        fontSize: '16px',
                        letterSpacing: '0.6px',
                        textTransform: 'uppercase',
                        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}
                    >
                      {String(oddsData?.gameResult || 'PLAYER A')
                        .replace(/_/g, ' ')
                        .replace(/\bWIN\b|\bWON\b/gi, '')
                        .trim()} WIN
                    </span>
                  </div>
                </div>
              </div>
            ) : isTableSuspended ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(10, 6, 18, 0.78)',
                  backdropFilter: 'blur(3px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 8,
                  pointerEvents: 'none'
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    border: '2.5px solid #e879f9',
                    boxShadow: '0 0 16px rgba(232, 121, 249, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px'
                  }}
                >
                  <Lock size={26} color="#e879f9" />
                </div>
                <div
                  style={{
                    color: '#ffffff',
                    fontSize: '18px',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    fontFamily: 'serif, Georgia, -apple-system, sans-serif'
                  }}
                >
                  This session has been closed
                </div>
              </div>
            ) : null}

            {/* Top-Right: Circular Countdown Timer Wheel */}
            {!isTableSuspended && timeLeft > 0 && (
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
            )}
          </div>

          {/* DTL Specific Runner Tabs (Dragon | Tiger | Lion) matching user UI */}
          {isDTL && (
            <div style={{ display: 'flex', backgroundColor: '#090d16', borderBottom: '1px solid #1e293b' }}>
              {['DRAGON', 'TIGER', 'LION'].map((tab) => {
                const active = dtlTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setDtlTab(tab)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      backgroundColor: active ? '#1e293b' : 'transparent',
                      color: active ? '#ffffff' : '#94a3b8',
                      fontWeight: 800,
                      fontSize: '13px',
                      textTransform: 'capitalize',
                      border: 'none',
                      borderBottom: active ? '3px solid #eab308' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {tab.charAt(0) + tab.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          )}

          {/* Betting Markets Container */}
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {displayedMarkets.length > 0 ? (
              displayedMarkets.map((m, mIdx) => {
                const isMarketSuspended =
                  isTableSuspended ||
                  m.status === 'SUSPEND' ||
                  m.status === 'SUSPENDED' ||
                  m.runners?.every((r) => r.status === 'SUSPEND' || r.status === 'SUSPENDED');

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
                            backgroundColor: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 6,
                            pointerEvents: 'none'
                          }}
                        >
                          <span
                            style={{
                              color: '#a855f7',
                              fontWeight: 900,
                              fontSize: '18px',
                              letterSpacing: '2px',
                              textShadow: '0 1px 2px rgba(255, 255, 255, 0.85), 0 0 10px rgba(168, 85, 247, 0.5)',
                              textTransform: 'uppercase'
                            }}
                          >
                            SUSPENDED
                          </span>
                        </div>
                      )}

                      {m.runners?.map((r, rIdx) => {
                        const isRunnerSuspended =
                          isMarketSuspended ||
                          r.status === 'SUSPEND' ||
                          r.status === 'SUSPENDED';

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
                              backgroundColor: isRunnerSuspended ? '#dce8f5' : '#72bbef',
                              borderRadius: '4px',
                              padding: '8px 4px',
                              textAlign: 'center',
                              cursor: isRunnerSuspended ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                              transition: 'transform 0.1s',
                              position: 'relative',
                              opacity: 1
                            }}
                          >
                            <span
                              style={{
                                color: isRunnerSuspended ? '#64748b' : '#0f172a',
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
                                color: isRunnerSuspended ? '#475569' : '#020617',
                                fontWeight: 900,
                                fontSize: '16px',
                                lineHeight: '1.1'
                              }}
                            >
                              {backPrice}
                            </span>
                            <span
                              style={{
                                color: isRunnerSuspended ? '#94a3b8' : '#1e293b',
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
              const badge = getWinnerBadge(r.winner);

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
                    backgroundColor: badge.bg,
                    color: '#000000',
                    fontWeight: 900,
                    fontSize: '11px',
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
                  {badge.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Round Result Detailed Modal (Supports 100% of Casino Games) */}
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
              maxWidth: '420px',
              maxHeight: '90vh',
              overflowY: 'auto',
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
                {selectedResult.eventName || gameName || 'CASINO TABLE'}
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

            {/* Cards Showcase & Winner Badge (Dynamic for all games) */}
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              {/* Winner Green Pill */}
              <div
                style={{
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  padding: '5px 20px',
                  borderRadius: '20px',
                  fontWeight: 900,
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.4)'
                }}
              >
                Winner: {selectedResult.winner || 'N/A'}
              </div>

              {/* Dynamic Game Cards */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center', width: '100%' }}>
                {Object.entries(selectedResult.cards || {})
                  .filter(([k]) => k !== 'eventId' && k !== 'roundId')
                  .map(([role, val]) => {
                    const label = role.replace(/_/g, ' ');
                    let cards = [];
                    if (Array.isArray(val)) cards = val;
                    else if (typeof val === 'object') cards = [val.card_1, val.card_2, val.card_3].filter(Boolean);
                    else if (typeof val === 'string') cards = [val];

                    return (
                      <div key={role} style={{ textAlign: 'center', minWidth: '70px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '4px', textTransform: 'uppercase' }}>
                          {label}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          {cards.map((c, i) => (
                            <img
                              key={i}
                              src={getCardImg(c)}
                              alt={`${role}-${i}`}
                              style={{ width: '38px', height: '56px', borderRadius: '4px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
                  <div style={{ fontWeight: 800, fontSize: '11px', color: '#0f172a', marginBottom: '4px' }}>
                    {resItem.marketName}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      gap: '8px 16px',
                      fontSize: '11px',
                      color: '#475569',
                      fontWeight: 600
                    }}
                  >
                    {resItem.runners?.map((run, rIdx) => {
                      const rName =
                        resItem.runnersName?.[String(run.selectionId)] ||
                        run.runnerName ||
                        run.name ||
                        (rIdx === 0 ? 'OPTION 1' : 'OPTION 2');
                      const isWin = run.result === 'WINNER';

                      return (
                        <div key={run.selectionId || rIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{rName}</span>
                          <span>-</span>
                          {isWin ? (
                            <span style={{ color: '#16a34a', fontWeight: 800 }}>🏆 WIN</span>
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: 800 }}>❌ LOSS</span>
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

