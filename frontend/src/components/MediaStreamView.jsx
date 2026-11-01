import React, { useState, useEffect } from 'react';
import { Tv, Radio, Image as ImageIcon, Send, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';

export default function MediaStreamView() {
  const [news, setNews] = useState('');
  const [sliders, setSliders] = useState(null);
  const [loadingMedia, setLoadingMedia] = useState(true);

  // Streaming tester state
  const [streamId, setStreamId] = useState('');
  const [streamResult, setStreamResult] = useState(null);
  const [testingStream, setTestingStream] = useState(false);

  const fetchMedia = async () => {
    setLoadingMedia(true);
    try {
      const [newsRes, slidersRes] = await Promise.all([
        axios.get('/api/media/news'),
        axios.get('/api/media/sliders')
      ]);

      if (newsRes.data?.data) {
        setNews(newsRes.data.data.data || '');
      }
      if (slidersRes.data?.data) {
        setSliders(slidersRes.data.data.data || {});
      }
    } catch (err) {
      console.error('Error fetching media:', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const testWatchLink = async () => {
    if (!streamId) return;
    setTestingStream(true);
    setStreamResult(null);
    try {
      const res = await axios.post('/api/stream/watch-link', {
        streamId: streamId.trim()
      });
      setStreamResult(res.data);
    } catch (err) {
      setStreamResult(err.response?.data || { error: err.message });
    } finally {
      setTestingStream(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* News Marquee / Ticker Bar */}
      <div style={{
        background: '#131b2e',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          background: '#0284c7',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 700,
          padding: '4px 8px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap'
        }}>
          <Radio size={14} className="live-indicator" />
          <span>LIVE NEWS</span>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', color: '#f8fafc', fontSize: '13px', fontWeight: 500 }}>
          {news ? (
            <marquee scrollamount="6">{news}</marquee>
          ) : (
            <span style={{ color: '#64748b' }}>No active exchange announcements.</span>
          )}
        </div>

        <button
          onClick={fetchMedia}
          style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer' }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Live Video & AV Stream Tester */}
      <div style={{
        background: '#131b2e',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Tv size={20} style={{ color: '#38bdf8' }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
              Live Match Stream / Watch Link Tester
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Endpoints: /api/exchange/streaming/exchEventsWatchLink & exchEventsStreaming
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Enter Event ID / Stream ID (e.g. 33458921)"
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            style={{
              padding: '10px 14px',
              background: '#0b0f19',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none',
              flex: 1,
              minWidth: '260px'
            }}
          />

          <button
            onClick={testWatchLink}
            disabled={testingStream || !streamId}
            style={{
              padding: '10px 20px',
              background: '#0284c7',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {testingStream ? <RefreshCw size={14} className="live-indicator" /> : <Send size={14} />}
            <span>Fetch Watch Link</span>
          </button>
        </div>

        {streamResult && (
          <div style={{ marginTop: '16px', background: '#0b0f19', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {streamResult.success ? (
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                  <CheckCircle size={14} /> Stream URL Generated ({streamResult.latency}ms)
                </span>
              ) : (
                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                  <AlertTriangle size={14} /> Status: {streamResult.statusCode} ({streamResult.latency}ms)
                </span>
              )}
            </div>

            <pre style={{ fontSize: '11px', background: '#070b14', padding: '12px', borderRadius: '6px', color: '#a5f3fc', overflowX: 'auto' }}>
              {JSON.stringify(streamResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Exchange Banner Sliders */}
      <div style={{
        background: '#131b2e',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <ImageIcon size={20} style={{ color: '#10b981' }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
              Platform Sliders & Creative Media
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              API: /api/exchange/slider/sliderList
            </span>
          </div>
        </div>

        {sliders ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <pre style={{ fontSize: '11px', background: '#0b0f19', padding: '14px', borderRadius: '8px', border: '1px solid #1e293b', color: '#86efac', overflowX: 'auto', maxHeight: '200px' }}>
              {JSON.stringify(sliders, null, 2)}
            </pre>
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: '13px' }}>
            Loading slider assets...
          </div>
        )}
      </div>
    </div>
  );
}

