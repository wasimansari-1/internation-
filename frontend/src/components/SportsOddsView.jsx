import React, { useState, useEffect } from 'react';
import { Trophy, Search, RefreshCw, Eye, Clock, ArrowRight } from 'lucide-react';
import axios from 'axios';

export default function SportsOddsView({ onSwitchToCasino, onSelectMatch }) {
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState('4'); // Default 4 = Cricket
  const [eventsMap, setEventsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchSportsAndMatches = async () => {
    setLoading(true);
    try {
      const [sportsRes, eventsRes] = await Promise.all([
        axios.get('/api/sports/list'),
        axios.get('/api/sports/all-events')
      ]);

      if (sportsRes.data?.data?.data) {
        setSports(sportsRes.data.data.data);
      }
      if (eventsRes.data?.data?.data) {
        setEventsMap(eventsRes.data.data.data);
      }
    } catch (err) {
      console.error('Error fetching sports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSportsAndMatches();
    const interval = setInterval(fetchSportsAndMatches, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSportClick = (sport) => {
    if (sport.sportName?.toLowerCase().includes('casino')) {
      if (onSwitchToCasino) {
        onSwitchToCasino();
        return;
      }
    }
    setSelectedSport(String(sport.sportId));
  };

  const currentEvents = eventsMap[selectedSport] || [];
  // Prioritize In-Play and Open matches at the top so user immediately sees live rates
  const sortedEvents = [...currentEvents].sort((a, b) => {
    const aInPlay = a.oddsData?.inPlay ? 1 : 0;
    const bInPlay = b.oddsData?.inPlay ? 1 : 0;
    if (aInPlay !== bInPlay) return bInPlay - aInPlay;
    const aOpen = a.oddsData?.status === 'OPEN' ? 1 : 0;
    const bOpen = b.oddsData?.status === 'OPEN' ? 1 : 0;
    return bOpen - aOpen;
  });

  const filteredEvents = sortedEvents.filter(ev => 
    ev.eventName?.toLowerCase().includes(search.toLowerCase()) ||
    ev.tournamentName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Controls: Sport Pills & Search */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        background: '#131b2e',
        padding: '14px',
        borderRadius: '12px',
        border: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {sports.map(s => {
            const count = eventsMap[s.sportId]?.length || 0;
            const isSelected = selectedSport === String(s.sportId);
            const isCasinoPill = s.sportName?.toLowerCase().includes('casino');
            return (
              <button
                key={s.sportId}
                onClick={() => handleSportClick(s)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: isCasinoPill 
                    ? '1px solid #ec4899' 
                    : isSelected 
                    ? '1px solid #38bdf8' 
                    : '1px solid #334155',
                  background: isCasinoPill 
                    ? '#831843' 
                    : isSelected 
                    ? '#0284c7' 
                    : '#1e293b',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{s.sportName}</span>
                <span style={{
                  background: isCasinoPill ? '#be185d' : isSelected ? '#0369a1' : '#0f172a',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  color: '#e2e8f0'
                }}>
                  {isCasinoPill ? '42+ Live' : count}
                </span>
                {isCasinoPill && <ArrowRight size={12} />}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search match..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '7px 12px 7px 32px',
                background: '#0b0f19',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none',
                minWidth: '180px'
              }}
            />
          </div>

          <button
            onClick={fetchSportsAndMatches}
            disabled={loading}
            style={{
              padding: '7px 12px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#38bdf8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px'
            }}
          >
            <RefreshCw size={13} className={loading ? 'live-indicator' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Matches Listing */}
      <div style={{ background: '#131b2e', borderRadius: '12px', border: '1px solid #1e293b', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={16} style={{ color: '#38bdf8' }} />
            <span style={{ fontWeight: 800, fontSize: '14px', color: '#f8fafc' }}>
              Real Matches ({filteredEvents.length})
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Click match to open live rates & Bookmaker Bhav
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="live-indicator" style={{ margin: '0 auto 10px' }} />
            <p>Fetching real scraped matches from nice444.com...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            No matches found for this sport in the exchange right now.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredEvents.map((ev, idx) => {
              const inPlay = ev.oddsData?.inPlay;
              const runners = ev.oddsData?.runners || [];
              const runnerNames = ev.runnersData || {};

              return (
                <div
                  key={ev._id || idx}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderBottom: '1px solid #1a2234',
                    background: idx % 2 === 0 ? '#111827' : '#0f172a',
                    gap: '12px'
                  }}
                >
                  {/* Match Info */}
                  <div 
                    onClick={() => onSelectMatch && onSelectMatch({ ...ev, sportId: String(ev.sportId || selectedSport) })}
                    style={{ flex: '1', minWidth: '240px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      {inPlay ? (
                        <span style={{ background: '#059669', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          LIVE
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '11px' }}>
                          <Clock size={12} />
                          {ev.eventTime ? new Date(ev.eventTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Upcoming'}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>
                        {ev.tournamentName || 'Exchange Match'}
                      </span>
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                      {ev.eventName}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      <span>Event ID: <code style={{ color: '#94a3b8' }}>{ev.exEventId || ev._id}</code></span>
                      {ev.isBookmakers && <span style={{ color: '#10b981', fontWeight: 600 }}>• Bookmakers</span>}
                      {ev.isFancy && <span style={{ color: '#f59e0b', fontWeight: 600 }}>• Fancy</span>}
                    </div>
                  </div>

                  {/* Quick Back/Lay Scraped Rates Preview */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {ev.oddsData?.status === 'CLOSED' ? (
                      <span style={{ background: '#1e293b', color: '#94a3b8', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        CLOSED
                      </span>
                    ) : ev.oddsData?.status === 'SUSPENDED' ? (
                      <span style={{ background: '#7f1d1d', color: '#fca5a5', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        SUSPENDED
                      </span>
                    ) : runners.length >= 2 ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {runners.slice(0, 2).map((r, rIdx) => {
                          const backP = r.price?.back?.[0]?.price;
                          const layP = r.price?.lay?.[0]?.price;
                          return (
                            <div key={rIdx} style={{ display: 'flex', gap: '2px' }}>
                              <div style={{ width: '42px', height: '34px', background: '#72bbef', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#000' }}>
                                {backP || '-'}
                              </div>
                              <div style={{ width: '42px', height: '34px', background: '#faa9ba', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#000' }}>
                                {layP || '-'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    <button
                      onClick={() => onSelectMatch && onSelectMatch({ ...ev, sportId: String(ev.sportId || selectedSport) })}
                      style={{
                        padding: '8px 14px',
                        background: '#0284c7',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        height: '34px'
                      }}
                    >
                      <Eye size={13} />
                      <span>OPEN MATCH</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
