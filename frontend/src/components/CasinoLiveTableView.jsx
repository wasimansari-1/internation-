import React, { useState, useEffect } from 'react';
import { RefreshCw, History, HelpCircle, Tv, X, Trophy } from 'lucide-react';
import { io } from 'socket.io-client';

export default function CasinoLiveTableView({ onBackToLobby }) {
  const [gameState, setGameState] = useState({
    roundId: 9100111150633,
    seconds: 45,
    status: 'BETTING_OPEN',
    winner: null,
    cards: {
      PLAYER_A: [{ suit: '♣', val: '7', color: 'black' }, { suit: '♠', val: '7', color: 'black' }, { suit: '♥', val: 'Q', color: 'red' }],
      PLAYER_B: [{ suit: '♥', val: '5', color: 'red' }, { suit: '♣', val: '3', color: 'black' }, { suit: '♦', val: 'Q', color: 'red' }]
    },
    markets: {
      winner: { playerA: { rate: 1.98, limit: '2500000' }, playerB: { rate: 1.98, limit: '2500000' } },
      pair: { playerA: { rate: 4, limit: '500000' }, playerB: { rate: 4, limit: '500000' } },
      flush: { playerA: { rate: 8, limit: '500000' }, playerB: { rate: 8, limit: '500000' } },
      straight: { playerA: { rate: 14, limit: '500000' }, playerB: { rate: 14, limit: '500000' } },
      straightFlush: { playerA: { rate: 40, limit: '500000' }, playerB: { rate: 40, limit: '500000' } },
      trio: { playerA: { rate: 75, limit: '500000' }, playerB: { rate: 75, limit: '500000' } }
    }
  });

  const [showResultModal, setShowResultModal] = useState(false);
  const [showLiveTv, setShowLiveTv] = useState(false);
  const [selectedBet, setSelectedBet] = useState(null);

  useEffect(() => {
    const socket = io();
    socket.on('casino:state', (data) => {
      setGameState(data);
    });

    socket.on('casino:round:result', (data) => {
      setShowResultModal(true);
      setTimeout(() => setShowResultModal(false), 5000);
    });

    return () => socket.disconnect();
  }, []);

  const renderCard = (card, idx) => (
    <div
      key={idx}
      style={{
        width: '38px',
        height: '54px',
        background: '#ffffff',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
        color: card.color === 'red' ? '#dc2626' : '#000000',
        fontWeight: 800,
        fontSize: '14px',
        lineHeight: 1
      }}
    >
      <span>{card.val}</span>
      <span style={{ fontSize: '18px' }}>{card.suit}</span>
    </div>
  );

  const renderMarketBlock = (title, key, ratio, icon) => {
    const data = gameState.markets?.[key] || { playerA: { rate: ratio, limit: '500000' }, playerB: { rate: ratio, limit: '500000' } };
    return (
      <div style={{ background: '#253847', borderRadius: '4px', overflow: 'hidden', border: '1px solid #334e68' }}>
        <div style={{
          background: '#1d2d3a',
          padding: '6px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '0.3px'
        }}>
          <span>{title}</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>ⓘ</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          padding: '8px 12px',
          background: '#2b3f50'
        }}>
          {/* Player A */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f8fafc' }}>
              PLAYER A {key !== 'winner' && `( ${title.split(' ')[0]} )`}
            </span>
            <button
              onClick={() => setSelectedBet({ title, side: 'PLAYER A', rate: data.playerA.rate })}
              style={{
                width: '100%',
                padding: '8px 4px',
                background: '#72bbef',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#000' }}>
                {data.playerA.rate}
              </span>
              <span style={{ fontSize: '10px', color: '#1e293b' }}>
                {data.playerA.limit}
              </span>
            </button>
          </div>

          {/* Player B */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f8fafc' }}>
              PLAYER B {key !== 'winner' && `( ${title.split(' ')[0]} )`}
            </span>
            <button
              onClick={() => setSelectedBet({ title, side: 'PLAYER B', rate: data.playerB.rate })}
              style={{
                width: '100%',
                padding: '8px 4px',
                background: '#72bbef',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#000' }}>
                {data.playerB.rate}
              </span>
              <span style={{ fontSize: '10px', color: '#1e293b' }}>
                {data.playerB.limit}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      maxWidth: '500px',
      margin: '0 auto',
      background: '#0a0e17',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: '80px'
    }}>
      {/* Top Header Bar */}
      <div style={{
        background: '#000000',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #222'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{
            background: '#1a1a1a',
            border: '1px solid #333',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Rules
          </button>
          <button 
            onClick={onBackToLobby}
            style={{
              background: '#f59e0b',
              border: 'none',
              color: '#000',
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            GAMING LOBBY
          </button>
        </div>

        <div style={{ color: '#fff', fontSize: '11px', textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>Main PTI 883</div>
          <div style={{ color: '#94a3b8' }}>Exposure(<span style={{ color: '#ef4444' }}>0</span>)</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => setShowLiveTv(!showLiveTv)}
            style={{ background: 'none', border: 'none', color: showLiveTv ? '#38bdf8' : '#94a3b8', cursor: 'pointer' }}
          >
            <Tv size={16} />
          </button>
          <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <History size={16} />
          </button>

          {/* Circular Countdown Timer */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#111',
            border: '2px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '14px'
          }}>
            {gameState.seconds}
          </div>
        </div>
      </div>

      {/* Live TV Video Area */}
      <div style={{
        background: '#0d131f',
        padding: '16px 14px',
        position: 'relative',
        borderBottom: '2px solid #1e293b'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
            RID: <strong style={{ color: '#f8fafc' }}>{gameState.roundId}</strong>
          </span>

          <span style={{
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '4px',
            background: gameState.status === 'BETTING_OPEN' ? '#059669' : '#dc2626',
            color: '#fff'
          }}>
            {gameState.status === 'BETTING_OPEN' ? 'BETTING OPEN' : 'CARDS SHOW'}
          </span>
        </div>

        {/* Live Video Feed (if toggled) */}
        {showLiveTv && (
          <div style={{ marginBottom: '14px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #38bdf8' }}>
            <iframe
              src="https://casino.nice444.com/authentication/demo/99.0010"
              style={{ width: '100%', height: '180px', border: 'none' }}
              title="Dealer Stream"
            />
          </div>
        )}

        {/* Cards Layout matching Screenshot 3 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Player A Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>PLAYER A</span>
              {gameState.winner === 'PLAYER_A' && <span style={{ background: '#059669', color: '#fff', fontSize: '9px', padding: '1px 4px', borderRadius: '2px' }}>WINNER</span>}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {gameState.cards.PLAYER_A.map(renderCard)}
            </div>
          </div>

          {/* Universe Casino Logo */}
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ec4899 0%, #3b82f6 100%)',
              margin: '0 auto 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(236, 72, 153, 0.5)'
            }}>
              🎲
            </div>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#ec4899', letterSpacing: '0.5px' }}>
              universe
            </span>
            <div style={{ fontSize: '8px', color: '#94a3b8' }}>CASINO</div>
          </div>

          {/* Player B Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {gameState.winner === 'PLAYER_B' && <span style={{ background: '#059669', color: '#fff', fontSize: '9px', padding: '1px 4px', borderRadius: '2px' }}>WINNER</span>}
              <span>PLAYER B</span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {gameState.cards.PLAYER_B.map(renderCard)}
            </div>
          </div>
        </div>
      </div>

      {/* Betting Tables Stack (Exact from Screenshot 3) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
        {renderMarketBlock('WINNER', 'winner', 1.98)}
        {renderMarketBlock('PAIR ( DUBBLE ) 1:4', 'pair', 4)}
        {renderMarketBlock('FLUSH ( COLOR ) 1:8', 'flush', 8)}
        {renderMarketBlock('STRAIGHT ( ROWN ) 1:14', 'straight', 14)}
        {renderMarketBlock('STRAIGHT FLUSH ( PAKKI ROWN ) 1:40', 'straightFlush', 40)}
        {renderMarketBlock('TRIO / TEEN 1:75', 'trio', 75)}
      </div>

      {/* Selected Bet Notice */}
      {selectedBet && (
        <div style={{
          position: 'fixed',
          bottom: '70px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '460px',
          background: '#0284c7',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          zIndex: 100
        }}>
          <div>
            <strong>{selectedBet.side}</strong> ({selectedBet.title}) @ Rate <strong>{selectedBet.rate}</strong>
          </div>
          <button
            onClick={() => setSelectedBet(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Round Result Modal (Screenshot 4) */}
      {showResultModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            color: '#000000',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '380px',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              background: '#000000',
              color: '#ffffff',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 800, fontSize: '14px' }}>20-20 TEEN PATTI</span>
              <button onClick={() => setShowResultModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '14px' }}>
                Round Id: {gameState.roundId}
              </div>

              {/* Cards Showcase */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '6px' }}>Player A</div>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                    {gameState.cards.PLAYER_A.map(renderCard)}
                  </div>
                </div>

                <div style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                  padding: '4px 16px',
                  borderRadius: '6px'
                }}>
                  {gameState.winner ? `${gameState.winner.replace('_', ' ')} WINNER!` : 'WINNER'}
                </div>

                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '6px' }}>Player B</div>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                    {gameState.cards.PLAYER_B.map(renderCard)}
                  </div>
                </div>
              </div>

              {/* Payout Ratios */}
              <div style={{ marginTop: '18px', borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>PAIR ( DUBBLE ) 1:4</span>
                  <span>1:4</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>FLUSH ( COLOR ) 1:8</span>
                  <span>1:8</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>STRAIGHT ( ROWN ) 1:14</span>
                  <span>1:14</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>TRIO ( TEEN ) 1:75</span>
                  <span>1:75</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

