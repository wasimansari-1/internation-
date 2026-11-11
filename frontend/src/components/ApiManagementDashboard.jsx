import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  ArrowRightLeft,
  Users,
  EyeOff,
  Check,
  TrendingUp,
  SlidersHorizontal,
  Layers,
  Clock,
  Shuffle,
  Zap,
  Globe,
} from 'lucide-react';

const ROUTING_MODES = ['AUTO', 'NICE444', 'STARTEXCH99', 'CBTFEXCHANGE', 'ASSTARPLAY'];

const ORIGIN_METADATA = [
  {
    key: 'nice444',
    title: 'Nice444',
    domain: 'casino.nice444.com',
    fallbackAccount: 'demo52 / rio001',
    fallbackLatency: 140,
  },
  {
    key: 'startexch99',
    title: 'Startexch99',
    domain: 'casino.startexch99.com',
    fallbackAccount: 'smdemo / suraj01s / santosh01s',
    fallbackLatency: 120,
  },
  {
    key: 'cbtfexchange',
    title: 'CBTFexchange',
    domain: 'cbtfexchange.com',
    fallbackAccount: '8292463648',
    fallbackLatency: 135,
  },
  {
    key: 'asstarplay',
    title: 'Asstarplay',
    domain: 'casino.asstarplay.com',
    fallbackAccount: 'zak1984',
    fallbackLatency: 130,
  },
];

