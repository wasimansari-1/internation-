import React, { useState, useEffect, useRef } from 'react';
import { Tv, ArrowLeft, RefreshCw, Volume2, Info, ExternalLink } from 'lucide-react';
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

  const handlePopout = async () => {
    try {
      const res = await axios.post('/api/stream/watch-link', { streamId: eventId, sportId });
      const directUrl = res.data?.data?.url;
      if (directUrl) {
        window.open(
          directUrl,
          'LiveMatchPlayer',
          'width=720,height=420,menubar=no,toolbar=no,location=no,status=no'
        );
        return;
      }
    } catch (e) {}
    window.open(
      watchUrl || `/api/stream/sports-tv-proxy/${eventId}?sportId=${sportId}&fresh=1`,
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
            background: 'rgba(37, 99, 235, 0.9)',
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
          title="Open in HD Floating Window"
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
  const [loading, setLoading] = useState(true);
  const [showTv, setShowTv] = useState(false);
  const [mediaTab, setMediaTab] = useState('score'); // 'score' | 'live'
  const [watchUrl, setWatchUrl] = useState(null);
  const [news, setNews] = useState('');

  // Parent Navigation Tab: 'fancy' | 'sportsbook' | 'results'
  const [mainTab, setMainTab] = useState('fancy');

  // Sub-tabs
  const [fancySubTab, setFancySubTab] = useState('ALL'); // 'ALL' | 'Fancy' | 'Line Market' | 'Ball by Ball' | 'Meter' | 'Khado'
  const [sportsbookSubTab, setSportsbookSubTab] = useState('All'); // 'All' | 'Match' | 'Odds/Evens' | 'Batsman' | 'Bowler' | 'Extra'

  // Real Scraped Data State
  const [matchOddsList, setMatchOddsList] = useState([]);
  const [bookmakerList, setBookmakerList] = useState([]);
  const [fancyMarkets, setFancyMarkets] = useState([]);
  const [sportsbook, setSportsbook] = useState([]);
  const [fancyResults, setFancyResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
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
        if (Array.isArray(data.sportsbookData)) setSportsbook(data.sportsbookData);

        if (Array.isArray(data.matchOddsData) && data.matchOddsData.length > 0) {
          const parsedMo = data.matchOddsData.map((mo) => {
            const runners = mo.oddsData?.runners || [];
            const names = mo.runnersData || {};
            return {
              marketId: String(mo.marketId || mo.exMarketId || ''),
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
            };
          });
          setMatchOddsList(parsedMo);
        }

        if (Array.isArray(data.bookmakersData) && data.bookmakersData.length > 0) {
          const parsedBm = data.bookmakersData.map((bm) => {
            const runners = bm.oddsData?.runners || [];
            const names = bm.runnersData || {};
            return {
              marketId: String(bm.marketId || bm.exMarketId || ''),
              marketName: bm.marketName || 'Bookmaker Bhav',
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
            };
          });
          setBookmakerList(parsedBm);
        }
      }
    } catch (err) {
      console.error('Error fetching market snapshot:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1b. Fetch settled fancy results
  const fetchFancyResults = async () => {
    setLoadingResults(true);
    try {
      const res = await axios.post('/api/sports/market-results', {
        eventId: event.exEventId || event._id
      });
      const results = res.data?.data?.data || res.data?.data || [];
      if (Array.isArray(results)) {
        setFancyResults(results);
      }
    } catch (e) {
      console.warn('Failed to load market results:', e);
    } finally {
      setLoadingResults(false);
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
    const moSource = data.matchOddsList || (data.matchOdds ? [data.matchOdds] : []);
    if (moSource.length > 0) {
      let moChanged = false;
      moSource.forEach((m) => {
        (m.runners || []).forEach((r) => {
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
      });
      if (moChanged) setMatchOddsList(moSource);
    }

    // Check Bookmaker updates
    const bmSource = data.bookmakerList || (data.bookmaker ? [data.bookmaker] : []);
    if (bmSource.length > 0) {
      let bmChanged = false;
      bmSource.forEach((m) => {
        (m.runners || []).forEach((r) => {
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
      });
      if (bmChanged) setBookmakerList(bmSource);
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
      }, 220);
    }
  };

  // Direct REST API live rates: 1s for in-play, 5s for upcoming
  useEffect(() => {
    fetchMarketSnapshot();
    fetchFancyResults();

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

  // Fancy filter logic matching Screenshot 1 sub-tabs
  const filteredFancy = fancyMarkets.filter((f) => {
    if (fancySubTab === 'ALL') return true;
    const name = (f.marketName || f.sessionName || '').toLowerCase();
    if (fancySubTab === 'Ball by Ball') {
      return name.includes('ball') || name.includes('0.') || name.includes('1.') || name.includes('2.');
    }
    if (fancySubTab === 'Line Market') {
      return name.includes('line') || name.includes('over runs') || name.includes('over run');
    }
    if (fancySubTab === 'Meter') {
      return name.includes('meter') || name.includes('wicket') || name.includes('fall');
    }
    if (fancySubTab === 'Khado') {
      return name.includes('khado') || name.includes('boundary') || name.includes('four') || name.includes('six');
    }
    if (fancySubTab === 'Fancy') {
      return !name.includes('ball') && !name.includes('meter') && !name.includes('khado');
    }
    return true;
  });

  // Sportsbook filter logic matching Screenshot 2 sub-tabs
  const filteredSportsbook = sportsbook.filter((sb) => {
    if (sportsbookSubTab === 'All') return true;
    const name = (sb.marketName || '').toLowerCase();
    if (sportsbookSubTab === 'Match') {
      return name.includes('match') || name.includes('toss') || name.includes('dismissal') || name.includes('winner');
    }
    if (sportsbookSubTab === 'Odds/Evens') {
      return name.includes('digit') || name.includes('odd') || name.includes('even');
    }
    if (sportsbookSubTab === 'Batsman') {
      return name.includes('batsman') || name.includes('player') || name.includes('runs') || name.includes('fifty');
    }
    if (sportsbookSubTab === 'Bowler') {
      return name.includes('bowler') || name.includes('wicket') || name.includes('maidens');
    }
    if (sportsbookSubTab === 'Extra') {
      return !name.includes('match') && !name.includes('toss') && !name.includes('digit') && !name.includes('batsman') && !name.includes('bowler');
    }
    return true;
  });

  return (
    <div
      style={{
        maxWidth: '520px',
        margin: '0 auto',
        background: '#f8fafc',
        color: '#000000',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: '80px',
        fontFamily: 'Tahoma, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
            {event.eventTime
              ? new Date(event.eventTime).toLocaleDateString([], {
                  month: 'numeric',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'In-Play'}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '6px',
            fontSize: '11px',
            color: '#4ade80'
          }}
        >
          <span>● Live Socket Connected (Real Scraping)</span>
          <button
            onClick={() => {
              fetchMarketSnapshot();
              fetchFancyResults();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '11px'
            }}
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* News Ticker Bar */}
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

      {/* Live Score & Watch Live Media Player Bar */}
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

      {/* Loading state */}
      {loading && matchOddsList.length === 0 && bookmakerList.length === 0 && (
        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="live-indicator" style={{ margin: '0 auto 8px', color: '#0284c7' }} />
          <div>Connecting to Real Exchange Feed...</div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MATCH ODDS & SPECIAL HEAD-TO-HEAD MARKETS (Screenshot 3)              */}
      {/* ========================================================================= */}
      {matchOddsList.map((mo, moIdx) => {
        const is2Way = mo.runners && mo.runners.length === 2 && (mo.marketName.toLowerCase().includes('win') || mo.marketName.toLowerCase().includes('toss'));
        return (
          <div key={mo.marketId || moIdx} style={{ marginBottom: '8px', background: '#fff', borderBottom: '1px solid #cbd5e1' }}>
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
                <span>{mo.marketName}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>ⓘ</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fef08a' }}>
                  <span style={{ width: '7px', height: '7px', background: '#f59e0b', borderRadius: '50%', display: 'inline-block' }}></span>
                  Cash Out
                </span>
                <span style={{ color: '#ffffff' }}>
                  Matched <span style={{ fontWeight: 800 }}>€{formatSize(mo.totalMatched) || '0'}</span>
                </span>
              </div>
            </div>

            {/* 2-Way Side-by-Side View (e.g. To Win The Match, Which Team Will Win The Toss) */}
            {is2Way ? (
              <div style={{ padding: '8px 12px', background: '#e6f4ea' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {mo.runners.map((r, rIdx) => {
                    const price = r.back?.price ?? '-';
                    const size = formatSize(r.back?.size) || '500K';
                    const isSuspended = r.isSuspended || r.status === 'SUSPENDED';
                    return (
                      <div key={r.selectionId || rIdx} style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a', marginBottom: '4px' }}>
                          {r.name}
                        </div>
                        <button
                          onClick={() => !isSuspended && setSelectedBet({ side: 'BACK', runner: `${mo.marketName} - ${r.name}`, rate: price, size: r.back?.size })}
                          disabled={isSuspended}
                          style={{
                            width: '100%',
                            background: '#6ee7b7',
                            border: '1px solid #34d399',
                            borderRadius: '4px',
                            padding: '6px 0',
                            cursor: isSuspended ? 'default' : 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: 900, color: '#000' }}>
                            {isSuspended ? '0' : price}
                          </span>
                          <span style={{ fontSize: '9px', fontWeight: 600, color: '#064e3b' }}>
                            {size}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Standard Back/Lay Table (e.g. Match Odds) */
              <div>
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
                    Min/Max {mo.min} - {mo.max}
                  </div>
                  <div style={{ background: '#72bbef', color: '#000', textAlign: 'center', padding: '6px 0', borderRight: '1px solid #fff' }}>
                    Back
                  </div>
                  <div style={{ background: '#faa9ba', color: '#000', textAlign: 'center', padding: '6px 0' }}>
                    Lay
                  </div>
                </div>

                {mo.runners.map((r, rIdx) => {
                  const isFlashBack = flashBackSet.has(`mo_b_${r.selectionId}`);
                  const isFlashLay = flashLaySet.has(`mo_l_${r.selectionId}`);
                  const isSuspended = r.isSuspended || r.status === 'SUSPENDED';
                  return (
                    <div
                      key={r.selectionId || rIdx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 64px 64px',
                        borderBottom: '1px solid #e2e8f0',
                        alignItems: 'center',
                        background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: '13px', color: '#000' }}>
                        {r.name}
                      </div>

                      {/* Back */}
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
                          height: '42px'
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#000' }}>
                          {isSuspended || r.back?.price === null ? '-' : r.back?.price}
                        </span>
                        <span style={{ fontSize: '9px', color: '#334155' }}>
                          {formatSize(r.back?.size)}
                        </span>
                      </button>

                      {/* Lay */}
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
                          height: '42px'
                        }}
                      >
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#000' }}>
                          {isSuspended || r.lay?.price === null ? '-' : r.lay?.price}
                        </span>
                        <span style={{ fontSize: '9px', color: '#334155' }}>
                          {formatSize(r.lay?.size)}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ========================================================================= */}
      {/* 2. BOOKMAKER & SPECIAL MARKETS (Screenshot 3)                            */}
      {/* ========================================================================= */}
      {bookmakerList.map((bm, bmIdx) => (
        <div key={bm.marketId || bmIdx} style={{ marginBottom: '8px', background: '#fff', borderBottom: '1px solid #cbd5e1' }}>
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
              <span>{bm.marketName}</span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>ⓘ</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fef08a' }}>
                <span style={{ width: '7px', height: '7px', background: '#f59e0b', borderRadius: '50%', display: 'inline-block' }}></span>
                Cash Out
              </span>
              {bm.totalMatched && (
                <span style={{ color: '#ffffff' }}>
                  Matched <span style={{ fontWeight: 800 }}>€{formatSize(bm.totalMatched)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Subheader */}
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
              Min/Max {bm.min} - {bm.max}
            </div>
            <div style={{ background: '#72bbef', color: '#000', textAlign: 'center', padding: '6px 0', borderRight: '1px solid #fff' }}>
              Back
            </div>
            <div style={{ background: '#faa9ba', color: '#000', textAlign: 'center', padding: '6px 0' }}>
              Lay
            </div>
          </div>

          {/* Runners */}
          {bm.runners.map((r, rIdx) => {
            const isFlashBack = flashBackSet.has(`bm_b_${r.selectionId}`);
            const isFlashLay = flashLaySet.has(`bm_l_${r.selectionId}`);
            const isSuspended =
              r.isSuspended ||
              r.status === 'SUSPENDED' ||
              r.back?.price === null ||
              isNaN(Number(r.back?.price));

            return (
              <div
                key={r.selectionId || rIdx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 64px 64px',
                  borderBottom: '1px solid #e2e8f0',
                  alignItems: 'center',
                  background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'
                }}
              >
                <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: '13px', color: '#000' }}>
                  {r.name}
                </div>

                {/* Back */}
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
                    height: '42px'
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#000' }}>
                    {isSuspended || r.back?.price === null ? '0' : r.back?.price}
                  </span>
                  <span style={{ fontSize: '9px', color: '#334155' }}>
                    {formatSize(r.back?.size)}
                  </span>
                </button>

                {/* Lay */}
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
                    height: '42px'
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#000' }}>
                    {isSuspended || r.lay?.price === null ? '0' : r.lay?.price}
                  </span>
                  <span style={{ fontSize: '9px', color: '#334155' }}>
                    {formatSize(r.lay?.size)}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ))}

      {/* ========================================================================= */}
      {/* 3. DUAL PARENT TABS: [FANCY BET ⓘ] & [SPORTSBOOK ⓘ] & [RESULTS ⓘ]         */}
      {/* Matches Screenshot 1 & 2 exactly                                          */}
      {/* ========================================================================= */}
      <div style={{ marginTop: '6px' }}>
        <div style={{ display: 'flex', width: '100%' }}>
          {/* Fancy Bet Tab */}
          <button
            onClick={() => setMainTab('fancy')}
            style={{
              flex: 1,
              padding: '10px 8px',
              backgroundColor: mainTab === 'fancy' ? '#20a3b8' : '#334155',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background 0.15s ease'
            }}
          >
            <span>Fancy Bet</span>
            <span style={{ fontSize: '13px' }}>ⓘ</span>
          </button>

          {/* Sportsbook Tab */}
          <button
            onClick={() => setMainTab('sportsbook')}
            style={{
              flex: 1,
              padding: '10px 8px',
              backgroundColor: mainTab === 'sportsbook' ? '#ea580c' : '#334155',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background 0.15s ease'
            }}
          >
            <span>Sportsbook</span>
            <span style={{ fontSize: '13px' }}>ⓘ</span>
          </button>

          {/* Results Tab */}
          <button
            onClick={() => setMainTab('results')}
            style={{
              flex: 0.9,
              padding: '10px 8px',
              backgroundColor: mainTab === 'results' ? '#0f766e' : '#1e293b',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background 0.15s ease'
            }}
          >
            <span>Results</span>
            <span style={{ fontSize: '13px' }}>ⓘ</span>
          </button>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 1: FANCY BET (Screenshot 1)                                        */}
        {/* Sub-tabs: ALL | Fancy | Line Market | Ball by Ball | Meter | Khado     */}
        {/* ----------------------------------------------------------------------- */}
        {mainTab === 'fancy' && (
          <div>
            {/* Sub-tabs Navigation Bar */}
            <div
              style={{
                backgroundColor: '#38bdf8',
                padding: '6px 10px',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                scrollbarWidth: 'none'
              }}
            >
              {['ALL', 'Fancy', 'Line Market', 'Ball by Ball', 'Meter', 'Khado'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFancySubTab(tab)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    border: 'none',
                    backgroundColor: fancySubTab === tab ? '#ffffff' : 'transparent',
                    color: fancySubTab === tab ? '#000000' : '#ffffff',
                    fontWeight: 800,
                    fontSize: '11px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Column Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 64px 64px',
                background: '#ffffff',
                borderBottom: '1px solid #cbd5e1',
                alignItems: 'center',
                fontWeight: 800,
                fontSize: '12px'
              }}
            >
              <div style={{ padding: '6px 12px', color: '#334155' }}>
                Session / Over Line ({filteredFancy.length})
              </div>
              <div style={{ background: '#faa9ba', color: '#000', textAlign: 'center', padding: '6px 0', borderRight: '1px solid #fff' }}>
                No
              </div>
              <div style={{ background: '#72bbef', color: '#000', textAlign: 'center', padding: '6px 0' }}>
                Yes
              </div>
            </div>

            {/* Fancy Rows */}
            {filteredFancy.length > 0 ? (
              filteredFancy.map((f, idx) => {
                const marketId = f.marketId || idx;
                const marketName = f.marketName || f.sessionName || `Session Market ${idx + 1}`;
                const isFlashNo = flashLaySet.has(`fc_n_${marketId}`);
                const isFlashYes = flashBackSet.has(`fc_y_${marketId}`);
                const isSuspended = f.isSuspended || f.status === 'SUSPENDED';

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
                      background: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                    }}
                  >
                    <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                      <span style={{ fontSize: '12px', color: '#94a3b8', cursor: 'pointer', marginLeft: '6px' }}>ⓘ</span>
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
              })
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                No markets found under <strong>{fancySubTab}</strong> category.
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 2: SPORTSBOOK (Screenshot 2)                                       */}
        {/* Sub-tabs: All | Match | Odds/Evens | Batsman | Bowler | Extra           */}
        {/* ----------------------------------------------------------------------- */}
        {mainTab === 'sportsbook' && (
          <div>
            {/* Sub-tabs Navigation Bar */}
            <div
              style={{
                backgroundColor: '#ea580c',
                padding: '6px 10px',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                scrollbarWidth: 'none'
              }}
            >
              {['All', 'Match', 'Odds/Evens', 'Batsman', 'Bowler', 'Extra'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSportsbookSubTab(tab)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    border: 'none',
                    backgroundColor: sportsbookSubTab === tab ? '#ffffff' : 'transparent',
                    color: sportsbookSubTab === tab ? '#000000' : '#ffffff',
                    fontWeight: 800,
                    fontSize: '11px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Sportsbook Markets List */}
            {filteredSportsbook.length > 0 ? (
              filteredSportsbook.map((sb, sbIdx) => {
                const runners = sb.oddsData?.runners || [];
                const names = sb.runnersData || {};
                return (
                  <div key={sb.marketId || sbIdx} style={{ marginBottom: '8px', background: '#fff' }}>
                    {/* Orange Header Bar */}
                    <div
                      style={{
                        background: '#ea580c',
                        color: '#ffffff',
                        padding: '7px 12px',
                        fontWeight: 800,
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{sb.marketName || 'Sportsbook Market'}</span>
                      <span style={{ fontSize: '13px' }}>ⓘ</span>
                    </div>

                    {/* Runners List */}
                    {runners.map((r, rIdx) => {
                      const runnerName = names[String(r.selectionId)] || `Option ${rIdx + 1}`;
                      const backPrice = r.price?.back?.[0]?.price ?? '-';
                      const volume = formatSize(r.price?.back?.[0]?.size) || '100K';
                      const isSusp = r.status === 'SUSPENDED';

                      return (
                        <div
                          key={r.selectionId || rIdx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderBottom: '1px solid #f1f5f9',
                            background: rIdx % 2 === 0 ? '#ffffff' : '#fafafa'
                          }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                            {runnerName}
                          </span>

                          {/* Green Box Button */}
                          <button
                            onClick={() =>
                              !isSusp &&
                              setSelectedBet({
                                side: 'BACK',
                                runner: `${sb.marketName} - ${runnerName}`,
                                rate: backPrice,
                                size: r.price?.back?.[0]?.size || 100
                              })
                            }
                            disabled={isSusp}
                            style={{
                              background: '#6ee7b7',
                              border: '1px solid #34d399',
                              borderRadius: '4px',
                              width: '110px',
                              height: '38px',
                              cursor: isSusp ? 'default' : 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 900, color: '#000000' }}>
                              {isSusp ? '-' : backPrice}
                            </span>
                            <span style={{ fontSize: '9px', fontWeight: 600, color: '#064e3b' }}>
                              {volume}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                No sportsbook markets found under <strong>{sportsbookSubTab}</strong> category.
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 3: SETTLED RESULTS (User Requirements 1, 2, 4)                     */}
        {/* ----------------------------------------------------------------------- */}
        {mainTab === 'results' && (
          <div style={{ padding: '10px 12px' }}>
            <div
              style={{
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                background: '#ffffff'
              }}
            >
              <div
                style={{
                  background: '#0f766e',
                  color: '#fff',
                  padding: '9px 12px',
                  fontSize: '12px',
                  fontWeight: 800,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>SETTLED FANCY / SESSION RESULTS</span>
                <button
                  onClick={fetchFancyResults}
                  style={{
                    background: '#042f2e',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🔄 Refresh
                </button>
              </div>

              {loadingResults ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  Loading real-time settled results...
                </div>
              ) : fancyResults.length > 0 ? (
                fancyResults.map((res, rIdx) => {
                  const declared = res.result || res.declaredRun || res.outcome || res.score || 'PASS';
                  const title = res.marketName || res.sessionName || res.name || `Session ${rIdx + 1}`;
                  const time = res.settledTime || res.createdAt || 'Settled';
                  return (
                    <div
                      key={res.marketId || rIdx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderBottom: '1px solid #f1f5f9',
                        background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{title}</div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                          Status: <strong style={{ color: '#059669' }}>SETTLED</strong> • {time}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            background: '#10b981',
                            color: '#ffffff',
                            padding: '3px 10px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: 900,
                            display: 'inline-block'
                          }}
                        >
                          {declared}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>No Settled Results Yet</div>
                  <div>Session outcomes will appear here in real time as overs complete and results are declared.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
            <div
              style={{
                fontSize: '15px',
                fontWeight: 900,
                color: selectedBet.side === 'BACK' || selectedBet.side === 'YES' ? '#38bdf8' : '#f472b6'
              }}
            >
              @ {selectedBet.rate || '1.0'}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              Vol: {formatSize(selectedBet.size)}
            </div>
          </div>
          <button
            onClick={() => setSelectedBet(null)}
            style={{
              background: '#334155',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
