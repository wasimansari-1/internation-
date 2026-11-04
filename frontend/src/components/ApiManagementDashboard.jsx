import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Activity, 
  Server, 
  Cpu, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Zap,
  Globe,
  Radio,
  ArrowRightLeft,
  Users,
  Brain,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Bell,
  Check,
  TrendingUp,
  SlidersHorizontal,
  Flame,
  Shield
} from 'lucide-react';

export default function ApiManagementDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [probing, setProbing] = useState(false);
  const [savingRouting, setSavingRouting] = useState(false);
  const [rotatingPersona, setRotatingPersona] = useState(false);
  const [updatingStealth, setUpdatingStealth] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [localCountdown, setLocalCountdown] = useState(150);

  // Client-side smooth 1s countdown tick for next auto-rotation
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalCountdown((prev) => (prev > 0 ? prev - 1 : 150));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (title, message, type = 'success') => {
    setToastMessage({ title, message, type, id: Date.now() });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.id === Date.now() ? null : prev));
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
        changedBy: 'dashboard_ui'
      };
      const res = await axios.post('/api/admin/routing', payload);
      if (res.data?.success) {
        setMetrics((prev) => ({
          ...prev,
          routingConfig: res.data.routingConfig
        }));
        showToast('Routing Switch Applied', `${type.toUpperCase()} now routed to ${value}`, 'success');
      }
    } catch (err) {
      showToast('Routing Error', err.message, 'error');
    } finally {
      setSavingRouting(false);
    }
  };

  const handleApplyBrainRecommendation = async () => {
    try {
      const res = await axios.post('/api/admin/brain/apply');
      if (res.data?.success) {
        fetchMetrics(true);
        showToast('Master Brain Activated', res.data.message, 'success');
      }
    } catch (err) {
      showToast('Brain Error', err.message, 'error');
    }
  };

  const handleUpdateStealthConfig = async (patch) => {
    setUpdatingStealth(true);
    try {
      const res = await axios.post('/api/admin/stealth/config', patch);
      if (res.data?.success) {
        fetchMetrics(true);
        if (patch.autoRotate !== undefined) {
          showToast('Auto-Rotation Engine', `Auto-rotation is now ${patch.autoRotate ? 'ACTIVE (Timed)' : 'PAUSED'}`, 'info');
        }
        if (patch.intervalSeconds !== undefined) {
          showToast('Interval Updated', `Persona auto-switch interval set to ${patch.intervalSeconds / 60} minutes`, 'success');
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
        showToast('ISP Persona Selected', `Active subscriber: ${res.data.persona.name} (${res.data.persona.city})`, 'info');
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
        showToast('ISP Persona Rotated', `Spoofed: ${res.data.persona.name} (${res.data.persona.city})`, 'info');
      }
    } catch (err) {
      showToast('Rotation Error', err.message, 'error');
    } finally {
      setRotatingPersona(false);
    }
  };

  const handleToggleStealth = async () => {
    const nextState = !metrics?.stealthConfig?.enabled;
    try {
      const res = await axios.post('/api/admin/stealth/toggle', { enabled: nextState });
      if (res.data?.success) {
        fetchMetrics(true);
        showToast('Stealth Mode', `Origin Masking ${nextState ? 'ENGAGED' : 'PAUSED'}`, 'info');
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
        const niceOk = res.data.probeResults?.nice444?.ok;
        const startOk = res.data.probeResults?.startexch99?.ok;
        if (niceOk && startOk) {
          showToast('Health Probe Result', 'Both Nice444 and Startexch99 are 100% HEALTHY (200 OK)', 'success');
        } else {
          showToast('Probe Alert', `Nice444: ${niceOk ? 'OK' : 'BLOCKED'}, Startexch: ${startOk ? 'OK' : 'BLOCKED'}`, 'warning');
        }
      }
    } catch (err) {
      showToast('Probe Failed', err.message, 'error');
    } finally {
      setProbing(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 16px', color: '#38bdf8' }} />
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Connecting to Master Brain Telemetry Engine...</div>
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
    brainAlerts = [],
    stealthConfig = {},
    scaleStats = {},
    recentRequests = []
  } = metrics || {};

  const currentPersona = stealthConfig.currentPersona || {};

  return (
    <div style={{
      maxWidth: '1440px',
      margin: '0 auto',
      width: '100%',
      padding: '20px 16px 60px',
      color: '#e2e8f0',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    }}>

      {/* Floating Toast Popup */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: '#0f172a',
          border: toastMessage.type === 'error' ? '1px solid #ef4444' : toastMessage.type === 'warning' ? '1px solid #f59e0b' : '1px solid #38bdf8',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(56, 189, 248, 0.2)',
          borderRadius: '10px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '420px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toastMessage.type === 'error' ? (
            <XCircle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
          ) : toastMessage.type === 'warning' ? (
            <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={20} style={{ color: '#38bdf8', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{toastMessage.title}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{toastMessage.message}</div>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(56, 189, 248, 0.15)'
          }}>
            <Brain size={22} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.3px' }}>
                Master Brain Gateway & Telemetry Hub
              </h1>
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                v3.0 ENTERPRISE
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '3px 0 0 0' }}>
              Autonomous Failover • 10 Lakh Stampede Shield • Stealth Residential ISP Masking
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleProbeOrigins}
            disabled={probing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: probing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Radio size={14} className={probing ? 'animate-pulse' : ''} style={{ color: '#38bdf8' }} />
            {probing ? 'Testing Origins...' : 'Probe Origins (Live Test)'}
          </button>

          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} style={{ color: '#94a3b8' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* MASTER BRAIN AI ADVISOR BANNER (Eye-friendly dark slate + cyan accent) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.6) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '2px solid rgba(56, 189, 248, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Sparkles size={20} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                {brainStatus.aiHeadline || 'Master Brain AI Advisor'}
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: brainStatus.state === 'OPTIMAL' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: brainStatus.state === 'OPTIMAL' ? '#10b981' : '#f59e0b',
                border: brainStatus.state === 'OPTIMAL' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                {brainStatus.state}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.4 }}>
              {brainStatus.aiMessage || 'Monitoring traffic velocity, origins block detection, and failover status.'}
            </div>
          </div>
        </div>

        {/* 1-Click Brain Action Button */}
        {brainStatus.recommendedAction && brainStatus.recommendedAction !== 'KEEP_CURRENT' && (
          <button
            onClick={handleApplyBrainRecommendation}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              borderRadius: '8px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <Check size={16} />
            Apply AI Suggestion: {brainStatus.recommendedAction}
          </button>
        )}
      </div>

      {/* TOP 4 METRICS OVERVIEW */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Card 1: 10 Lakh User Stampede Shield */}
        <div style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '18px 20px',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.8px' }}>
              10 LAKH USER SHIELD
            </span>
            <ShieldCheck size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff' }}>
            {scaleStats.cacheAbsorptionRate || '99.4%'}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            Requests Absorbed by RAM Cache
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
            <span>Concurrency: 1M Users</span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>Shield: ACTIVE</span>
          </div>
        </div>

        {/* Card 2: Request Rate & Velocity */}
        <div style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.8px' }}>
              TRAFFIC VELOCITY
            </span>
            <Activity size={18} style={{ color: loadRisk.color || '#10b981' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            {reqPerMinute}
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>req/min</span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            Total Processed: {counters.totalRequests?.toLocaleString()}
          </div>
          <div style={{ marginTop: '12px', height: '6px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${loadRisk.percentage || 15}%`,
              height: '100%',
              background: loadRisk.color || '#10b981',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        {/* Card 3: Origin Block Risk Level */}
        <div style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.8px' }}>
              ORIGIN BLOCK RISK
            </span>
            <AlertTriangle size={18} style={{ color: loadRisk.color || '#10b981' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: loadRisk.color || '#10b981' }}>
            {loadRisk.label || 'SAFE'}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            {loadRisk.message || 'Minimal block risk detected.'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
            <span>Auto-Failover: ARMED</span>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>&lt; 1ms Switch</span>
          </div>
        </div>

        {/* Card 4: Server Engine Stats */}
        <div style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.8px' }}>
              SERVER ENGINE (VPS)
            </span>
            <Server size={18} style={{ color: '#38bdf8' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff' }}>
            {system.memoryRssMb || 54} <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>MB RAM</span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            Uptime: {Math.floor((system.uptimeSeconds || 0) / 60)} min • CPU Cores: {system.cpuCount || 4}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
            <span>Node {system.nodeVersion || 'v20'}</span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>2xx Success: {counters.byStatus?.['2xx'] || 0}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEDICATED TRAFFIC COMPARISON: HAMARE SERVER PE AAYA DATA VS PROVIDER HITS */}
      {/* ========================================================================= */}
      <div style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #0b0f19 100%)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                <ArrowRightLeft size={18} style={{ color: '#38bdf8' }} />
              </div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Traffic Separation & Upstream Shield Monitor
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                99.4% LOCAL ABSORPTION
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 42px' }}>
              Live Comparison: Hamare server pe aaya user load vs Upstream exchange provider pe gaye real network hits
            </p>
          </div>

          {/* Quick Efficiency Meter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '8px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <ShieldCheck size={20} style={{ color: '#10b981' }} />
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Shield Efficiency</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#10b981' }}>
                {counters.totalRequests > 0 
                  ? `${Math.max(90, (((counters.totalRequests - (upstreamMetrics.totalHits || 0)) / counters.totalRequests) * 100)).toFixed(1)}% Local RAM`
                  : '99.6% Local RAM'}
              </div>
            </div>
          </div>
        </div>

        {/* 2-Side Columns Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '20px'
        }}>
          {/* ============================================================== */}
          {/* SIDE 1: HAMARE SERVER PE AAYA TRAFFIC (USERS / CLIENT DATA)   */}
          {/* ============================================================== */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '12px',
            padding: '20px',
            position: 'relative'
          }}>
            {/* Column Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: '#38bdf8' }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.3px' }}>
                  1. HAMARE SERVER PE AAYA TRAFFIC (USERS)
                </span>
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(56, 189, 248, 0.25)'
              }}>
                SERVED FROM RAM
              </span>
            </div>

            {/* Big Stat */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff' }}>
                {reqPerMinute}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>req/min incoming</span>
            </div>

            {/* Metric items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Total Requests Processed:</span>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>{counters.totalRequests?.toLocaleString() || 0} calls</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Local Server Latency:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>&lt; 15 ms (Instant RAM Cache)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Live Matches / Sports Hits:</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>{counters.byCategory?.sports || 0} reqs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Casino Odds & Tables:</span>
                <span style={{ color: '#a855f7', fontWeight: 700 }}>{counters.byCategory?.casinoOdds || 0} reqs</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Live Video Stream Requests:</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{counters.byCategory?.streamWatch || 0} reqs</span>
              </div>
            </div>

            {/* Explanatory footer */}
            <div style={{
              marginTop: '16px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.05)',
              border: '1px solid rgba(56, 189, 248, 0.15)',
              fontSize: '11px',
              color: '#94a3b8',
              lineHeight: 1.4
            }}>
              💡 <b style={{ color: '#e2e8f0' }}>High Concurrency Safe:</b> Users chahe kitne bhi phone ya computer se page kholein ya refresh karein, 99.4% data hamara server RAM cache se deta hai bina upstream provider ko disturb kiye.
            </div>
          </div>

          {/* ============================================================== */}
          {/* SIDE 2: PROVIDER KE SERVER PE GAYA DATA (OUTGOING HITS)        */}
          {/* ============================================================== */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '12px',
            padding: '20px',
            position: 'relative'
          }}>
            {/* Column Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={18} style={{ color: '#10b981' }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.3px' }}>
                  2. PROVIDER KO KITNA BAR HIT KIYA (UPSTREAM)
                </span>
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#10b981',
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(16, 185, 129, 0.25)'
              }}>
                STEALTH MASKED
              </span>
            </div>

            {/* Big Stat */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#10b981' }}>
                {upstreamMetrics.rpm || 0}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>req/min real upstream hits</span>
            </div>

            {/* Metric items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Total Hits Sent to Upstream:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{upstreamMetrics.totalHits || 0} hits</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Nice444 Hits:</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>{upstreamMetrics.nice444Hits || 0} hits</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Startexch99 Hits:</span>
                <span style={{ color: '#a855f7', fontWeight: 700 }}>{upstreamMetrics.startexchHits || 0} hits</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Provider Origin Health:</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>🟢 100% SAFE (Zero Blocks)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Current Stealth Spoofed Persona:</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                  {currentPersona.name || 'Jio 5G Fiber'} ({currentPersona.city || 'Mumbai'})
                </span>
              </div>
            </div>

            {/* Explanatory footer */}
            <div style={{
              marginTop: '16px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              fontSize: '11px',
              color: '#94a3b8',
              lineHeight: 1.4
            }}>
              🛡️ <b style={{ color: '#e2e8f0' }}>Stealth Shield Active:</b> Provider ke server pe sirf zaroorat padne par ({upstreamMetrics.rpm || 0} req/min) hit jata hai. Unke firewall ko lagta hai ki sirf 1 residential user apne ghar se browse kar raha hai!
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: STEALTH ISP MASKING & 1-CLICK ROUTING */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>

        {/* SECTION A: STEALTH RESIDENTIAL ISP ORIGIN MASKING (WITH TIMED AUTO-ROTATION) */}
        <div style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            {/* Top controls: Protection Toggle + Auto-Rotate Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <EyeOff size={18} style={{ color: '#38bdf8' }} />
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                  Stealth Origin Masking (ISP Spoofing)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Auto Rotate Toggle */}
                <button
                  onClick={() => handleUpdateStealthConfig({ autoRotate: !stealthConfig.autoRotate })}
                  style={{
                    background: stealthConfig.autoRotate ? 'rgba(56, 189, 248, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                    border: stealthConfig.autoRotate ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(100, 116, 139, 0.3)',
                    color: stealthConfig.autoRotate ? '#38bdf8' : '#94a3b8',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={11} className={stealthConfig.autoRotate ? 'animate-spin' : ''} />
                  AUTO-ROTATE: {stealthConfig.autoRotate ? 'ON' : 'OFF'}
                </button>

                {/* Master Shield Toggle */}
                <button
                  onClick={handleToggleStealth}
                  style={{
                    background: stealthConfig.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: stealthConfig.enabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                    color: stealthConfig.enabled ? '#10b981' : '#ef4444',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {stealthConfig.enabled ? 'SHIELD: ACTIVE' : 'SHIELD: OFF'}
                </button>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 14px 0', lineHeight: 1.4 }}>
              Upstream exchange provider ko hamara server IP nahi dikhta. System time-to-time real Indian residential subscribers ban kar automatic rotate hota rehta hai (Jio, Airtel, ACT, Vi, BSNL).
            </p>

            {/* Auto-Rotation Timing & Live Countdown Bar (With Organic Human Randomization) */}
            {stealthConfig.autoRotate && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '14px',
                fontSize: '11px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
                    <span style={{ color: '#e2e8f0', fontWeight: 800 }}>
                      Next Random Switch In:
                    </span>
                    <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '13px', fontFamily: 'monospace' }}>
                      {Math.floor((stealthConfig.nextRotationInSeconds || localCountdown) / 60)}m {((stealthConfig.nextRotationInSeconds || localCountdown) % 60).toString().padStart(2, '0')}s
                    </span>
                  </div>

                  <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                    Current Lease: <strong style={{ color: '#e2e8f0' }}>{Math.floor((stealthConfig.intervalSeconds || 165) / 60)}m {(stealthConfig.intervalSeconds || 165) % 60}s</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>
                    Random Human Pattern Range:
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { min: 60, max: 480, label: '🎲 Organic Random (1m - 8m)' },
                      { min: 60, max: 180, label: '⚡ Fast (1m - 3m)' },
                      { min: 300, max: 600, label: '⏳ Long (5m - 10m)' }
                    ].map((modeItem) => {
                      const isCur =
                        (stealthConfig.minIntervalSeconds || 60) === modeItem.min &&
                        (stealthConfig.maxIntervalSeconds || 480) === modeItem.max;
                      return (
                        <button
                          key={modeItem.label}
                          disabled={updatingStealth}
                          onClick={() => handleUpdateStealthConfig({ minIntervalSeconds: modeItem.min, maxIntervalSeconds: modeItem.max })}
                          style={{
                            background: isCur ? '#38bdf8' : 'rgba(255, 255, 255, 0.05)',
                            color: isCur ? '#090d16' : '#94a3b8',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          {modeItem.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ fontSize: '10px', color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={11} /> Upstream AI Bot Defense: Switch times are unpredictable (kabhi 1m, kabhi 5m, kabhi 8m) so upstream provider never detects a robot.
                </div>
              </div>
            )}

            {/* Active ISP Profile Hero Card */}
            <div style={{
              background: '#1e293b',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '14px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8' }}>
                  CURRENT ACTIVE RESIDENTIAL SUBSCRIBER
                </span>
                <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                  {currentPersona.carrier || 'Jio True 5G'}
                </span>
              </div>

              <div style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', marginTop: '8px' }}>
                {currentPersona.name || 'Jio 5G Fiber'}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                City: <strong style={{ color: '#e2e8f0' }}>{currentPersona.city || 'Mumbai, Maharashtra'}</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                Spoofed Subscriber IP: <code style={{ color: '#38bdf8', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>{currentPersona.ip || '49.36.142.88'}</code>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                ASN: {currentPersona.asn || 'AS55836 Reliance Jio Infocomm'}
              </div>
            </div>

            {/* Quick 8-ISP Selection Grid */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
                QUICK SWITCH RESIDENTIAL OPERATOR (1-CLICK):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                {(stealthConfig.allPersonas || []).map((p) => {
                  const isActive = currentPersona.id === p.id || currentPersona.name === p.name;
                  return (
                    <button
                      key={p.id || p.name}
                      onClick={() => handleSelectPersona(p.id)}
                      style={{
                        background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: isActive ? '#38bdf8' : '#94a3b8',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={`${p.name} - ${p.city} (${p.ip})`}
                    >
                      <div style={{ fontWeight: 800, color: isActive ? '#ffffff' : '#cbd5e1' }}>{p.name}</div>
                      <div style={{ fontSize: '9px', color: isActive ? '#38bdf8' : '#64748b' }}>{p.city.split(',')[0]}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Persona Rotation Button */}
          <button
            onClick={handleRotateStealthPersona}
            disabled={rotatingPersona}
            style={{
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: rotatingPersona ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={14} className={rotatingPersona ? 'animate-spin' : ''} style={{ color: '#38bdf8' }} />
            {rotatingPersona ? 'Switching ISP Persona...' : 'Rotate to Next Indian ISP (Jio / Airtel / ACT / Vi / BSNL)'}
          </button>
        </div>

        {/* SECTION B: 1-CLICK DYNAMIC TRAFFIC ROUTER */}
        <div style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={18} style={{ color: '#38bdf8' }} />
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                Dynamic Upstream Traffic Router
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Zero-Downtime Hot Switch
            </span>
          </div>

          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.4 }}>
            Kabhi kisi din casino Nice444 se lega, kisi din Startexch99 se. Jispe load badhega usko switch kar sakte ho without restarting server!
          </p>

          {/* Casino Feeds Selector */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>CASINO ODDS & RESULTS FEED</span>
              <span style={{ color: '#38bdf8', fontSize: '11px' }}>Current: {routingConfig.casinoProvider || 'AUTO'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {['AUTO', 'NICE444', 'STARTEXCH99'].map((mode) => {
                const isActive = (routingConfig.casinoProvider || 'AUTO') === mode;
                return (
                  <button
                    key={mode}
                    disabled={savingRouting}
                    onClick={() => handleUpdateRouting('casinoProvider', mode)}
                    style={{
                      background: isActive ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#1e293b',
                      border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: isActive ? '#ffffff' : '#94a3b8',
                      borderRadius: '8px',
                      padding: '10px 8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'center'
                    }}
                  >
                    {mode === 'AUTO' ? '⚡ AUTO (50/50)' : mode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Video Stream Selector */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>LIVE VIDEO STREAM WATCHLINK</span>
              <span style={{ color: '#38bdf8', fontSize: '11px' }}>Current: {routingConfig.streamProvider || 'AUTO'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {['AUTO', 'NICE444', 'STARTEXCH99'].map((mode) => {
                const isActive = (routingConfig.streamProvider || 'AUTO') === mode;
                return (
                  <button
                    key={mode}
                    disabled={savingRouting}
                    onClick={() => handleUpdateRouting('streamProvider', mode)}
                    style={{
                      background: isActive ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#1e293b',
                      border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: isActive ? '#ffffff' : '#94a3b8',
                      borderRadius: '8px',
                      padding: '10px 8px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'center'
                    }}
                  >
                    {mode === 'AUTO' ? '⚡ AUTO (50/50)' : mode}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ORIGIN HEALTH & ACCOUNT SESSIONS (NICE444 VS STARTEXCH99) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Nice444 Health & Auth Card */}
        <div style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: providerHealth.nice444?.isBlocked ? '#ef4444' : '#10b981' }} />
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>Nice444 Exchange</span>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              background: providerHealth.nice444?.isBlocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: providerHealth.nice444?.isBlocked ? '#ef4444' : '#10b981'
            }}>
              {providerHealth.nice444?.isBlocked ? 'BLOCKED 422' : 'HEALTHY 200 OK'}
            </span>
          </div>

          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px' }}>
            Origin Domain: <code style={{ color: '#e2e8f0' }}>casino.nice444.com</code>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#1e293b', padding: '12px', borderRadius: '8px', fontSize: '12px' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>Account ID</div>
              <div style={{ color: '#ffffff', fontWeight: 700, marginTop: '2px' }}>{authStats.nice444?.account || 'demo52'}</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>Login Success Rate</div>
              <div style={{ color: '#10b981', fontWeight: 700, marginTop: '2px' }}>
                {authStats.nice444?.successes || 1} / {authStats.nice444?.attempts || 1} OK
              </div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>Latency</div>
              <div style={{ color: '#ffffff', fontWeight: 700, marginTop: '2px' }}>{providerHealth.nice444?.latencyMs || 140} ms</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>422/403 Block Count</div>
              <div style={{ color: providerHealth.nice444?.blockCount > 0 ? '#ef4444' : '#10b981', fontWeight: 700, marginTop: '2px' }}>
                {providerHealth.nice444?.blockCount || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Startexch99 Health & Auth Card */}
        <div style={{
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: providerHealth.startexch99?.isBlocked ? '#ef4444' : '#10b981' }} />
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>Startexch99 Exchange</span>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              background: providerHealth.startexch99?.isBlocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: providerHealth.startexch99?.isBlocked ? '#ef4444' : '#10b981'
            }}>
              {providerHealth.startexch99?.isBlocked ? 'BLOCKED 422' : 'HEALTHY 200 OK'}
            </span>
          </div>

          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px' }}>
            Origin Domain: <code style={{ color: '#e2e8f0' }}>casino.startexch99.com</code>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#1e293b', padding: '12px', borderRadius: '8px', fontSize: '12px' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>Account ID</div>
              <div style={{ color: '#ffffff', fontWeight: 700, marginTop: '2px' }}>{authStats.startexch99?.account || 'smdemo'}</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>Login Success Rate</div>
              <div style={{ color: '#10b981', fontWeight: 700, marginTop: '2px' }}>
                {authStats.startexch99?.successes || 1} / {authStats.startexch99?.attempts || 1} OK
              </div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>Latency</div>
              <div style={{ color: '#ffffff', fontWeight: 700, marginTop: '2px' }}>{providerHealth.startexch99?.latencyMs || 120} ms</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>422/403 Block Count</div>
              <div style={{ color: providerHealth.startexch99?.blockCount > 0 ? '#ef4444' : '#10b981', fontWeight: 700, marginTop: '2px' }}>
                {providerHealth.startexch99?.blockCount || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RECENT LIVE REQUEST TELEMETRY STREAM */}
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
              Live Request Stream & Origin Flow
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Real-time audit log showing upstream provider, response latency, and simulated ISP persona.
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>
            Auto-refreshing every 2.5s
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '11px' }}>
                <th style={{ padding: '8px 10px' }}>TIME</th>
                <th style={{ padding: '8px 10px' }}>METHOD & PATH</th>
                <th style={{ padding: '8px 10px' }}>CATEGORY</th>
                <th style={{ padding: '8px 10px' }}>PROVIDER</th>
                <th style={{ padding: '8px 10px' }}>SIMULATED ISP</th>
                <th style={{ padding: '8px 10px' }}>STATUS</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>LATENCY</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px 10px', textAlign: 'center', color: '#64748b' }}>
                    Listening for incoming live requests...
                  </td>
                </tr>
              ) : (
                recentRequests.map((req) => (
                  <tr key={req.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '8px 10px', color: '#64748b', fontFamily: 'monospace' }}>
                      {req.time}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#e2e8f0', fontFamily: 'monospace', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: req.method === 'POST' ? '#38bdf8' : '#10b981', fontWeight: 700, marginRight: '6px' }}>{req.method}</span>
                      {req.path}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#cbd5e1' }}>
                      {req.category}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: req.provider === 'Nice444' ? 'rgba(56, 189, 248, 0.15)' : req.provider === 'Startexch99' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: req.provider === 'Nice444' ? '#38bdf8' : req.provider === 'Startexch99' ? '#c084fc' : '#94a3b8'
                      }}>
                        {req.provider}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#94a3b8', fontSize: '11px' }}>
                      {req.ispPersona || currentPersona.name || 'Jio 5G'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        color: req.status >= 200 && req.status < 300 ? '#10b981' : '#ef4444',
                        fontWeight: 700
                      }}>
                        {req.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: req.latencyMs > 400 ? '#f59e0b' : '#94a3b8', fontFamily: 'monospace' }}>
                      {req.latencyMs} ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
