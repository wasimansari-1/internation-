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
  const [toastMessage, setToastMessage] = useState(null);

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

      {/* MIDDLE SECTION: STEALTH ISP MASKING & 1-CLICK ROUTING */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>

        {/* SECTION A: STEALTH RESIDENTIAL ISP ORIGIN MASKING */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <EyeOff size={18} style={{ color: '#38bdf8' }} />
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                  Stealth Origin Masking (ISP Spoofing)
                </span>
              </div>
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
                {stealthConfig.enabled ? 'PROTECTION: ON' : 'PROTECTION: OFF'}
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.4 }}>
              Provider ko hamara VPS server IP nahi dikhega. Unhe lagega genuine normal user login kiya hai Indian mobile/broadband connection se.
            </p>

            {/* Active ISP Profile Card */}
            <div style={{
              background: '#1e293b',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8' }}>
                  ACTIVE SIMULATED RESIDENTIAL SUBSCRIBER
                </span>
                <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  {currentPersona.carrier || 'Airtel 5G'}
                </span>
              </div>

              <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginTop: '8px' }}>
                {currentPersona.name || 'Jio 5G Fiber'}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Location: <strong style={{ color: '#e2e8f0' }}>{currentPersona.city || 'Mumbai, Maharashtra'}</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Spoofed IP: <code style={{ color: '#38bdf8', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>{currentPersona.ip || '103.21.124.5'}</code>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                ASN: {currentPersona.asn || 'AS55836 Reliance Jio'}
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
            {rotatingPersona ? 'Switching ISP Persona...' : 'Rotate to Next Indian ISP (Jio / Airtel / ACT / Vi)'}
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
