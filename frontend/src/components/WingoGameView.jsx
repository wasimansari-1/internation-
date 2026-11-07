import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, Volume2, Headphones, ChevronLeft, BookOpen, Flame, Award, CheckCircle } from 'lucide-react';

const GAMES = [
  { id: 'WinGo_30S', name: 'WinGo 30sec', duration: 30 },
  { id: 'WinGo_1M', name: 'WinGo 1 Min', duration: 60 },
  { id: 'WinGo_3M', name: 'WinGo 3 Min', duration: 180 },
  { id: 'WinGo_5M', name: 'WinGo 5 Min', duration: 300 },
];

export default function WingoGameView() {
  const [selectedGame, setSelectedGame] = useState('WinGo_30S');
  const [liveData, setLiveData] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'chart' | 'my'
  const [selectedBet, setSelectedBet] = useState(null); // { type, value, multiplier }
  const [betAmount, setBetAmount] = useState(10);
  const [multiplier, setMultiplier] = useState(1);
  const [balance, setBalance] = useState(10500.0);
  const [toast, setToast] = useState(null);
  const [myBets, setMyBets] = useState([]);

  const endTimeRef = useRef(null);

  // Fetch live state from backend
  const fetchLiveState = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch(`/api/wingo/live?gameCode=${selectedGame}`);
      const data = await res.json();
      if (data.success) {
        setLiveData(data);
        if (data.current?.endTime) {
          endTimeRef.current = data.current.endTime;
          const remaining = Math.max(0, Math.round((data.current.endTime - Date.now()) / 1000));
          setCountdown(remaining);
        }
      }
    } catch (e) {
      console.error('[WinGo] Fetch error:', e);
    } finally {
      if (manual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveState();
    const interval = setInterval(fetchLiveState, 2000);
    return () => clearInterval(interval);
  }, [selectedGame]);

  // High precision 1s countdown
  useEffect(() => {
    const timer = setInterval(() => {
      if (endTimeRef.current) {
        const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining === 0) {
          // Re-fetch after draw ends
          setTimeout(fetchLiveState, 1000);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleConfirmBet = () => {
    if (!selectedBet) return;
    const totalCost = betAmount * multiplier;
    if (totalCost > balance) {
      showToast('Insufficient wallet balance!');
      return;
    }
    setBalance((prev) => prev - totalCost);
    const newBet = {
      id: Date.now(),
      period: liveData?.current?.issueNumber || '...',
      game: selectedGame,
      select: selectedBet.value,
      cost: totalCost,
      status: 'Pending',
      time: new Date().toLocaleTimeString(),
    };
    setMyBets((prev) => [newBet, ...prev]);
    showToast(`Bet Placed: ${selectedBet.value} • ₹${totalCost}`);
    setSelectedBet(null);
  };

  // Ball background colors
  const getBallStyle = (num) => {
    const n = parseInt(num, 10);
    if (n === 0) {
      return {
        background: 'linear-gradient(135deg, #fb5b5b 50%, #b659fe 50%)',
        color: '#fff',
      };
    }
    if (n === 5) {
      return {
        background: 'linear-gradient(135deg, #18b660 50%, #b659fe 50%)',
        color: '#fff',
      };
    }
    if ([1, 3, 7, 9].includes(n)) {
      return {
        background: 'linear-gradient(135deg, #18b660 0%, #11994e 100%)',
        color: '#fff',
      };
    }
    return {
      background: 'linear-gradient(135deg, #fb5b5b 0%, #e03b3b 100%)',
      color: '#fff',
    };
  };

  // Split countdown seconds into [min0, min1, sec0, sec1]
  const m = Math.floor(countdown / 60);
  const s = countdown % 60;
  const digits = [
    Math.floor(m / 10),
    m % 10,
    Math.floor(s / 10),
    s % 10,
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#333842',
      display: 'flex',
      justifyContent: 'center',
      padding: '0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }}>
      {/* 91 CLUB Mobile Shell Container */}
      <div style={{
        maxWidth: '430px',
        width: '100%',
        backgroundColor: '#f6f7fb',
        minHeight: '100vh',
        boxShadow: '0 0 35px rgba(0,0,0,0.4)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: '40px',
      }}>
        {/* Toast Notification */}
        {toast && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '25px',
            fontSize: '13px',
            fontWeight: 600,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}>
            <CheckCircle size={16} color="#18b660" />
            {toast}
          </div>
        )}

        {/* 1. Header with Red Curve Background */}
        <div style={{
          background: 'linear-gradient(180deg, #f95959 0%, #ff7171 70%, #f6f7fb 100%)',
          padding: '14px 16px 20px 16px',
          borderBottomLeftRadius: '24px',
          borderBottomRightLeftRadius: '24px',
        }}>
          {/* Top Bar (91 CLUB Branding) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#ffffff',
            marginBottom: '16px',
          }}>
            <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
              <ChevronLeft size={24} />
            </button>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '22px',
              fontWeight: 900,
              letterSpacing: '-0.5px',
            }}>
              <span style={{
                background: '#fff',
                color: '#f95959',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 900,
              }}>91</span>
              CLUB
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Headphones size={20} style={{ cursor: 'pointer' }} />
              <Volume2 size={20} style={{ cursor: 'pointer' }} />
            </div>
          </div>

          {/* Wallet Balance Card */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '18px 20px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ fontSize: '26px', fontWeight: 900, color: '#1e2638' }}>
                ₹{balance.toFixed(2)}
              </span>
              <button
                onClick={() => fetchLiveState(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ba4b5',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <RotateCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '13px',
              color: '#8e96a4',
              marginTop: '4px',
              marginBottom: '16px',
            }}>
              <span>👛</span> Wallet balance
            </div>

            {/* Withdraw & Deposit Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <button style={{
                backgroundColor: '#f95959',
                color: '#ffffff',
                border: 'none',
                borderRadius: '30px',
                padding: '10px 0',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(249, 89, 89, 0.3)',
              }}>
                Withdraw
              </button>
              <button style={{
                backgroundColor: '#20b562',
                color: '#ffffff',
                border: 'none',
                borderRadius: '30px',
                padding: '10px 0',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(32, 181, 98, 0.3)',
              }}>
                Deposit
              </button>
            </div>
          </div>

          {/* Marquee Notice Bar */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '25px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
              <Volume2 size={16} color="#f95959" />
              <div style={{
                fontSize: '11px',
                color: '#656b78',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                If you experience slow performance or login issues, please ensure a stable network.
              </div>
            </div>
            <div style={{
              backgroundColor: '#f95959',
              color: '#ffffff',
              borderRadius: '20px',
              padding: '2px 10px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              flexShrink: 0,
            }}>
              <Flame size={12} fill="#fff" /> Detail
            </div>
          </div>
        </div>

        {/* 2. Main Game Screen Content */}
        <div style={{ padding: '0 14px', marginTop: '6px' }}>
          {/* Game Interval 4 Tabs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            marginBottom: '14px',
          }}>
            {GAMES.map((game) => {
              const active = selectedGame === game.id;
              return (
                <button
                  key={game.id}
                  onClick={() => setSelectedGame(game.id)}
                  style={{
                    backgroundColor: active ? '#f95959' : '#ffffff',
                    color: active ? '#ffffff' : '#888f9d',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '12px 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: active ? '0 4px 14px rgba(249, 89, 89, 0.35)' : '0 2px 6px rgba(0,0,0,0.04)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#f0f2f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '16px' }}>🕒</span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    lineHeight: '1.2',
                    textAlign: 'center',
                  }}>
                    {game.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3. Ticket Card (Perforated Red Ticket) */}
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #f95959 0%, #ff7171 100%)',
            borderRadius: '18px',
            padding: '16px 14px',
            color: '#ffffff',
            boxShadow: '0 6px 18px rgba(249, 89, 89, 0.35)',
            marginBottom: '14px',
            overflow: 'hidden',
          }}>
            {/* Left cutout semi-circle */}
            <div style={{
              position: 'absolute',
              left: '-8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#f6f7fb',
            }} />
            {/* Right cutout semi-circle */}
            <div style={{
              position: 'absolute',
              right: '-8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#f6f7fb',
            }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', alignItems: 'center' }}>
              {/* Left Side: How to play + 5 balls */}
              <div style={{ borderRight: '1px dashed rgba(255,255,255,0.35)', paddingRight: '10px' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1px solid rgba(255,255,255,0.6)',
                  borderRadius: '16px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginBottom: '8px',
                }}>
                  <BookOpen size={12} />
                  <span>How to play</span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>
                  {GAMES.find((g) => g.id === selectedGame)?.name}
                </div>

                {/* 5 Last Winning Balls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {(liveData?.history || []).slice(0, 5).map((h, i) => (
                    <div
                      key={i}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        ...getBallStyle(h.number),
                        fontSize: '12px',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        border: '1.5px solid rgba(255,255,255,0.6)',
                      }}
                    >
                      {h.number}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side: Digital Flip Timer & Period */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.9, marginBottom: '6px' }}>
                  Time remaining
                </div>

                {/* Digital Flip Clock Digits */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '8px' }}>
                  <div style={digitBoxStyle}>{digits[0]}</div>
                  <div style={digitBoxStyle}>{digits[1]}</div>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: '#fff', margin: '0 1px' }}>:</span>
                  <div style={digitBoxStyle}>{digits[2]}</div>
                  <div style={digitBoxStyle}>{digits[3]}</div>
                </div>

                {/* Period Number */}
                <div style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  letterSpacing: '0.5px',
                  color: '#ffffff',
                }}>
                  {liveData?.current?.issueNumber || '20261107100051964'}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Prediction Board (White Card) */}
          <div style={{
            position: 'relative',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '16px 14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
            marginBottom: '14px',
          }}>
            {/* BIG COUNTDOWN OVERLAY WHEN COUNTDOWN <= 5 SECONDS (Image 4 Match) */}
            {countdown <= 5 && countdown > 0 && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                borderRadius: '20px',
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(3px)',
                animation: 'pulse 1s infinite ease-in-out',
              }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={giantDigitBoxStyle}>{digits[2]}</div>
                  <div style={giantDigitBoxStyle}>{digits[3]}</div>
                </div>
              </div>
            )}

            {/* Row 1: Green / Violet / Red */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
              <button
                onClick={() => setSelectedBet({ type: 'color', value: 'Green', multiplier: 2 })}
                style={{
                  backgroundColor: '#18b660',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 0',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(24, 182, 96, 0.3)',
                }}
              >
                Green
              </button>
              <button
                onClick={() => setSelectedBet({ type: 'color', value: 'Violet', multiplier: 4.5 })}
                style={{
                  backgroundColor: '#b659fe',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 0',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(182, 89, 254, 0.3)',
                }}
              >
                Violet
              </button>
              <button
                onClick={() => setSelectedBet({ type: 'color', value: 'Red', multiplier: 2 })}
                style={{
                  backgroundColor: '#fb5b5b',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 0',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(251, 91, 91, 0.3)',
                }}
              >
                Red
              </button>
            </div>

            {/* Row 2: Numbers 0 to 9 in 2 Rows */}
            <div style={{
              backgroundColor: '#f8f9fc',
              borderRadius: '16px',
              padding: '14px 10px',
              marginBottom: '14px',
            }}>
              {/* Numbers 0-4 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '10px' }}>
                {[0, 1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    onClick={() => setSelectedBet({ type: 'number', value: String(num), multiplier: 9 })}
                    style={{
                      aspectRatio: '1',
                      border: 'none',
                      borderRadius: '50%',
                      ...getBallStyle(num),
                      fontSize: '18px',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
                      outline: selectedBet?.value === String(num) ? '3px solid #f95959' : 'none',
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Numbers 5-9 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {[5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => setSelectedBet({ type: 'number', value: String(num), multiplier: 9 })}
                    style={{
                      aspectRatio: '1',
                      border: 'none',
                      borderRadius: '50%',
                      ...getBallStyle(num),
                      fontSize: '18px',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
                      outline: selectedBet?.value === String(num) ? '3px solid #f95959' : 'none',
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Multipliers Bar: Random, X1, X5, X10, X20, X50 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              marginBottom: '14px',
            }}>
              <button
                onClick={() => {
                  const r = Math.floor(Math.random() * 10);
                  setSelectedBet({ type: 'number', value: String(r), multiplier: 9 });
                }}
                style={{
                  border: '1px solid #f95959',
                  backgroundColor: '#ffffff',
                  color: '#f95959',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Random
              </button>
              {[1, 5, 10, 20, 50].map((mVal) => {
                const isSelected = multiplier === mVal;
                return (
                  <button
                    key={mVal}
                    onClick={() => setMultiplier(mVal)}
                    style={{
                      backgroundColor: isSelected ? '#18b660' : '#f0f2f5',
                      color: isSelected ? '#ffffff' : '#656b78',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    X{mVal}
                  </button>
                );
              })}
            </div>

            {/* Big / Small 2 Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                onClick={() => setSelectedBet({ type: 'size', value: 'Big', multiplier: 2 })}
                style={{
                  backgroundColor: '#fea736',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 0',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(254, 167, 54, 0.3)',
                }}
              >
                Big
              </button>
              <button
                onClick={() => setSelectedBet({ type: 'size', value: 'Small', multiplier: 2 })}
                style={{
                  backgroundColor: '#6ea8ff',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 0',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(110, 168, 255, 0.3)',
                }}
              >
                Small
              </button>
            </div>
          </div>

          {/* 5. Betting Bottom Popup Sheet (When a Prediction is Selected) */}
          {selectedBet && (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              border: '1px solid #e8ebf0',
              marginBottom: '14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#888f9d' }}>Selected: </span>
                  <strong style={{ fontSize: '16px', color: '#1e2638' }}>
                    {selectedBet.value} ({selectedBet.multiplier}X)
                  </strong>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#f95959' }}>
                  Total: ₹{betAmount * multiplier}
                </div>
              </div>

              {/* Base amount choices */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {[1, 10, 100, 1000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBetAmount(amt)}
                    style={{
                      flex: 1,
                      backgroundColor: betAmount === amt ? '#f95959' : '#f0f2f5',
                      color: betAmount === amt ? '#fff' : '#495057',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 0',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setSelectedBet(null)}
                  style={{
                    flex: 1,
                    backgroundColor: '#e9ecef',
                    color: '#6c757d',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '10px 0',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBet}
                  style={{
                    flex: 2,
                    backgroundColor: '#f95959',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '10px 0',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 3px 10px rgba(249, 89, 89, 0.4)',
                  }}
                >
                  Confirm Bet
                </button>
              </div>
            </div>
          )}

          {/* 6. Tabs & History Table (Game history, Chart, My history) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginBottom: '12px',
          }}>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                backgroundColor: activeTab === 'history' ? '#f95959' : '#ffffff',
                color: activeTab === 'history' ? '#ffffff' : '#888f9d',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 0',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeTab === 'history' ? '0 3px 10px rgba(249, 89, 89, 0.3)' : '0 2px 4px rgba(0,0,0,0.03)',
              }}
            >
              Game history
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              style={{
                backgroundColor: activeTab === 'chart' ? '#f95959' : '#ffffff',
                color: activeTab === 'chart' ? '#ffffff' : '#888f9d',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 0',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeTab === 'chart' ? '0 3px 10px rgba(249, 89, 89, 0.3)' : '0 2px 4px rgba(0,0,0,0.03)',
              }}
            >
              Chart
            </button>
            <button
              onClick={() => setActiveTab('my')}
              style={{
                backgroundColor: activeTab === 'my' ? '#f95959' : '#ffffff',
                color: activeTab === 'my' ? '#ffffff' : '#888f9d',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 0',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeTab === 'my' ? '0 3px 10px rgba(249, 89, 89, 0.3)' : '0 2px 4px rgba(0,0,0,0.03)',
              }}
            >
              My history
            </button>
          </div>

          {/* Table Container */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '18px',
            padding: '14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          }}>
            {activeTab === 'history' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                <thead>
                  <tr style={{ color: '#888f9d', fontSize: '11px', borderBottom: '1px solid #f0f2f5' }}>
                    <th style={{ paddingBottom: '10px', fontWeight: 600 }}>Period</th>
                    <th style={{ paddingBottom: '10px', fontWeight: 600 }}>Number</th>
                    <th style={{ paddingBottom: '10px', fontWeight: 600 }}>Big/Small</th>
                    <th style={{ paddingBottom: '10px', fontWeight: 600 }}>Color</th>
                  </tr>
                </thead>
                <tbody>
                  {(liveData?.history || []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8f9fa', fontSize: '12px' }}>
                      <td style={{ padding: '10px 0', fontFamily: 'monospace', fontWeight: 700, color: '#333' }}>
                        {row.issueNumber}
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          fontSize: '13px',
                          fontWeight: 900,
                          ...getBallStyle(row.number),
                        }}>
                          {row.number}
                        </span>
                      </td>
                      <td style={{ padding: '10px 0', fontWeight: 700, color: row.isBig ? '#fea736' : '#6ea8ff' }}>
                        {row.size}
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          {row.color?.includes('green') && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#18b660' }} />
                          )}
                          {row.color?.includes('violet') && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#b659fe' }} />
                          )}
                          {row.color?.includes('red') && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fb5b5b' }} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'chart' && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#888f9d', fontSize: '13px' }}>
                <Award size={36} color="#f95959" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Trend Analysis & Statistical Missing Chart will render here.
              </div>
            )}

            {activeTab === 'my' && (
              <div>
                {myBets.length === 0 ? (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: '#888f9d', fontSize: '13px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📜</div>
                    No betting records found.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {myBets.map((b) => (
                      <div key={b.id} style={{
                        padding: '10px',
                        borderRadius: '12px',
                        backgroundColor: '#f8f9fc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                      }}>
                        <div>
                          <div style={{ fontWeight: 800, color: '#1e2638' }}>{b.select} • ₹{b.cost}</div>
                          <div style={{ fontSize: '11px', color: '#888f9d' }}>Period: {b.period}</div>
                        </div>
                        <span style={{
                          backgroundColor: '#fff3cd',
                          color: '#856404',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '11px',
                        }}>
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable digit flip box style
const digitBoxStyle = {
  backgroundColor: '#ffffff',
  color: '#f95959',
  fontSize: '15px',
  fontWeight: 900,
  fontFamily: 'monospace',
  borderRadius: '4px',
  width: '18px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
};

// Reusable giant digit box style for the 5-sec countdown overlay
const giantDigitBoxStyle = {
  backgroundColor: '#ffffff',
  color: '#f95959',
  fontSize: '110px',
  fontWeight: 900,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  borderRadius: '24px',
  width: '125px',
  height: '175px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
};
