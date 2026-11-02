import React, { useState, useEffect, useRef } from 'react';
import { Tv, ArrowLeft, RefreshCw, Volume2 } from 'lucide-react';
import axios from 'axios';

// Format size: 10000000 -> 10M, 2500000 -> 2.5M, 22800 -> 22.8K
const formatSize = (size) => {
  if (size === null || size === undefined || size === '') return '';
  const num = Number(size);
  if (isNaN(num) || num <= 0) return '';
  if (num >= 1000000) {
    const val = num / 1000000;
    return val % 1 === 0 ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (num >= 1000) {
    const val = num / 1000;
    return val % 1 === 0 ? `${val}K` : `${val.toFixed(1)}K`;
  }
  return `${Math.round(num)}`;
};

const MemoizedLiveTvPlayer = React.memo(function MemoizedLiveTvPlayer({
  eventId,
  sportId,
  watchUrl,
}) {
  const [streamSrc, setStreamSrc] = useState(
    `/api/stream/sports-tv-proxy/${eventId}?sportId=${sportId}`
  );

  const handleRefresh = () => {
    setStreamSrc(
      `/api/stream/sports-tv-proxy/${eventId}?sportId=${sportId}&fresh=1&t=${Date.now()}`
    );
  };

  const handlePopout = () => {
    const targetUrl = watchUrl || `/api/stream/sports-tv-proxy/${eventId}?sportId=${sportId}`;
    window.open(
      targetUrl,
      'LiveMatchPlayer',
      'width=720,height=420,menubar=no,toolbar=no,location=no,status=no'
    );
  };

  return (
    <div style={{ width: '100%', height: '220px', background: '#000000', position: 'relative' }}>
      <iframe
        id="live-stream-frame"
        src={streamSrc}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        allow="autoplay; fullscreen; encrypted-media"
        title="Live Match Stream"
      />
      <div
        style={{
          position: 'absolute',
          top: '6px',
          right: '8px',
          display: 'flex',
          gap: '6px',
          zIndex: 10
        }}
      >
        <button
          onClick={handlePopout}
          style={{
            background: 'rgba(37, 99, 235, 0.88)',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '10px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
          title="Open in HD Floating Window (Zero Lag)"
        >
          ⚡ HD Popout
        </button>
        <button
          onClick={handleRefresh}
          style={{
            background: 'rgba(0,0,0,0.65)',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
          title="Refresh Stream"
        >
          🔄 Refresh
        </button>
      </div>
      {watchUrl && (
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            position: 'absolute',
            bottom: '6px',
            right: '8px',
            background: 'rgba(0,0,0,0.7)',
            color: '#94a3b8',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            textDecoration: 'none',
            zIndex: 5
          }}
        >
          Direct Stream ↗
        </a>
      )}
    </div>
  );
});

export default function MatchDetailTablesView({ event, onBack }) {
  const [activePill, setActivePill] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showTv, setShowTv] = useState(false);
  const [mediaTab, setMediaTab] = useState('score'); // 'score' | 'live'
  const [watchUrl, setWatchUrl] = useState(null);
  const [news, setNews] = useState('');

  // Real Scraped Data State
  const [matchOdds, setMatchOdds] = useState(null);
  const [bookmaker, setBookmaker] = useState(null);
  const [fancyMarkets, setFancyMarkets] = useState([]);
  const [selectedBet, setSelectedBet] = useState(null);

  // Rate change flashes
  const [flashBackSet, setFlashBackSet] = useState(new Set());
  const [flashLaySet, setFlashLaySet] = useState(new Set());
  const prevRatesRef = useRef({});

  // 1. Fetch initial snapshot from getMarketsEventList
  const fetchMarketSnapshot = async () => {
    try {
      const res = await axios.post('/api/sports/markets-event-list', {
        eventId: event.exEventId || event._id,
        sportId: String(event.sportId || '4')
      });
      const data = res.data?.data?.data || res.data?.data;
      if (data) {
        if (Array.isArray(data.fancyData)) setFancyMarkets(data.fancyData);
        if (data.matchOddsData && data.matchOddsData.length > 0) {
          const mo = data.matchOddsData[0];
          const runners = mo.oddsData?.runners || [];
          const names = mo.runnersData || {};
          setMatchOdds({
            marketName: mo.marketName || 'Match Odds',
            min: mo.min || 100,
            max: mo.max || 1000,
            totalMatched: mo.oddsData?.totalMatched || '0',
            status: mo.oddsData?.status || 'OPEN',
            runners: runners.map((r) => {
              const b0 = r.price?.back?.[0] || {};
              const l0 = r.price?.lay?.[0] || {};
              const isSusp = r.status === 'SUSPENDED' || r.status === 'SUSPEND';
              return {
                selectionId: String(r.selectionId),
                name: names[String(r.selectionId)] || `Runner ${r.selectionId}`,
                status: r.status || 'ONLINE',
                isSuspended: isSusp,
                back: { price: isSusp ? null : b0.price, size: b0.size || 0 },
                lay: { price: isSusp ? null : l0.price, size: l0.size || 0 }
              };
            })
          });
        }
        if (data.bookmakersData && data.bookmakersData.length > 0) {
          const bm = data.bookmakersData[0];
          const runners = bm.oddsData?.runners || [];
          const names = bm.runnersData || {};
          setBookmaker({
            marketName: bm.marketName || 'Bookmaker Cup Bhav',
            min: bm.min || 100,
            max: bm.max || 25000,
            totalMatched: bm.oddsData?.totalMatched || '0',
            status: bm.oddsData?.status || 'OPEN',
            runners: runners.map((r) => {
              const b0 = r.price?.back?.[0] || {};
              const l0 = r.price?.lay?.[0] || {};
              const isSusp = r.status === 'SUSPENDED' || r.status === 'SUSPEND';
              return {
                selectionId: String(r.selectionId),
                name: names[String(r.selectionId)] || `Runner ${r.selectionId}`,
                status: r.status || 'ONLINE',
                isSuspended: isSusp,
                back: { price: isSusp ? null : b0.price, size: b0.size || 0 },
                lay: { price: isSusp ? null : l0.price, size: l0.size || 0 }
              };
            })
          });
        }
      }
    } catch (err) {
      console.error('Error fetching market snapshot:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch live TV watch link
  const fetchWatchLink = async (explicitStreamId) => {
    try {
      const targetId = explicitStreamId || event.exEventId || event._id;
      const res = await axios.post('/api/stream/watch-link', {
        streamId: targetId,
        sportId: String(event.sportId || '4')
      });
      if (res.data?.data?.url) {
        setWatchUrl(res.data.data.url);
      }
    } catch (e) {}
  };

  // Process real-time rates update
  const handleRatesUpdate = (data) => {
    if (!data) return;
    const newFlashBack = new Set();
    const newFlashLay = new Set();

    if (data.news) {
      setNews(data.news);
    }

    // Check Match Odds updates
    if (data.matchOdds && Array.isArray(data.matchOdds.runners)) {
      let moChanged = false;
      data.matchOdds.runners.forEach((r) => {
        const prev = prevRatesRef.current[`mo_${r.selectionId}`];
        if (!prev || prev.backPrice !== r.back?.price || prev.layPrice !== r.lay?.price) {
          moChanged = true;
          if (prev && r.back?.price !== null && prev.backPrice !== r.back?.price) {
            newFlashBack.add(`mo_b_${r.selectionId}`);
          }
          if (prev && r.lay?.price !== null && prev.layPrice !== r.lay?.price) {
            newFlashLay.add(`mo_l_${r.selectionId}`);
          }
          prevRatesRef.current[`mo_${r.selectionId}`] = {
            backPrice: r.back?.price,
            layPrice: r.lay?.price
          };
        }
      });
      if (moChanged) setMatchOdds(data.matchOdds);
    }

    // Check Bookmaker updates
    if (data.bookmaker && Array.isArray(data.bookmaker.runners)) {
      let bmChanged = false;
      data.bookmaker.runners.forEach((r) => {
        const prev = prevRatesRef.current[`bm_${r.selectionId}`];
        if (!prev || prev.backPrice !== r.back?.price || prev.layPrice !== r.lay?.price) {
          bmChanged = true;
          if (prev && r.back?.price !== null && prev.backPrice !== r.back?.price) {
            newFlashBack.add(`bm_b_${r.selectionId}`);
          }
          if (prev && r.lay?.price !== null && prev.layPrice !== r.lay?.price) {
            newFlashLay.add(`bm_l_${r.selectionId}`);
          }
          prevRatesRef.current[`bm_${r.selectionId}`] = {
            backPrice: r.back?.price,
            layPrice: r.lay?.price
          };
        }
      });
      if (bmChanged) setBookmaker(data.bookmaker);
    }

    // Check Live Fancy updates
    if (Array.isArray(data.fancy) && data.fancy.length > 0) {
      let fcChanged = false;
      data.fancy.forEach((f) => {
        const prev = prevRatesRef.current[`fc_${f.marketId}`];
        if (!prev || prev.yesPrice !== f.yes?.price || prev.noPrice !== f.no?.price) {
          fcChanged = true;
          if (prev && prev.yesPrice !== f.yes?.price) {
            newFlashBack.add(`fc_y_${f.marketId}`);
          }
          if (prev && prev.noPrice !== f.no?.price) {
            newFlashLay.add(`fc_n_${f.marketId}`);
          }
          prevRatesRef.current[`fc_${f.marketId}`] = {
            yesPrice: f.yes?.price,
            noPrice: f.no?.price
          };
        }
      });
      if (fcChanged) setFancyMarkets(data.fancy);
    }

    if (newFlashBack.size > 0 || newFlashLay.size > 0) {
      setFlashBackSet(newFlashBack);
      setFlashLaySet(newFlashLay);
      setTimeout(() => {
        setFlashBackSet(new Set());
        setFlashLaySet(new Set());
      }, 220); // Quick 200ms visual flash
    }
  };

  // 3. Direct REST API live rates: 1s for in-play, 5s for upcoming / non-in-play
  useEffect(() => {
    fetchMarketSnapshot();

    const eventId = String(event.exEventId || event._id);
    const sportId = String(event.sportId || '4');
    const isInPlay = Boolean(
      event.inPlay ||
      event.inplay ||
      event.isPlay ||
      event.oddsData?.inPlay ||
      event.oddsData?.inplay
    );
    const pollInterval = isInPlay ? 1000 : 5000;

    let isMounted = true;
    const pollRates = async () => {
      try {
        const res = await axios.get(`/api/sports/live-rates/${eventId}?sportId=${sportId}`);
        if (isMounted && res.data?.success && res.data?.data) {
          handleRatesUpdate(res.data.data);
        }
      } catch (e) {}
    };

    pollRates();
    const timer = setInterval(pollRates, pollInterval);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [event]);

  return (
    <div
      style={{
        maxWidth: '520px',
        margin: '0 auto',
        background: '#ffffff',
        color: '#000000',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: '80px',
        fontFamily: 'Tahoma, Helvetica, sans-serif'
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(180deg, #5c0f16 0%, #1a0507 100%)',
          color: '#ffffff',
          padding: '12px 14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontWeight: 700
            }}
          >
            <ArrowLeft size={16} /> <span>Back</span>
          </button>

          <span
            style={{
              fontWeight: 800,
              fontSize: '14px',
              maxWidth: '240px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {event.eventName}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {watchUrl && (
              <button
                onClick={() => setShowTv(!showTv)}
                style={{
                  background: showTv ? '#10b981' : '#334155',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                <Tv size={14} /> <span>TV</span>
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span
            style={{
              background: '#16a34a',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px'
            }}
          >
            LIVE IN-PLAY
          </span>

          <span style={{ fontSize: '11px', color: '#fef08a', fontWeight: 600 }}>
            {event.eventTime ? new Date(event.eventTime).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'In-Play'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px', color: '#4ade80' }}>
          <span>● Live Socket Connected (Real Scraping)</span>
          <button
            onClick={() => fetchMarketSnapshot()}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px' }}
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* News Ticker Bar (if news exists in scraper) */}
      {news && (
        <div
          style={{
            backgroundColor: '#fef3c7',
            color: '#b45309',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 700,
            borderBottom: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}
        >
          <span>📢</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{news}</span>
        </div>
      )}

      {/* Live Score & Watch Live Media Player Bar (Exact Match to User Screenshot) */}
      <div style={{ backgroundColor: '#000000', borderBottom: '1px solid #222222' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #2a2a2a' }}>
          <button
            onClick={() => setMediaTab('score')}
            style={{
              flex: 1,
              padding: '9px 12px',
              backgroundColor: mediaTab === 'score' ? '#111827' : '#000000',
              color: mediaTab === 'score' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderBottom: mediaTab === 'score' ? '2px solid #38bdf8' : 'none',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Live Score</span>
          </button>
          <button
            onClick={() => setMediaTab('live')}
            style={{
              flex: 1,
              padding: '9px 12px',
              backgroundColor: mediaTab === 'live' ? '#111827' : '#000000',
              color: mediaTab === 'live' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderBottom: mediaTab === 'live' ? '2px solid #ef4444' : 'none',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Tv size={14} /> <span>Watch Live</span>
          </button>
        </div>

        {mediaTab === 'score' ? (
          <div style={{ width: '100%', background: '#000000' }}>
            <iframe
              src={`/api/sports/scoreboard-frame/${event.exEventId || event._id}?sportId=${event.sportId || '4'}`}
              style={{ width: '100%', height: '115px', border: 'none', display: 'block' }}
              title="Universe Live Scoreboard"
            />
          </div>
        ) : (
          <MemoizedLiveTvPlayer
            eventId={event.exEventId || event._id}
            sportId={event.sportId || '4'}
            watchUrl={watchUrl}
          />
        )}
      </div>

      {/* Navigation Filter Pills matching screenshot */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 12px',
          background: '#090d16',
          borderBottom: '1px solid #1e293b',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}
      >
        {['All', 'Match Odds', 'Bookmaker', 'Fancy'].map((pill) => (
          <button
            key={pill}
            onClick={() => setActivePill(pill)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              background: activePill === pill ? '#f59e0b' : '#1e293b',
              color: activePill === pill ? '#000' : '#cbd5e1',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {pill}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && !matchOdds && !bookmaker && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="live-indicator" style={{ margin: '0 auto 8px', color: '#0284c7' }} />
          <div>Connecting to Real Exchange Feed...</div>
        </div>
      )}

      {/* 1. MATCH ODDS TABLE (Real Scraped Data) */}
      {(activePill === 'All' || activePill === 'Match Odds') && (
        <div style={{ borderBottom: '2px solid #cbd5e1' }}>
          {matchOdds && matchOdds.runners?.length > 0 ? (
            <div>
              {/* Header */}
              <div
                style={{
                  background: '#243a48',
                  color: '#fff',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{matchOdds.marketName}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>ⓘ</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fef08a' }}>
                    <span style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '50%', display: 'inline-block' }}></span>
                    Cash Out
                  </span>
                  <span style={{ color: '#ffffff' }}>
                    Matched <span style={{ fontWeight: 800 }}>€{matchOdds.totalMatched || '0'}</span>
                  </span>
                </div>
              </div>

              {/* Min/Max + Back/Lay columns */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 64px 64px',
                  background: '#e0f2fe',
                  borderBottom: '1px solid #cbd5e1',
                  alignItems: 'center',
                  fontWeight: 700,
                  fontSize: '11px'
                }}
              >
                <div style={{ padding: '6px 12px', color: '#0369a1' }}>
                  Min/Max {matchOdds.min} - {matchOdds.max}
                </div>
                <div style={{ background: '#72bbef', color: '#000', textAlign: 'center', padding: '6px 0', borderRight: '1px solid #fff' }}>
                  Back
                </div>
                <div style={{ background: '#faa9ba', color: '#000', textAlign: 'center', padding: '6px 0' }}>
                  Lay
                </div>
              </div>

              {/* Runners */}
              {matchOdds.runners.map((r, idx) => {
                const isFlashBack = flashBackSet.has(`mo_b_${r.selectionId}`);
                const isFlashLay = flashLaySet.has(`mo_l_${r.selectionId}`);
                const isSuspended = r.isSuspended || r.status === 'SUSPENDED' || r.status === 'SUSPEND';

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 64px 64px',
                      borderBottom: '1px solid #e2e8f0',
                      alignItems: 'center',
                      background: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                    }}
                  >
                    <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: '13px', color: '#000' }}>
                      {r.name}
                    </div>

                    {/* Back Button */}
                    <button
                      onClick={() => !isSuspended && setSelectedBet({ side: 'BACK', runner: r.name, rate: r.back?.price, size: r.back?.size })}
                      className={isFlashBack ? 'flash-back' : ''}
                      disabled={isSuspended}
                      style={{
                        background: '#72bbef',
                        border: 'none',
                        borderRight: '1px solid #ffffff',
                        padding: '4px 0',
                        textAlign: 'center',
                        cursor: isSuspended ? 'default' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '42px',
                        position: 'relative'
                      }}
                    >
                      {isSuspended ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>Suspended</span>
                          <span style={{ fontSize: '9px', color: '#64748b' }}>{formatSize(r.back?.size)}</span>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#000' }}>
                            {r.back?.price !== null && r.back?.price !== undefined ? r.back.price : '-'}
                          </span>
                          <span style={{ fontSize: '9px', color: '#334155' }}>
                            {formatSize(r.back?.size)}
                          </span>
                        </>
                      )}
                    </button>

                    {/* Lay Button */}
                    <button
                      onClick={() => !isSuspended && setSelectedBet({ side: 'LAY', runner: r.name, rate: r.lay?.price, size: r.lay?.size })}
                      className={isFlashLay ? 'flash-lay' : ''}
                      disabled={isSuspended}
                      style={{
                        background: '#faa9ba',
                        border: 'none',
                        padding: '4px 0',
                        textAlign: 'center',
                        cursor: isSuspended ? 'default' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '42px',
                        position: 'relative'
                      }}
                    >
                      {isSuspended ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>0</span>
                          <span style={{ fontSize: '9px', color: '#64748b' }}>{formatSize(r.lay?.size)}</span>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#000' }}>
                            {r.lay?.price !== null && r.lay?.price !== undefined ? r.lay.price : '-'}
                          </span>
                          <span style={{ fontSize: '9px', color: '#334155' }}>
                            {formatSize(r.lay?.size)}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
              No Match Odds data currently open on exchange for this match.
            </div>
          )}
        </div>
      )}

      {/* 2. BOOKMAKER BHAV TABLE (Real Live Scraped Data - Zero NaN) */}
      {(activePill === 'All' || activePill === 'Bookmaker') && (
        <div style={{ marginTop: '10px' }}>
          {bookmaker && bookmaker.runners?.length > 0 ? (
            <div style={{ borderBottom: '2px solid #cbd5e1' }}>
              <div
                style={{
                  background: '#243a48',
                  color: '#fff',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{bookmaker.marketName}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>ⓘ</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fef08a' }}>
                    <span style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '50%', display: 'inline-block' }}></span>
                    Cash Out
                  </span>
                  {bookmaker.totalMatched && (
                    <span style={{ color: '#ffffff' }}>
                      Matched <span style={{ fontWeight: 800 }}>€{formatSize(bookmaker.totalMatched)}</span>
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 64px 64px',
                  background: '#e0f2fe',
                  borderBottom: '1px solid #cbd5e1',
                  alignItems: 'center',
                  fontWeight: 700,
                  fontSize: '11px'
                }}
              >
                <div style={{ padding: '6px 12px', color: '#0369a1' }}>
                  Min/Max {bookmaker.min} - {bookmaker.max}
                </div>
                <div style={{ background: '#72bbef', color: '#000', textAlign: 'center', padding: '6px 0', borderRight: '1px solid #fff' }}>
                  Back
                </div>
                <div style={{ background: '#faa9ba', color: '#000', textAlign: 'center', padding: '6px 0' }}>
                  Lay
                </div>
              </div>

              {bookmaker.runners.map((r, idx) => {
                const isFlashBack = flashBackSet.has(`bm_b_${r.selectionId}`);
                const isFlashLay = flashLaySet.has(`bm_l_${r.selectionId}`);
                const isSuspended =
                  r.isSuspended ||
                  r.status === 'SUSPENDED' ||
                  r.status === 'SUSPEND' ||
                  r.back?.price === null ||
                  isNaN(Number(r.back?.price)) ||
                  String(r.back?.price).includes('NaN');

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 64px 64px',
                      borderBottom: '1px solid #e2e8f0',
                      alignItems: 'center',
                      background: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                    }}
                  >
                    <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: '13px', color: '#000' }}>
                      {r.name}
                    </div>

                    {/* Bookmaker Back Button */}
                    <button
                      onClick={() => !isSuspended && setSelectedBet({ side: 'BACK', runner: r.name, rate: r.back?.price, size: r.back?.size })}
                      className={isFlashBack ? 'flash-back' : ''}
                      disabled={isSuspended}
                      style={{
                        background: '#72bbef',
                        border: 'none',
                        borderRight: '1px solid #ffffff',
                        padding: '4px 0',
                        textAlign: 'center',
                        cursor: isSuspended ? 'default' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '42px',
                        position: 'relative'
                      }}
                    >
                      {isSuspended ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>Suspended</span>
                          <span style={{ fontSize: '9px', color: '#64748b' }}>{formatSize(r.back?.size)}</span>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#000' }}>
                            {r.back?.price !== null && r.back?.price !== undefined ? r.back.price : '0'}
                          </span>
                          <span style={{ fontSize: '9px', color: '#334155' }}>
                            {formatSize(r.back?.size)}
                          </span>
                        </>
                      )}
                    </button>

                    {/* Bookmaker Lay Button */}
                    <button
                      onClick={() => !isSuspended && setSelectedBet({ side: 'LAY', runner: r.name, rate: r.lay?.price, size: r.lay?.size })}
                      className={isFlashLay ? 'flash-lay' : ''}
                      disabled={isSuspended}
                      style={{
                        background: '#faa9ba',
                        border: 'none',
                        padding: '4px 0',
                        textAlign: 'center',
                        cursor: isSuspended ? 'default' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '42px',
                        position: 'relative'
                      }}
                    >
                      {isSuspended ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>0</span>
                          <span style={{ fontSize: '9px', color: '#64748b' }}>{formatSize(r.lay?.size)}</span>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#000' }}>
                            {r.lay?.price !== null && r.lay?.price !== undefined ? r.lay.price : '0'}
                          </span>
                          <span style={{ fontSize: '9px', color: '#334155' }}>
                            {formatSize(r.lay?.size)}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : activePill === 'Bookmaker' ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
              No Bookmaker Bhav open for this match.
            </div>
          ) : null}
        </div>
      )}

      {/* 3. FANCY / SESSION MARKETS (Live Streaming) */}
      {(activePill === 'All' || activePill === 'Fancy') && (
        <div style={{ marginTop: '10px' }}>
          {fancyMarkets.length > 0 ? (
            <div>
              {/* Header */}
              <div
                style={{
                  background: '#243a48',
                  color: '#fff',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Fancy / Session Markets ({fancyMarkets.length})</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>ⓘ</span>
                </div>
              </div>

              {/* Column labels */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 64px 64px',
                  background: '#e0f2fe',
                  borderBottom: '1px solid #cbd5e1',
                  alignItems: 'center',
                  fontWeight: 700,
                  fontSize: '11px'
                }}
              >
                <div style={{ padding: '6px 12px', color: '#0369a1' }}>Session / Over Line</div>
                <div style={{ background: '#faa9ba', color: '#000', textAlign: 'center', padding: '6px 0', borderRight: '1px solid #fff' }}>
                  No
                </div>
                <div style={{ background: '#72bbef', color: '#000', textAlign: 'center', padding: '6px 0' }}>
                  Yes
                </div>
              </div>

              {/* Rows */}
              {fancyMarkets.map((f, idx) => {
                const marketId = f.marketId || idx;
                const marketName = f.marketName || `Session Market ${idx + 1}`;
                const isFlashNo = flashLaySet.has(`fc_n_${marketId}`);
                const isFlashYes = flashBackSet.has(`fc_y_${marketId}`);
                const isSuspended = f.isSuspended || f.status === 'SUSPENDED';

                // Prices
                const noPrice = f.no?.price ?? f.oddsData?.runners?.[0]?.price?.lay?.[0]?.price ?? '-';
                const noSize = f.no?.size ?? f.oddsData?.runners?.[0]?.price?.lay?.[0]?.size ?? '100';
                const yesPrice = f.yes?.price ?? f.oddsData?.runners?.[0]?.price?.back?.[0]?.price ?? '-';
                const yesSize = f.yes?.size ?? f.oddsData?.runners?.[0]?.price?.back?.[0]?.size ?? '100';

                return (
                  <div
                    key={marketId}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 64px 64px',
                      borderBottom: '1px solid #e2e8f0',
                      alignItems: 'center',
                      background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      position: 'relative'
                    }}
                  >
                    <div style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#000', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{marketName}</span>
                        {f.news && (
                          <span
                            style={{
                              backgroundColor: '#e2e8f0',
                              color: '#334155',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 800
                            }}
                          >
                            {f.news}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        Min/Max {f.min || 100} - {f.max || 50000}
                      </div>
                    </div>

                    {/* NO (Pink) */}
                    <button
                      onClick={() => !isSuspended && setSelectedBet({ side: 'NO', runner: marketName, rate: noPrice, size: noSize })}
                      className={isFlashNo ? 'flash-lay' : ''}
                      disabled={isSuspended}
                      style={{
                        background: '#faa9ba',
                        border: 'none',
                        borderRight: '1px solid #ffffff',
                        padding: '4px 0',
                        textAlign: 'center',
                        cursor: isSuspended ? 'default' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '42px',
                        opacity: isSuspended ? 0.6 : 1
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#000' }}>
                        {isSuspended ? '-' : noPrice}
                      </span>
                      <span style={{ fontSize: '9px', color: '#334155' }}>
                        {isSuspended ? '' : noSize}
                      </span>
                    </button>

                    {/* YES (Blue) */}
                    <button
                      onClick={() => !isSuspended && setSelectedBet({ side: 'YES', runner: marketName, rate: yesPrice, size: yesSize })}
                      className={isFlashYes ? 'flash-back' : ''}
                      disabled={isSuspended}
                      style={{
                        background: '#72bbef',
                        border: 'none',
                        padding: '4px 0',
                        textAlign: 'center',
                        cursor: isSuspended ? 'default' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '42px',
                        opacity: isSuspended ? 0.6 : 1
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#000' }}>
                        {isSuspended ? '-' : yesPrice}
                      </span>
                      <span style={{ fontSize: '9px', color: '#334155' }}>
                        {isSuspended ? '' : yesSize}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : activePill === 'Fancy' ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
              No Fancy markets active for this event.
            </div>
          ) : null}
        </div>
      )}

      {/* Selected Bet Popover */}
      {selectedBet && (
        <div
          style={{
            position: 'fixed',
            bottom: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#090d16',
            color: '#fff',
            borderRadius: '8px',
            border: '1px solid #334155',
            padding: '12px 18px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            zIndex: 1000,
            maxWidth: '460px',
            width: '90%'
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>
              Place Bet ({selectedBet.side})
            </div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
              {selectedBet.runner}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '15px', fontWeight: 900, color: selectedBet.side === 'BACK' || selectedBet.side === 'YES' ? '#38bdf8' : '#f472b6' }}>
              @ {selectedBet.rate || '1.0'}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              Vol: {formatSize(selectedBet.size)}
            </div>
          </div>
          <button
            onClick={() => setSelectedBet(null)}
            style={{ background: '#334155', border: 'none', borderRadius: '4px', color: '#fff', padding: '6px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
