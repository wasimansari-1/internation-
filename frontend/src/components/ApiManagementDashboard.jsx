import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Server, 
  Cpu, 
  RefreshCw, 
  Sliders, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Zap,
  Globe,
  Radio,
  ArrowRightLeft,
  Users
} from 'lucide-react';

export default function ApiManagementDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [probing, setProbing] = useState(false);
  const [savingRouting, setSavingRouting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchMetrics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await axios.get('/api/admin/metrics?_t=' + Date.now());
      if (res.data?.success) {
        setMetrics(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch admin metrics:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(() => fetchMetrics(false), 2500);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateRouting = async (type, value) => {
    setSavingRouting(true);
    try {
      const current = metrics?.routingConfig || {};
      const payload = {
        ...current,
        [type]: value,
        changedBy: 'dashboard_ui'
      };
      const res = await axios.post('/api/admin/routing', payload);
      if (res.data?.success) {
        setActionMessage(`Routing updated: ${type} → ${value}`);
        setTimeout(() => setActionMessage(null), 3000);
        fetchMetrics();
      }
    } catch (err) {
      alert('Error updating routing: ' + err.message);
    } finally {
      setSavingRouting(false);
    }
  };

  const handleProbeOrigins = async () => {
    setProbing(true);
    try {
      const res = await axios.post('/api/admin/probe');
      if (res.data?.success) {
        setActionMessage('Origin probes completed. Status refreshed.');
        setTimeout(() => setActionMessage(null), 3500);
        fetchMetrics();
      }
    } catch (err) {
      alert('Probe error: ' + err.message);
    } finally {
      setProbing(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 14px auto', color: '#10b981' }} />
        <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px' }}>CONNECTING TELEMETRY ENGINE...</div>
      </div>
    );
  }

  const {
    reqPerMinute = 0,
    loadRisk = {},
    counters = {},
    authStats = {},
    providerHealth = {},
    routingConfig = {},
    recentRequests = [],
    system = {}
  } = metrics || {};

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* Top Banner Header */}
      <div style={{
        backgroundColor: '#090d16',
        borderRadius: '10px',
        border: '1px solid #1e293b',
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 900, letterSpacing: '0.5px', color: '#ffffff' }}>
              API GATEWAY & LOAD TELEMETRY
            </h1>
            <span style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
              PRODUCTION v2.4
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            Real-time provider routing, origin block prevention, account session health, and load balancing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {actionMessage && (
            <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 800, backgroundColor: 'rgba(16,185,129,0.12)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.3)' }}>
              ✓ {actionMessage}
            </span>
          )}
          <button
            onClick={handleProbeOrigins}
            disabled={probing}
            style={{
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Radio size={14} className={probing ? 'animate-pulse text-amber-400' : ''} />
            {probing ? 'Testing Origins...' : 'Probe Origins'}
          </button>
          <button
            onClick={() => fetchMetrics(true)}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        
        {/* Card 1: Load & Request Velocity */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>
            <span>TRAFFIC RATE (60s)</span>
            <Activity size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px 0' }}>
            {reqPerMinute} <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>req/min</span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            Total Processed: <b style={{ color: '#f8fafc' }}>{counters.totalRequests?.toLocaleString()}</b>
          </div>
        </div>

        {/* Card 2: Origin Block Risk Meter */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>
            <span>ORIGIN BLOCK RISK</span>
            {loadRisk.level === 'CRITICAL' ? <ShieldAlert size={16} color="#ef4444" /> : <ShieldCheck size={16} color="#10b981" />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 6px 0' }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 900,
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: `${loadRisk.color}22`,
              color: loadRisk.color,
              border: `1px solid ${loadRisk.color}55`
            }}>
              {loadRisk.label}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Limit: &lt;150 req/min</span>
          </div>
          {/* Progress Bar */}
          <div style={{ width: '100%', height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${loadRisk.percentage || 10}%`, height: '100%', backgroundColor: loadRisk.color, transition: 'all 0.3s' }} />
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
            {loadRisk.message}
          </div>
        </div>

        {/* Card 3: Provider Health (Nice444 vs Startexch99) */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>
            <span>ORIGIN STATUS</span>
            <Globe size={16} color="#34d399" />
          </div>
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#f8fafc', fontWeight: 700 }}>Nice444:</span>
              <span style={{
                color: providerHealth.nice444?.isBlocked ? '#ef4444' : '#10b981',
                fontWeight: 800,
                fontSize: '11px'
              }}>
                {providerHealth.nice444?.isBlocked ? 'BLOCKED' : 'ONLINE'} ({providerHealth.nice444?.latencyMs}ms)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#f8fafc', fontWeight: 700 }}>Startexch99:</span>
              <span style={{
                color: providerHealth.startexch99?.isBlocked ? '#ef4444' : '#10b981',
                fontWeight: 800,
                fontSize: '11px'
              }}>
                {providerHealth.startexch99?.isBlocked ? 'BLOCKED' : 'ONLINE'} ({providerHealth.startexch99?.latencyMs}ms)
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: VPS Server Engine Metrics */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>
            <span>SERVER ENGINE</span>
            <Server size={16} color="#a855f7" />
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Memory RSS:</span>
              <span style={{ fontWeight: 800, color: '#f8fafc' }}>{system.memoryRssMb} MB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Uptime:</span>
              <span style={{ fontWeight: 800, color: '#f8fafc' }}>{Math.floor((system.uptimeSeconds || 0) / 60)}m {((system.uptimeSeconds || 0) % 60)}s</span>
            </div>
          </div>
        </div>

      </div>

      {/* Dynamic Routing Switcher Section */}
      <div style={{
        backgroundColor: '#0f172a',
        borderRadius: '10px',
        border: '1px solid #1e293b',
        padding: '20px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <ArrowRightLeft size={18} color="#f59e0b" />
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px' }}>
            DYNAMIC UPSTREAM TRAFFIC ROUTER (1-CLICK SWITCH)
          </h2>
        </div>
        <p style={{ margin: '0 0 18px 0', fontSize: '12px', color: '#64748b' }}>
          Control live data flow. If one provider origin gets rate-limited, immediately switch 100% of the traffic to the other provider without restarting the server!
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* Casino Feeds Routing Switch */}
          <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
              Casino Live Odds & Results Provider
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { label: '50/50 AUTO BALANCED', value: 'AUTO' },
                { label: 'NICE444 ONLY', value: 'NICE444' },
                { label: 'STARTEXCH ONLY', value: 'STARTEXCH99' },
              ].map((opt) => {
                const active = (routingConfig.casinoProvider || 'AUTO') === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleUpdateRouting('casinoProvider', opt.value)}
                    disabled={savingRouting}
                    style={{
                      flex: 1,
                      padding: '8px 6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      borderRadius: '5px',
                      cursor: 'pointer',
                      border: active ? '1px solid #10b981' : '1px solid #1e293b',
                      backgroundColor: active ? 'rgba(16, 185, 129, 0.18)' : '#0f172a',
                      color: active ? '#10b981' : '#94a3b8',
                      transition: 'all 0.15s'
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>
              Active Route: <b style={{ color: '#38bdf8' }}>{routingConfig.casinoProvider || 'AUTO'}</b>
            </div>
          </div>

          {/* Video Stream Routing Switch */}
          <div style={{ backgroundColor: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
              Live TV Stream WatchLink Provider
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { label: '50/50 AUTO BALANCED', value: 'AUTO' },
                { label: 'NICE444 ONLY', value: 'NICE444' },
                { label: 'STARTEXCH ONLY', value: 'STARTEXCH99' },
              ].map((opt) => {
                const active = (routingConfig.streamProvider || 'AUTO') === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleUpdateRouting('streamProvider', opt.value)}
                    disabled={savingRouting}
                    style={{
                      flex: 1,
                      padding: '8px 6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      borderRadius: '5px',
                      cursor: 'pointer',
                      border: active ? '1px solid #0284c7' : '1px solid #1e293b',
                      backgroundColor: active ? 'rgba(2, 132, 199, 0.18)' : '#0f172a',
                      color: active ? '#38bdf8' : '#94a3b8',
                      transition: 'all 0.15s'
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>
              Active Route: <b style={{ color: '#38bdf8' }}>{routingConfig.streamProvider || 'AUTO'}</b>
            </div>
          </div>

        </div>
      </div>

      {/* Account & Auth Status Section */}
      <div style={{
        backgroundColor: '#0f172a',
        borderRadius: '10px',
        border: '1px solid #1e293b',
        padding: '20px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Users size={18} color="#38bdf8" />
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px' }}>
            AUTHENTICATION & ACCOUNT SESSION TELEMETRY
          </h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11px' }}>
                <th style={{ padding: '10px 12px' }}>PROVIDER</th>
                <th style={{ padding: '10px 12px' }}>DEMO USER ID</th>
                <th style={{ padding: '10px 12px' }}>STATUS</th>
                <th style={{ padding: '10px 12px' }}>LOGIN ATTEMPTS</th>
                <th style={{ padding: '10px 12px' }}>SUCCESSES</th>
                <th style={{ padding: '10px 12px' }}>FAILURES</th>
                <th style={{ padding: '10px 12px' }}>LAST LOGIN</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(authStats).map(([key, item]) => (
                <tr key={key} style={{ borderBottom: '1px solid #141f33' }}>
                  <td style={{ padding: '12px', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase' }}>
                    {key}
                  </td>
                  <td style={{ padding: '12px', color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
                    {item.account}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      backgroundColor: item.status === 'ACTIVE' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                      color: item.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: 800,
                      fontSize: '11px'
                    }}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 700, color: '#f8fafc' }}>
                    {item.attempts}
                  </td>
                  <td style={{ padding: '12px', fontWeight: 700, color: '#10b981' }}>
                    {item.successes}
                  </td>
                  <td style={{ padding: '12px', fontWeight: 700, color: item.failures > 0 ? '#ef4444' : '#64748b' }}>
                    {item.failures}
                  </td>
                  <td style={{ padding: '12px', color: '#94a3b8', fontSize: '11px' }}>
                    {item.lastSuccess ? new Date(item.lastSuccess).toLocaleTimeString('en-IN') : 'Just now'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Request Stream (Latest 25 Requests) */}
      <div style={{
        backgroundColor: '#0f172a',
        borderRadius: '10px',
        border: '1px solid #1e293b',
        padding: '20px 24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#34d399" />
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px' }}>
              LIVE REQUEST TELEMETRY STREAM (LATEST 30)
            </h2>
          </div>
          <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
            Auto-refreshing every 2.5s
          </span>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '380px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f172a' }}>
              <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b' }}>
                <th style={{ padding: '8px 10px' }}>TIME</th>
                <th style={{ padding: '8px 10px' }}>METHOD</th>
                <th style={{ padding: '8px 10px' }}>ENDPOINT / PATH</th>
                <th style={{ padding: '8px 10px' }}>CATEGORY</th>
                <th style={{ padding: '8px 10px' }}>STATUS</th>
                <th style={{ padding: '8px 10px' }}>LATENCY</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.map((req) => {
                const is2xx = req.status >= 200 && req.status < 300;
                const statusColor = is2xx ? '#10b981' : req.status === 422 ? '#f59e0b' : '#ef4444';
                return (
                  <tr key={req.id} style={{ borderBottom: '1px solid #141f33' }}>
                    <td style={{ padding: '8px 10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      {req.time}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 800, color: '#f8fafc' }}>
                      {req.method}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#38bdf8', fontFamily: 'monospace', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.path}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#cbd5e1', fontWeight: 700 }}>
                      {req.category}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: `${statusColor}22`,
                        color: statusColor,
                        fontWeight: 800,
                        fontSize: '10px'
                      }}>
                        {req.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      {req.latencyMs}ms
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