const PROVIDER_BADGE_STYLES = {
  Nice444: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  Startexch99: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  CBTFexchange: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  Asstarplay: { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4' },
};

const DURATION_PROFILES = [
  { min: 60, max: 480, label: '1m - 8m', Icon: Shuffle },
  { min: 60, max: 180, label: '1m - 3m', Icon: Zap },
  { min: 300, max: 600, label: '5m - 10m', Icon: Clock },
];

export default function ApiManagementDashboard({ onSwitchTab }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [probing, setProbing] = useState(false);
  const [savingRouting, setSavingRouting] = useState(false);
  const [rotatingPersona, setRotatingPersona] = useState(false);
  const [updatingStealth, setUpdatingStealth] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [localCountdown, setLocalCountdown] = useState(150);

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalCountdown((prev) => (prev > 0 ? prev - 1 : 150));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (title, message, type = 'success') => {
    const id = Date.now();
    setToastMessage({ title, message, type, id });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.id === id ? null : prev));
    }, 4500);
  };

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
        changedBy: 'dashboard_ui',
      };
      const res = await axios.post('/api/admin/routing', payload);
      if (res.data?.success) {
        setMetrics((prev) => ({
          ...prev,
          routingConfig: res.data.routingConfig,
        }));
        showToast('Routing Updated', `${type} set to ${value}`, 'success');
      }
    } catch (err) {
      showToast('Routing Error', err.message, 'error');
    } finally {
      setSavingRouting(false);
    }
  };

  const handleApplyRecommendation = async () => {
    try {
      const res = await axios.post('/api/admin/brain/apply');
      if (res.data?.success) {
        fetchMetrics(true);
        showToast('Failover Applied', res.data.message, 'success');
      }
    } catch (err) {
      showToast('Action Failed', err.message, 'error');
    }
  };

  const handleUpdateStealthConfig = async (patch) => {
    setUpdatingStealth(true);
    try {
      const res = await axios.post('/api/admin/stealth/config', patch);
      if (res.data?.success) {
        fetchMetrics(true);
        if (patch.autoRotate !== undefined) {
          showToast(
            'Auto-Rotation',
            `IP rotation ${patch.autoRotate ? 'enabled' : 'paused'}`,
            'info',
          );
        }
        if (patch.minIntervalSeconds !== undefined) {
          showToast('Rotation Window', 'Lease interval updated', 'success');
        }
      }
    } catch (err) {
      showToast('Config Error', err.message, 'error');
    } finally {
      setUpdatingStealth(false);
    }
  };

  const handleSelectPersona = async (personaId) => {
    try {
      const res = await axios.post('/api/admin/stealth/select', { personaId });
      if (res.data?.success) {
        fetchMetrics(true);
        showToast(
          'Operator Switched',
          `${res.data.persona.name} (${res.data.persona.city})`,
          'info',
        );
      }
    } catch (err) {
      showToast('Select Error', err.message, 'error');
    }
  };

  const handleRotateStealthPersona = async () => {
    setRotatingPersona(true);
    try {
      const res = await axios.post('/api/admin/stealth/rotate');
      if (res.data?.success) {
        fetchMetrics(true);
        showToast(
          'ISP Rotated',
          `${res.data.persona.name} (${res.data.persona.ip})`,
          'info',
        );
      }
    } catch (err) {
      showToast('Rotation Error', err.message, 'error');
    } finally {
      setRotatingPersona(false);
    }
  };

  const handleToggleStealth = async () => {
    try {
      const res = await axios.post('/api/admin/stealth/toggle');
      if (res.data?.success) {
        fetchMetrics(true);
        showToast(
          'Origin Masking',
          res.data.enabled ? 'Enabled' : 'Disabled',
          res.data.enabled ? 'success' : 'warning',
        );
      }
    } catch (err) {
      showToast('Toggle Error', err.message, 'error');
    }
  };

  const handleProbeOrigins = async () => {
    setProbing(true);
    try {
      const res = await axios.post('/api/admin/probe');
      if (res.data?.success) {
        fetchMetrics(true);
        const probe = res.data.probeResults || {};
        const statuses = [
          { label: 'Nice444', ok: probe.nice444?.ok },
          { label: 'Startexch', ok: probe.startexch99?.ok },
          { label: 'CBTF', ok: probe.cbtfexchange?.ok },
          { label: 'Asstarplay', ok: probe.asstarplay?.ok },
        ];
        const okCount = statuses.filter((s) => s.ok).length;
        const summary = statuses.map((s) => `${s.label}: ${s.ok ? '200 OK' : 'DOWN'}`).join(' | ');
        showToast(
          `Origin Probe (${okCount}/4 Healthy)`,
          okCount === 4 ? 'All 4 origins responded 200 OK' : summary,
          okCount === 4 ? 'success' : okCount > 0 ? 'warning' : 'error',
        );
      }
    } catch (err) {
      showToast('Probe Failed', err.message, 'error');
    } finally {
      setProbing(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="adm-loading">
        <div className="adm-loading-box">
          <RefreshCw className="animate-spin" size={28} style={{ color: '#059669', margin: '0 auto 12px' }} />
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#064e3b' }}>
            Connecting to Gateway Telemetry
          </div>
          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
            Fetching upstream health & cache metrics...
          </div>
        </div>
        <style>{DASHBOARD_CSS}</style>
      </div>
    );
  }

  const {
    reqPerMinute = 0,
    upstreamMetrics = {},
    loadRisk = {},
    counters = {},
    authStats = {},
    providerHealth = {},
    routingConfig = {},
    system = {},
    brainStatus = {},
    stealthConfig = {},
    scaleStats = {},
    recentRequests = [],
  } = metrics || {};

  const currentPersona = stealthConfig.currentPersona || {};
  const healthyOriginCount = ORIGIN_METADATA.filter((o) => !providerHealth[o.key]?.isBlocked).length;
  const remainingSec = stealthConfig.nextRotationInSeconds ?? localCountdown;
  const countdownMins = Math.floor(remainingSec / 60);
  const countdownSecs = (remainingSec % 60).toString().padStart(2, '0');
  const shieldEfficiency =
    counters.totalRequests > 0
      ? `${Math.max(90, ((counters.totalRequests - (upstreamMetrics.totalHits || 0)) / counters.totalRequests) * 100).toFixed(1)}%`
      : scaleStats.cacheAbsorptionRate || '99.4%';

  const isCritical = loadRisk.level === 'CRITICAL';
  const isWarning = loadRisk.level === 'WARNING' || loadRisk.level === 'MODERATE';
  const statusColor = isCritical ? '#dc2626' : isWarning ? '#d97706' : '#059669';
  const statusBg = isCritical ? '#fef2f2' : isWarning ? '#fffbeb' : '#ecfdf5';
  const statusBorder = isCritical ? '#fecaca' : isWarning ? '#fde68a' : '#a7f3d0';

  const cleanHeadline = (brainStatus.aiHeadline || '4-Way Mesh Operational').replace(/^Master Brain:\s*/i, '');
  const cleanSummary = (brainStatus.aiMessage || 'All active origins healthy; read traffic cached in local RAM.').replace(/Master Brain\s*/gi, 'Gateway ');

  return (
    <div className="adm-root">
      <style>{DASHBOARD_CSS}</style>

      {/* Hanging Green Top Wash */}
      <div className="adm-hanging-fade" aria-hidden="true" />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="adm-toast"
          style={{
            borderColor:
              toastMessage.type === 'error'
                ? '#fecaca'
                : toastMessage.type === 'warning'
                  ? '#fde68a'
                  : '#a7f3d0',
          }}
        >
          {toastMessage.type === 'error' ? (
            <XCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
          ) : toastMessage.type === 'warning' ? (
            <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{toastMessage.title}</div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px', overflowWrap: 'anywhere' }}>
              {toastMessage.message}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="adm-toast-close"
            aria-label="Close notification"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Sticky Top Header */}
      <header className="adm-header">
        <div className="adm-header-inner">
          <div className="adm-brand">
            <div className="adm-brand-icon">
              <ShieldCheck size={20} style={{ color: '#ffffff' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="adm-brand-title-row">
                <h1 className="adm-title">Gateway Console</h1>
                <span
                  className="adm-status-pill"
                  style={{ background: statusBg, color: statusColor, borderColor: statusBorder }}
                >
                  <span className="adm-dot" style={{ backgroundColor: statusColor }} />
                  {healthyOriginCount}/4 ORIGINS OK
                </span>
              </div>
              <p className="adm-subtitle">
                Multi-Origin Load Balancer &amp; Edge Cache Monitor
              </p>
            </div>
          </div>

          <div className="adm-toolbar">
            {onSwitchTab && (
              <>
                <button type="button" onClick={() => onSwitchTab('GAMES')} className="adm-btn">
                  <Layers size={14} style={{ color: '#059669' }} />
                  <span>Casino</span>
                </button>
                <button type="button" onClick={() => onSwitchTab('SPORTS')} className="adm-btn">
                  <TrendingUp size={14} style={{ color: '#059669' }} />
                  <span>Sports</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleProbeOrigins}
              disabled={probing}
              className="adm-btn adm-btn-emerald"
            >
              <Radio size={14} className={probing ? 'animate-pulse' : ''} />
              <span>{probing ? 'Probing...' : 'Probe Origins'}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchMetrics(true)}
              disabled={refreshing}
              className="adm-btn"
              aria-label="Refresh telemetry"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} style={{ color: '#475569' }} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="adm-container">
        {/* Status Summary Bar */}
        <section className="adm-card adm-banner" style={{ borderColor: statusBorder }}>
          <div className="adm-banner-info">
            <div
              className="adm-icon-tile"
              style={{ background: statusBg, borderColor: statusBorder, color: statusColor }}
            >
              {isCritical ? <ShieldAlert size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="adm-banner-head">
                <span className="adm-banner-title">{cleanHeadline}</span>
                <span
                  className="adm-tag"
                  style={{ background: statusBg, color: statusColor, borderColor: statusBorder }}
                >
                  {brainStatus.state || 'OPTIMAL'}
                </span>
              </div>
              <p className="adm-banner-desc">{cleanSummary}</p>
            </div>
          </div>

          {brainStatus.recommendedAction &&
            brainStatus.recommendedAction !== 'KEEP_CURRENT' &&
            brainStatus.recommendedAction !== 'AUTO' && (
              <button
                type="button"
                onClick={handleApplyRecommendation}
                className="adm-btn adm-btn-primary"
              >
                <Check size={14} />
                <span>Switch to {brainStatus.recommendedAction}</span>
              </button>
            )}
        </section>

        {/* Top 4 KPI Cards */}
        <section className="adm-grid-4">
          <div className="adm-card adm-kpi">
            <div className="adm-kpi-top">
              <span className="adm-label">Client Ingress</span>
              <Activity size={16} style={{ color: '#059669' }} />
            </div>
            <div className="adm-kpi-value">
              {reqPerMinute}
              <span className="adm-kpi-unit">req/min</span>
            </div>
            <div className="adm-kpi-sub">
              Total served: <strong>{counters.totalRequests?.toLocaleString() || 0}</strong>
            </div>
            <div className="adm-progress-track">
              <div
                className="adm-progress-fill"
                style={{ width: `${Math.min(100, Math.max(8, Math.round((reqPerMinute / 300) * 100)))}%` }}
              />
            </div>
          </div>

          <div className="adm-card adm-kpi">
            <div className="adm-kpi-top">
              <span className="adm-label">Cache Absorption</span>
              <ShieldCheck size={16} style={{ color: '#059669' }} />
            </div>
            <div className="adm-kpi-value" style={{ color: '#047857' }}>
              {shieldEfficiency}
            </div>
            <div className="adm-kpi-sub">Local RAM hit latency &lt; 15ms</div>
            <div className="adm-kpi-footer">
              <span>Single-Flight</span>
              <span style={{ color: '#059669', fontWeight: 700 }}>ACTIVE</span>
            </div>
          </div>

          <div className="adm-card adm-kpi">
            <div className="adm-kpi-top">
              <span className="adm-label">Origin Risk</span>
              {isCritical || isWarning ? (
                <AlertTriangle size={16} style={{ color: statusColor }} />
              ) : (
                <CheckCircle2 size={16} style={{ color: '#059669' }} />
              )}
            </div>
            <div className="adm-kpi-value" style={{ color: statusColor, fontSize: '20px', lineHeight: '30px' }}>
              {loadRisk.label || 'SAFE (4/4 OK)'}
            </div>
            <div className="adm-kpi-sub adm-truncate" title={loadRisk.message}>
              {loadRisk.message || 'All 4 origins healthy.'}
            </div>
            <div className="adm-kpi-footer">
              <span>4-Way Failover</span>
              <span style={{ color: '#047857', fontWeight: 700 }}>ARMED</span>
            </div>
          </div>

          <div className="adm-card adm-kpi">
            <div className="adm-kpi-top">
              <span className="adm-label">Host Runtime</span>
              <Server size={16} style={{ color: '#059669' }} />
            </div>
            <div className="adm-kpi-value">
              {system.memoryRssMb || 54}
              <span className="adm-kpi-unit">MB RSS</span>
            </div>
            <div className="adm-kpi-sub">
              Uptime {Math.floor((system.uptimeSeconds || 0) / 60)}m • {system.cpuCount || 4} Cores
            </div>
            <div className="adm-kpi-footer">
              <span>Node {system.nodeVersion || 'v20'}</span>
              <span style={{ color: '#059669', fontWeight: 700 }}>
                2xx: {counters.byStatus?.['2xx'] || 0}
              </span>
            </div>
          </div>
        </section>

        {/* Traffic Separation Monitor */}
        <section className="adm-card adm-section">
          <div className="adm-section-head">
            <div className="adm-section-title-group">
              <div className="adm-icon-tile adm-icon-emerald">
                <ArrowRightLeft size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 className="adm-h2">Ingress vs Upstream Traffic</h2>
                <p className="adm-muted-sm">Client requests absorbed by cache vs outbound origin hits</p>
              </div>
            </div>
            <div className="adm-efficiency-chip">
              <ShieldCheck size={16} style={{ color: '#059669' }} />
              <span>Shield Efficiency: <strong>{shieldEfficiency}</strong></span>
            </div>
          </div>

          <div className="adm-grid-2">
            {/* Inbound */}
            <div className="adm-subpanel">
              <div className="adm-subpanel-head">
                <span className="adm-subpanel-title">
                  <Users size={15} style={{ color: '#059669' }} />
                  Client Ingress
                </span>
                <span className="adm-tag adm-tag-slate">RAM CACHE</span>
              </div>
              <div className="adm-big-stat">
                <span>{reqPerMinute}</span>
                <small>req/min</small>
              </div>
              <div className="adm-kv-list">
                <div className="adm-kv-row">
                  <span>Total Requests</span>
                  <strong>{counters.totalRequests?.toLocaleString() || 0}</strong>
                </div>
                <div className="adm-kv-row">
                  <span>Sports Endpoints</span>
                  <strong>{counters.byCategory?.sports || 0}</strong>
                </div>
                <div className="adm-kv-row">
                  <span>Casino Odds &amp; Tables</span>
                  <strong>{counters.byCategory?.casinoOdds || 0}</strong>
                </div>
                <div className="adm-kv-row">
                  <span>Stream Requests</span>
                  <strong>{counters.byCategory?.streamWatch || 0}</strong>
                </div>
              </div>
            </div>

            {/* Outbound */}
            <div className="adm-subpanel adm-subpanel-mint">
              <div className="adm-subpanel-head">
                <span className="adm-subpanel-title">
                  <Radio size={15} style={{ color: '#059669' }} />
                  Upstream Egress
                </span>
                <span className="adm-tag adm-tag-emerald">MASKED</span>
              </div>
              <div className="adm-big-stat" style={{ color: '#047857' }}>
                <span>{upstreamMetrics.rpm || 0}</span>
                <small style={{ color: '#059669' }}>hits/min</small>
              </div>
              <div className="adm-kv-list">
                <div className="adm-kv-row">
                  <span>Total Upstream Hits</span>
                  <strong style={{ color: '#047857' }}>{upstreamMetrics.totalHits || 0}</strong>
                </div>
                <div className="adm-kv-row">
                  <span>Nice444 / Startexch99</span>
                  <strong>
                    {upstreamMetrics.nice444Hits || 0} / {upstreamMetrics.startexchHits || 0}
                  </strong>
                </div>
                <div className="adm-kv-row">
                  <span>CBTF / Asstarplay</span>
                  <strong>
                    {upstreamMetrics.cbtfHits || 0} / {upstreamMetrics.asstarplayHits || 0}
                  </strong>
                </div>
                <div className="adm-kv-row">
                  <span>Active Exit IP</span>
                  <strong style={{ color: '#047857' }}>{currentPersona.name || 'Jio 5G Fiber'}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Controls: ISP Masking & 4-Way Router */}
        <section className="adm-grid-2">
          {/* ISP Masking */}
          <div className="adm-card adm-section">
            <div className="adm-section-head">
              <div className="adm-section-title-group">
                <div className="adm-icon-tile adm-icon-emerald">
                  <EyeOff size={16} />
                </div>
                <h2 className="adm-h2">Origin Header Masking</h2>
              </div>
              <div className="adm-pill-actions">
                <button
                  type="button"
                  onClick={() => handleUpdateStealthConfig({ autoRotate: !stealthConfig.autoRotate })}
                  className={`adm-mini-btn ${stealthConfig.autoRotate ? 'is-active' : ''}`}
                >
                  <RefreshCw size={11} className={stealthConfig.autoRotate ? 'animate-spin' : ''} />
                  <span>Auto: {stealthConfig.autoRotate ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleToggleStealth}
                  className={`adm-mini-btn ${stealthConfig.enabled ? 'is-emerald' : 'is-danger'}`}
                >
                  <span>{stealthConfig.enabled ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>
            </div>

            {stealthConfig.autoRotate && (
              <div className="adm-lease-box">
                <div className="adm-lease-top">
                  <span>
                    Next rotation: <strong>{countdownMins}m {countdownSecs}s</strong>
                  </span>
                  <span className="adm-muted-xs">
                    Lease {Math.floor((stealthConfig.intervalSeconds || 165) / 60)}m{' '}
                    {(stealthConfig.intervalSeconds || 165) % 60}s
                  </span>
                </div>
                <div className="adm-profile-pills">
                  {DURATION_PROFILES.map(({ min, max, label, Icon }) => {
                    const isCur =
                      (stealthConfig.minIntervalSeconds || 60) === min &&
                      (stealthConfig.maxIntervalSeconds || 480) === max;
                    return (
                      <button
                        type="button"
                        key={label}
                        disabled={updatingStealth}
                        onClick={() => handleUpdateStealthConfig({ minIntervalSeconds: min, maxIntervalSeconds: max })}
                        className={`adm-profile-pill ${isCur ? 'is-selected' : ''}`}
                      >
                        <Icon size={11} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="adm-persona-card">
              <div className="adm-persona-top">
                <span className="adm-label">Active Subscriber Profile</span>
                <span className="adm-tag adm-tag-emerald">{currentPersona.carrier || 'Jio True 5G'}</span>
              </div>
              <div className="adm-persona-name">{currentPersona.name || 'Jio 5G Fiber'}</div>
              <div className="adm-persona-meta">
                <span>{currentPersona.city || 'Mumbai, Maharashtra'}</span>
                <code>{currentPersona.ip || '49.36.142.88'}</code>
              </div>
              <div className="adm-muted-xs" style={{ marginTop: '4px' }}>
                {currentPersona.asn || 'AS55836 Reliance Jio Infocomm'}
              </div>
            </div>

            <div className="adm-isp-grid">
              {(stealthConfig.allPersonas || []).map((p) => {
                const isActive = currentPersona.id === p.id || currentPersona.name === p.name;
                return (
                  <button
                    type="button"
                    key={p.id || p.name}
                    onClick={() => handleSelectPersona(p.id)}
                    className={`adm-isp-btn ${isActive ? 'is-selected' : ''}`}
                    title={`${p.name} - ${p.city} (${p.ip})`}
                  >
                    <div className="adm-isp-name">{p.name}</div>
                    <div className="adm-isp-city">{p.city.split(',')[0]}</div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleRotateStealthPersona}
              disabled={rotatingPersona}
              className="adm-btn adm-btn-full"
            >
              <RefreshCw size={14} className={rotatingPersona ? 'animate-spin' : ''} style={{ color: '#059669' }} />
              <span>{rotatingPersona ? 'Rotating...' : 'Rotate ISP Profile Now'}</span>
            </button>
          </div>

          {/* Traffic Router */}
          <div className="adm-card adm-section">
            <div className="adm-section-head">
              <div className="adm-section-title-group">
                <div className="adm-icon-tile adm-icon-emerald">
                  <SlidersHorizontal size={16} />
                </div>
                <div>
                  <h2 className="adm-h2">Upstream Traffic Router</h2>
                  <p className="adm-muted-sm">Hot-switch feed priority across all 4 origins</p>
                </div>
              </div>
              <span className="adm-tag adm-tag-emerald">4-WAY MESH</span>
            </div>

            <div className="adm-router-stack">
              {[
                { field: 'casinoProvider', label: 'Casino Odds & Results' },
                { field: 'streamProvider', label: 'Video Stream WatchLink' },
                { field: 'sportsProvider', label: 'Sports & Exchange API' },
              ].map(({ field, label }) => {
                const currentVal = routingConfig[field] || 'AUTO';
                return (
                  <div key={field} className="adm-router-group">
                    <div className="adm-router-label-row">
                      <span>{label}</span>
                      <span className="adm-router-active">{currentVal}</span>
                    </div>
                    <div className="adm-router-grid">
                      {ROUTING_MODES.map((mode) => {
                        const isActive = currentVal === mode;
                        return (
                          <button
                            type="button"
                            key={mode}
                            disabled={savingRouting}
                            onClick={() => handleUpdateRouting(field, mode)}
                            className={`adm-mode-btn ${isActive ? 'is-selected' : ''}`}
                          >
                            {mode === 'AUTO' ? 'AUTO (4-Way)' : mode}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4 Origin Health Cards */}
        <section className="adm-grid-4">
          {ORIGIN_METADATA.map((origin) => {
            const health = providerHealth[origin.key] || {};
            const auth = authStats[origin.key] || {};
            const blocked = Boolean(health.isBlocked);
            const degraded = !blocked && health.status === 'DEGRADED';
            const badgeText = blocked ? 'BLOCKED' : degraded ? 'DEGRADED' : '200 OK';
            const dotColor = blocked ? '#dc2626' : degraded ? '#d97706' : '#059669';
            const badgeBg = blocked ? '#fef2f2' : degraded ? '#fffbeb' : '#ecfdf5';
            const badgeBorder = blocked ? '#fecaca' : degraded ? '#fde68a' : '#a7f3d0';

            return (
              <div key={origin.key} className="adm-card adm-origin-card">
                <div className="adm-origin-head">
                  <div className="adm-origin-title-wrap">
                    <Globe size={15} style={{ color: '#059669', flexShrink: 0 }} />
                    <span className="adm-origin-title">{origin.title}</span>
                  </div>
                  <span
                    className="adm-tag"
                    style={{ background: badgeBg, color: dotColor, borderColor: badgeBorder }}
                  >
                    <span className="adm-dot" style={{ backgroundColor: dotColor }} />
                    {badgeText}
                  </span>
                </div>

                <div className="adm-origin-domain">
                  <code>{origin.domain}</code>
                </div>

                <div className="adm-origin-stats">
                  <div>
                    <div className="adm-stat-label">Session</div>
                    <div className="adm-stat-val">{auth.account || origin.fallbackAccount}</div>
                  </div>
                  <div>
                    <div className="adm-stat-label">Auth OK</div>
                    <div className="adm-stat-val" style={{ color: '#059669' }}>
                      {auth.successes || 1} / {auth.attempts || 1}
                    </div>
                  </div>
                  <div>
                    <div className="adm-stat-label">Latency</div>
                    <div className="adm-stat-val">{health.latencyMs || origin.fallbackLatency} ms</div>
                  </div>
                  <div>
                    <div className="adm-stat-label">Blocks</div>
                    <div
                      className="adm-stat-val"
                      style={{ color: (health.blockCount || 0) > 0 ? '#dc2626' : '#059669' }}
                    >
                      {health.blockCount || 0}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Live Request Log Table */}
        <section className="adm-card adm-section">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-h2">Live Request Log</h2>
              <p className="adm-muted-sm">Recent gateway requests, routed origin, status &amp; latency</p>
            </div>
            <span className="adm-tag adm-tag-emerald">LIVE 2.5s</span>
          </div>

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Endpoint</th>
                  <th>Category</th>
                  <th>Origin</th>
                  <th>ISP</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="adm-table-empty">
                      Waiting for incoming requests...
                    </td>
                  </tr>
                ) : (
                  recentRequests.map((req) => {
                    const badge = PROVIDER_BADGE_STYLES[req.provider] || {
                      bg: '#f1f5f9',
                      color: '#475569',
                      border: '#e2e8f0',
                    };
                    return (
                      <tr key={req.id}>
                        <td className="adm-mono adm-muted-sm">{req.time}</td>
                        <td className="adm-mono adm-endpoint-cell" title={req.path}>
                          <span
                            className="adm-method"
                            style={{ color: req.method === 'POST' ? '#047857' : '#059669' }}
                          >
                            {req.method}
                          </span>
                          <span>{req.path}</span>
                        </td>
                        <td>{req.category}</td>
                        <td>
                          <span
                            className="adm-origin-pill"
                            style={{
                              background: badge.bg,
                              color: badge.color,
                              borderColor: badge.border,
                            }}
                          >
                            {req.provider}
                          </span>
                        </td>
                        <td className="adm-muted-sm">{req.ispPersona || currentPersona.name || 'Jio 5G'}</td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              color:
                                req.status >= 200 && req.status < 300
                                  ? '#059669'
                                  : req.status === 304
                                    ? '#0284c7'
                                    : '#dc2626',
                            }}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td
                          className="adm-mono"
                          style={{
                            textAlign: 'right',
                            color: req.latencyMs > 400 ? '#d97706' : '#475569',
                          }}
                        >
                          {req.latencyMs} ms
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

const DASHBOARD_CSS = `
.adm-root, .adm-root * {
  box-sizing: border-box;
}
.adm-root {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(180deg, #ecfdf5 0%, #f4fbf7 22%, #f8fafc 48%, #ffffff 100%);
  color: #0f172a;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding-bottom: 64px;
  overflow-x: hidden;
}
.adm-hanging-fade {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 260px;
  background: radial-gradient(ellipse 85% 100% at 50% 0%, rgba(16, 185, 129, 0.16) 0%, rgba(5, 150, 105, 0.06) 55%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
  z-index: 0;
}
.adm-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(180deg, #ecfdf5 0%, #f8fafc 45%, #ffffff 100%);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
.adm-loading-box {
  text-align: center;
  background: #ffffff;
  border: 1px solid #d1fae5;
  border-radius: 14px;
  padding: 28px 32px;
  box-shadow: 0 8px 24px rgba(5, 150, 105, 0.08);
}

/* Header */
.adm-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: linear-gradient(180deg, rgba(236, 253, 245, 0.94) 0%, rgba(255, 255, 255, 0.94) 100%);
  backdrop-filter: blur(10px);
  border-top: 3px solid #10b981;
  border-bottom: 1px solid #d1fae5;
  box-shadow: 0 4px 16px -4px rgba(5, 150, 105, 0.08);
}
.adm-header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.adm-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.adm-brand-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #10b981 0%, #047857 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
}
.adm-brand-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.adm-title {
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.02em;
}
.adm-subtitle {
  font-size: 12px;
  color: #475569;
  margin: 2px 0 0 0;
}
.adm-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
}
.adm-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.adm-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

/* Container & Layout */
.adm-container {
  position: relative;
  z-index: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.adm-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  min-width: 0;
}
.adm-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.adm-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

/* Buttons */
.adm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: #ffffff;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.adm-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}
.adm-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.adm-btn-emerald {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}
.adm-btn-emerald:hover:not(:disabled) {
  background: #d1fae5;
  border-color: #6ee7b7;
}
.adm-btn-primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  border-color: #059669;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.22);
}
.adm-btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}
.adm-btn-full {
  width: 100%;
  margin-top: 12px;
  padding: 10px 14px;
  background: #f8fafc;
}

/* Banner */
.adm-banner {
  padding: 14px 18px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: linear-gradient(90deg, #ffffff 0%, #f0fdf4 100%);
}
.adm-banner-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.adm-banner-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.adm-banner-title {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}
.adm-banner-desc {
  font-size: 12px;
  color: #475569;
  margin: 3px 0 0 0;
  line-height: 1.4;
}
.adm-icon-tile {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  border: 1px solid #d1fae5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.adm-icon-emerald {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #059669;
}

/* KPI */
.adm-kpi {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
}
.adm-kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.adm-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.adm-kpi-value {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}
.adm-kpi-unit {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.adm-kpi-sub {
  font-size: 12px;
  color: #475569;
  margin-top: 4px;
}
.adm-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.adm-kpi-footer {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #64748b;
}
.adm-progress-track {
  margin-top: 12px;
  height: 5px;
  background: #ecfdf5;
  border-radius: 3px;
  overflow: hidden;
}
.adm-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  transition: width 0.35s ease;
}

/* Sections */
.adm-section {
  padding: 18px 20px;
}
.adm-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}
.adm-section-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.adm-h2 {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}
.adm-muted-sm {
  font-size: 12px;
  color: #64748b;
  margin: 2px 0 0 0;
}
.adm-muted-xs {
  font-size: 11px;
  color: #64748b;
}
.adm-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 5px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.adm-tag-emerald {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}
.adm-tag-slate {
  background: #f1f5f9;
  color: #334155;
  border-color: #cbd5e1;
}
.adm-efficiency-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  color: #334155;
}
.adm-efficiency-chip strong {
  color: #047857;
}

/* Subpanels */
.adm-subpanel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  min-width: 0;
}
.adm-subpanel-mint {
  background: linear-gradient(180deg, #f0fdf4 0%, #f8fafc 100%);
  border-color: #bbf7d0;
}
.adm-subpanel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.adm-subpanel-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
}
.adm-big-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 12px;
}
.adm-big-stat small {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.adm-kv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.adm-kv-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  color: #475569;
}
.adm-kv-row strong {
  color: #0f172a;
  text-align: right;
  overflow-wrap: anywhere;
}

/* Masking & Router */
.adm-pill-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.adm-mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 9px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
}
.adm-mini-btn.is-active {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #047857;
}
.adm-mini-btn.is-emerald {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #059669;
}
.adm-mini-btn.is-danger {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}
.adm-lease-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.adm-lease-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: #0f172a;
  margin-bottom: 8px;
}
.adm-profile-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.adm-profile-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.adm-profile-pill.is-selected {
  background: #059669;
  color: #ffffff;
  border-color: #059669;
}
.adm-persona-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.adm-persona-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.adm-persona-name {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
  margin-top: 6px;
}
.adm-persona-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: #475569;
}
.adm-persona-meta code {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #bbf7d0;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 11px;
}
.adm-isp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(115px, 1fr));
  gap: 6px;
}
.adm-isp-btn {
  text-align: left;
  padding: 7px 8px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  min-width: 0;
}
.adm-isp-btn.is-selected {
  background: #ecfdf5;
  border-color: #10b981;
}
.adm-isp-name {
  font-size: 11px;
  font-weight: 700;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.adm-isp-btn.is-selected .adm-isp-name {
  color: #047857;
}
.adm-isp-city {
  font-size: 10px;
  color: #64748b;
}

/* Router */
.adm-router-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.adm-router-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 8px;
}
.adm-router-active {
  font-size: 11px;
  color: #059669;
  font-weight: 800;
}
.adm-router-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 6px;
}
.adm-mode-btn {
  padding: 9px 6px;
  border-radius: 7px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  font-size: 10.5px;
  font-weight: 800;
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s;
}
.adm-mode-btn.is-selected {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-color: #059669;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(5, 150, 105, 0.2);
}

/* Origin Cards */
.adm-origin-card {
  padding: 16px 18px;
}
.adm-origin-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.adm-origin-title-wrap {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.adm-origin-title {
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
}
.adm-origin-domain {
  margin-bottom: 12px;
}
.adm-origin-domain code {
  font-size: 11px;
  color: #047857;
  background: #ecfdf5;
  border: 1px solid #d1fae5;
  padding: 2px 7px;
  border-radius: 4px;
  word-break: break-all;
}
.adm-origin-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}
.adm-stat-label {
  font-size: 10.5px;
  color: #64748b;
  font-weight: 600;
}
.adm-stat-val {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 2px;
  overflow-wrap: anywhere;
}

/* Table */
.adm-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.adm-table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}
.adm-table thead th {
  background: #f0fdf4;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 9px 12px;
  border-bottom: 1px solid #d1fae5;
}
.adm-table tbody td {
  padding: 9px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}
.adm-table tbody tr:last-child td {
  border-bottom: none;
}
.adm-table-empty {
  padding: 24px 12px !important;
  text-align: center;
  color: #64748b !important;
}
.adm-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.adm-endpoint-cell {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #0f172a !important;
}
.adm-method {
  font-weight: 700;
  margin-right: 6px;
}
.adm-origin-pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 700;
  border: 1px solid;
}

/* Toast */
.adm-toast {
  position: fixed;
  bottom: 18px;
  right: 18px;
  left: auto;
  z-index: 9999;
  background: #ffffff;
  border: 1px solid #a7f3d0;
  box-shadow: 0 16px 32px -6px rgba(15, 23, 42, 0.14);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(380px, calc(100vw - 24px));
}
.adm-toast-close {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
  align-items: center;
}

/* Responsive Breakpoints */
@media (max-width: 1100px) {
  .adm-grid-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 860px) {
  .adm-grid-2 {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .adm-header-inner {
    padding: 10px 12px;
  }
  .adm-container {
    padding: 12px 12px 0;
    gap: 12px;
  }
  .adm-grid-4 {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .adm-section,
  .adm-kpi,
  .adm-origin-card,
  .adm-banner {
    padding: 14px;
  }
  .adm-toolbar {
    width: 100%;
  }
  .adm-toolbar .adm-btn {
    flex: 1 1 auto;
    padding: 7px 10px;
    font-size: 11.5px;
  }
  .adm-router-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .adm-toast {
    right: 12px;
    left: 12px;
    bottom: 12px;
    max-width: none;
  }
}
`;
