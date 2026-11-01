import React, { useState, useEffect } from 'react';
import { Dices, Search, RefreshCw, Play, ExternalLink, X, ArrowLeft, Tv } from 'lucide-react';
import axios from 'axios';

export default function CasinoView() {
  const [providers, setProviders] = useState([]);
  const [selectedTabId, setSelectedTabId] = useState(12); // Tab 12 is 'ALL'
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Real Selected Table for Live Play
  const [activeTable, setActiveTable] = useState(null);
  const [launchUrl, setLaunchUrl] = useState('');
  const [launchLoading, setLaunchLoading] = useState(false);

  const fetchProviders = async () => {
    try {
      const res = await axios.get('/api/casino/providers');
      const list = res.data?.data?.data || res.data?.data || [];
      if (Array.isArray(list) && list.length > 0) {
        setProviders(list);
      }
    } catch (err) {
      console.error('Error fetching casino providers:', err);
    }
  };

  const fetchTables = async (tabId) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/casino/tables', { id: tabId || 12 });
      const list = res.data?.data?.data || res.data?.data || [];
      if (Array.isArray(list)) {
        setTables(list);
      }
    } catch (err) {
      console.error('Error fetching casino tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
    fetchTables(12);
  }, []);

  const handleTabChange = (tabId) => {
    setSelectedTabId(tabId);
    fetchTables(tabId);
  };

  const handleOpenLiveTable = async (table) => {
    setActiveTable(table);
    setLaunchLoading(true);
    setLaunchUrl('');
    try {
      const res = await axios.post('/api/casino/launch-url', {
        eventId: table.eventId
      });
      if (res.data?.launchUrl) {
        setLaunchUrl(res.data.launchUrl);
      }
    } catch (err) {
      console.error('Error launching live table:', err);
    } finally {
      setLaunchLoading(false);
    }
  };

  const filteredTables = tables.filter(t =>
    t.eventName?.toLowerCase().includes(search.toLowerCase()) ||
    t.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* If a specific live table is opened */}
      {activeTable ? (
        <div style={{ display: 'flex', flexDirection: 'column', background: '#0a0e17', borderRadius: '12px', overflow: 'hidden', border: '1px solid #1e293b' }}>
          {/* Top Bar of Table */}
          <div style={{
            background: '#000000',
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #222'
          }}>
            <button
              onClick={() => { setActiveTable(null); setLaunchUrl(''); }}
              style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to Casino Lobby</span>
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '14px' }}>
                {activeTable.eventName}
              </div>
              <div style={{ fontSize: '11px', color: '#ec4899' }}>
                {activeTable.companyName} • Table ID: {activeTable.eventId}
              </div>
            </div>

            {launchUrl && (
              <a
                href={launchUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#be185d',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none'
                }}
              >
                <ExternalLink size={12} />
                <span>Full Screen</span>
              </a>
            )}
          </div>

          {/* Real Live Authenticated Casino Table & Video Dealer Frame */}
          <div style={{ width: '100%', height: '82vh', background: '#000', position: 'relative' }}>
            {launchLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '12px' }}>
                <RefreshCw size={36} className="live-indicator" style={{ color: '#ec4899' }} />
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                  Loading Real Live Dealer Stream & Odds for {activeTable.eventName}...
                </p>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Connecting via token to casino.nice444.com
                </span>
              </div>
            ) : launchUrl ? (
              <iframe
                src={launchUrl}
                title={activeTable.eventName}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="autoplay; fullscreen; camera; microphone"
              />
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#f43f5e' }}>
                Failed to authenticate table session with exchange.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Casino Lobby Grid */
        <>
          {/* Top Controls: Providers & Search */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: '#131b2e',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid #1e293b'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {providers.map(p => {
                const isSelected = selectedTabId === p.tabId;
                return (
                  <button
                    key={p.tabId}
                    onClick={() => handleTabChange(p.tabId)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: isSelected ? '1px solid #ec4899' : '1px solid #334155',
                      background: isSelected ? '#be185d' : '#1e293b',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {p.tabName}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search table..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: '8px 12px 8px 34px',
                    background: '#0b0f19',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                    minWidth: '200px'
                  }}
                />
              </div>

              <button
                onClick={() => fetchTables(selectedTabId)}
                disabled={loading}
                style={{
                  padding: '8px 14px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#ec4899',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px'
                }}
              >
                <RefreshCw size={14} className={loading ? 'live-indicator' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Tables Grid */}
          <div style={{ background: '#131b2e', borderRadius: '12px', border: '1px solid #1e293b', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Dices size={20} style={{ color: '#ec4899' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                  Live Scraped Tables ({filteredTables.length})
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Real tables from /api/exchange/navigations/casino/casinoTableList
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={28} className="live-indicator" style={{ margin: '0 auto 12px' }} />
                <p>Scraping real live casino tables from nice444.com...</p>
              </div>
            ) : filteredTables.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                No tables returned by exchange for this category.
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: '16px'
              }}>
                {filteredTables.map((t, idx) => (
                  <div
                    key={t.eventId || idx}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* Game Image */}
                    <div style={{ height: '130px', background: '#1e293b', position: 'relative', overflow: 'hidden' }}>
                      {t.image && (
                        <img
                          src={t.image}
                          alt={t.eventName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <span style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: '#38bdf8',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700
                      }}>
                        {t.companyName || 'CASINO'}
                      </span>

                      <span style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: '#059669',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 800
                      }}>
                        LIVE
                      </span>
                    </div>

                    {/* Info & Play Action */}
                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
                        {t.eventName}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                        <span>ID: <code style={{ color: '#94a3b8' }}>{t.eventId}</code></span>
                        <span style={{ textTransform: 'uppercase', color: '#ec4899', fontWeight: 700 }}>
                          {t.room || t.type}
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenLiveTable(t)}
                        style={{
                          marginTop: '6px',
                          padding: '10px',
                          background: 'linear-gradient(135deg, #be185d 0%, #ec4899 100%)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Play size={13} fill="#fff" />
                        <span>OPEN LIVE TABLE</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
