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
      } else if (Array.isArray(sportsRes.data?.data)) {
        setSports(sportsRes.data.data);
      }
      const rawEvents = eventsRes.data?.data;
      if (Array.isArray(rawEvents)) {
        const map = {};
        for (const ev of rawEvents) {
          const sid = String(ev.sportId || '4');
          if (!map[sid]) map[sid] = [];
          map[sid].push(ev);
        }
        setEventsMap(map);
      } else if (rawEvents?.data) {
        setEventsMap(rawEvents.data);
      } else if (rawEvents && typeof rawEvents === 'object') {
        setEventsMap(rawEvents);
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
    const sName = sport.name || sport.sportName || '';
    if (sName.toLowerCase().includes('casino')) {
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
    const aInPlay = (a.inPlay ?? a.oddsData?.inPlay) ? 1 : 0;
    const bInPlay = (b.inPlay ?? b.oddsData?.inPlay) ? 1 : 0;
    if (aInPlay !== bInPlay) return bInPlay - aInPlay;
    const aOpen = (a.status === 'OPEN' || a.oddsData?.status === 'OPEN') ? 1 : 0;
    const bOpen = (b.status === 'OPEN' || b.oddsData?.status === 'OPEN') ? 1 : 0;
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
        background: '#FFFFFF',
        padding: '14px',
        borderRadius: '12px',
        border: '1.5px solid #cad7c3',
        boxShadow: '0 4px 14px rgba(30, 38, 31, 0.05)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {sports.map(s => {
            const count = eventsMap[s.sportId]?.length || 0;
            const isSelected = selectedSport === String(s.sportId);
            const sName = s.name || s.sportName || '';
            const isCasinoPill = sName.toLowerCase().includes('casino');
            return (
              <button
                key={s.sportId}
                onClick={() => handleSportClick(s)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: isSelected 
                    ? '1.5px solid #E8412C' 
                    : '1.5px solid #9CAF88',
                  background: isSelected 
                    ? '#E8412C' 
                    : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#1e261f',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isSelected ? '0 2px 6px rgba(232, 65, 44, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{sName}</span>
                <span style={{
                  background: isSelected ? '#be2e1b' : '#e3ebd9',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  color: isSelected ? '#FFFFFF' : '#1e261f'
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
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: '#748373' }} />
            <input
              type="text"
              placeholder="Search match..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '7px 12px 7px 32px',
                background: '#FFFFFF',
                border: '1.5px solid #9CAF88',
                borderRadius: '8px',
                color: '#1e261f',
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
              background: '#FFFFFF',
              border: '1.5px solid #cad7c3',
              borderRadius: '8px',
              color: '#1e261f',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 700
            }}
          >
            <RefreshCw size={13} className={loading ? 'live-indicator' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Matches Listing */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1.5px solid #cad7c3', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1.5px solid #cad7c3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e3ebd9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trophy size={16} style={{ color: '#E8412C' }} />
            <span style={{ fontWeight: 800, fontSize: '14px', color: '#1e261f' }}>
              Matches ({filteredEvents.length})
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#4e5a4d' }}>
            Select a match to view live market odds &amp; rates
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: '#4a5b52' }}>
            <RefreshCw size={24} className="live-indicator" style={{ margin: '0 auto 10px', color: '#e04838' }} />
            <p>Loading sports markets...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6f8076' }}>
            No matches found for this sport at the moment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredEvents.map((ev, idx) => {
              const inPlay = ev.inPlay ?? ev.oddsData?.inPlay;
              const runners = ev.runners || ev.oddsData?.runners || [];
              const status = ev.status || ev.oddsData?.status;
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
                    borderBottom: '1px solid #edf2ee',
                    background: idx % 2 === 0 ? '#ffffff' : '#f7f9f7',
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
                        <span style={{ background: '#1b6e38', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          LIVE
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6f8076', fontSize: '11px' }}>
                          <Clock size={12} />
                          {ev.eventTime ? new Date(ev.eventTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Upcoming'}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: '#e04838', fontWeight: 700 }}>
                        {ev.tournamentName || 'Exchange Match'}
                      </span>
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#1c2721' }}>
                      {ev.eventName}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11px', color: '#6f8076', marginTop: '4px' }}>
                      <span>Event ID: <code style={{ color: '#4a5b52' }}>{ev.exEventId || ev._id}</code></span>
                      {ev.isBookmakers && <span style={{ color: '#1b6e38', fontWeight: 600 }}>• Bookmakers</span>}
                      {ev.isFancy && <span style={{ color: '#d97706', fontWeight: 600 }}>• Fancy</span>}
                    </div>
                  </div>

                  {/* Quick Back/Lay Scraped Rates Preview */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {status === 'CLOSED' ? (
                      <span style={{ background: '#edf2ee', color: '#6f8076', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        CLOSED
                      </span>
                    ) : status === 'SUSPENDED' ? (
                      <span style={{ background: '#fce8e6', color: '#c5221f', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        SUSPENDED
                      </span>
                    ) : runners.length >= 2 ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {runners.slice(0, 2).map((r, rIdx) => {
                          const backP = r.backPrice ?? r.price?.back?.[0]?.price;
                          const layP = r.layPrice ?? r.price?.lay?.[0]?.price;
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
                        background: '#e04838',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        height: '34px',
                        boxShadow: '0 2px 6px rgba(224, 72, 56, 0.25)',
                        transition: 'background 0.15s ease'
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
