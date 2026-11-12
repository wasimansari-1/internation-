import React, { useState } from 'react';
import { Terminal, Play, Copy, Check, Clock, Shield, BookOpen, FlaskConical } from 'lucide-react';
import axios from 'axios';
import PartnerApiDocs from './PartnerApiDocs';

const PRESET_ENDPOINTS = [
  { name: 'Sports List', endpoint: '/api/exchange/sports/sportsList', payload: {} },
  { name: 'All Match Odds Events', endpoint: '/api/exchange/market/matchodds/allEventsList', payload: {} },
  { name: 'Casino Main Providers', endpoint: '/api/exchange/navigations/casino/casinoMainList', payload: {} },
  { name: 'Casino Tabs Categories', endpoint: '/api/exchange/navigations/casino/casinoTabList', payload: {} },
  { name: 'Casino Tables (All - 12)', endpoint: '/api/exchange/navigations/casino/casinoTableList', payload: { id: 12 } },
  { name: 'Horse Racing Events', endpoint: '/api/exchange/events/racingEventsList', payload: {} },
  { name: 'Virtual Sports', endpoint: '/api/exchange/sports/virtualSportsList', payload: {} },
  { name: 'Exchange Sliders', endpoint: '/api/exchange/slider/sliderList', payload: {} },
  { name: 'Exchange Ticker News', endpoint: '/api/exchange/news/exchangeNews', payload: {} },
  { name: 'Theme Configurations', endpoint: '/api/exchange/theme/getThemeConfig', payload: {} },
  { name: 'Ball by Ball Market (Cricket)', endpoint: '/api/exchange/markets/getBallByBallMarket', payload: { eventId: "3544687543453", sportId: "4", key: "2" } },
  { name: 'Fancy Market List', endpoint: '/api/exchange/markets/fancyMarketList', payload: { eventId: "3544687543453" } }
];

export default function ApiInspector() {
  const [activeTab, setActiveTab] = useState('docs'); // 'docs' | 'tester'
  const [selectedPreset, setSelectedPreset] = useState(PRESET_ENDPOINTS[0]);
  const [endpoint, setEndpoint] = useState(PRESET_ENDPOINTS[0].endpoint);
  const [payloadText, setPayloadText] = useState(JSON.stringify(PRESET_ENDPOINTS[0].payload, null, 2));
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setEndpoint(preset.endpoint);
    setPayloadText(JSON.stringify(preset.payload, null, 2));
  };

  const executeApi = async () => {
    setLoading(true);
    setResponse(null);
    let parsedPayload = {};
    try {
      if (payloadText.trim()) {
        parsedPayload = JSON.parse(payloadText);
      }
    } catch (err) {
      alert('Invalid JSON in payload: ' + err.message);
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post('/api/tester/run', {
        endpoint: endpoint.trim(),
        payload: parsedPayload,
        method: 'POST'
      });
      setResponse(res.data);
    } catch (err) {
      setResponse(err.response?.data || { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-Tab Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('docs')}
          style={{
            background: activeTab === 'docs' ? '#064e3b' : 'transparent',
            color: activeTab === 'docs' ? '#34d399' : '#94a3b8',
            border: activeTab === 'docs' ? '1px solid #059669' : '1px solid #1e293b',
            borderRadius: '8px',
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <BookOpen size={16} />
          <span>Partner Documentation &amp; SDK</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tester')}
          style={{
            background: activeTab === 'tester' ? '#0369a1' : 'transparent',
            color: activeTab === 'tester' ? '#38bdf8' : '#94a3b8',
            border: activeTab === 'tester' ? '1px solid #0284c7' : '1px solid #1e293b',
            borderRadius: '8px',
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <FlaskConical size={16} />
          <span>Interactive Endpoint Tester</span>
        </button>
      </div>

      {activeTab === 'docs' ? (
        <PartnerApiDocs />
      ) : (
        <>
          {/* Top Banner */}
          <div style={{
            background: '#131b2e',
            borderRadius: '12px',
            border: '1px solid #1e293b',
            padding: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={22} style={{ color: '#38bdf8' }} />
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
              API Console & Request Tester
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Live execution against exchange endpoints with verified payload schemas
            </span>
          </div>
        </div>

        <button
          onClick={executeApi}
          disabled={loading}
          style={{
            padding: '10px 24px',
            background: '#0284c7',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Play size={15} fill="#fff" />
          <span>{loading ? 'Executing...' : 'Send Request'}</span>
        </button>
      </div>

      {/* Preset Selector */}
      <div style={{
        background: '#131b2e',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        padding: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span style={{ fontSize: '12px', color: '#94a3b8', width: '100%', marginBottom: '4px', fontWeight: 600 }}>
          Scraped Endpoints Quick Select:
        </span>
        {PRESET_ENDPOINTS.map((preset, idx) => {
          const isSelected = selectedPreset?.name === preset.name;
          return (
            <button
              key={idx}
              onClick={() => handleSelectPreset(preset)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: isSelected ? '1px solid #38bdf8' : '1px solid #334155',
                background: isSelected ? '#0369a1' : '#0f172a',
                color: isSelected ? '#ffffff' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      {/* Editor & Response View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Request Pane */}
        <div style={{
          background: '#131b2e',
          borderRadius: '12px',
          border: '1px solid #1e293b',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Target Endpoint Path:
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#0b0f19',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#38bdf8',
                fontFamily: 'JetBrains Mono',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              JSON Payload (POST body):
            </label>
            <textarea
              rows={12}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              style={{
                width: '100%',
                flex: 1,
                padding: '12px',
                background: '#0b0f19',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontFamily: 'JetBrains Mono',
                fontSize: '12px',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>
        </div>

        {/* Response Pane */}
        <div style={{
          background: '#131b2e',
          borderRadius: '12px',
          border: '1px solid #1e293b',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>API Response</span>
              {response && (
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: response.statusCode === 200 ? '#065f46' : '#991b1b',
                    color: '#fff',
                    fontWeight: 700
                  }}>
                    {response.statusCode}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#1e293b',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Clock size={11} />
                    {response.latency}ms
                  </span>
                </div>
              )}
            </div>

            {response && (
              <button
                onClick={handleCopy}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  color: copied ? '#10b981' : '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>

          <div style={{ flex: 1, minHeight: '320px', background: '#0b0f19', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px', overflow: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
                <Terminal size={24} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                <p>Executing request on https://nice444.com...</p>
              </div>
            ) : response ? (
              <pre style={{ fontSize: '12px', color: '#7dd3fc', margin: 0 }}>
                {JSON.stringify(response, null, 2)}
              </pre>
            ) : (
              <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                Click "Send Request" to test this endpoint.
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

