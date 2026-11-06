import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Globe,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Flame,
  ArrowUpRight,
  ExternalLink,
  Search,
  Filter,
  Radio,
  Clock,
  Terminal,
  Database,
  Key,
  Power
} from 'lucide-react';

export default function ApiManagementDashboard({ onSwitchTab }) {
  // Navigation tabs within Gateway Admin
  const [activeTab, setActiveTab] = useState('FIREWALL'); // 'FIREWALL' | 'UPSTREAMS' | 'TRAFFIC' | 'STEALTH' | 'AUTHORITY'

  // Data states
  const [firewallData, setFirewallData] = useState(null);
  const [upstreamsData, setUpstreamsData] = useState([]);
  const [telemetryMetrics, setTelemetryMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [probingUpstreams, setProbingUpstreams] = useState(false);

  // Search & Filter
  const [domainSearch, setDomainSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ALLOWED' | 'BLOCKED'

  // Password Modal State for Wasim@123#
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState(null); // { type: 'BLOCK' | 'UNBLOCK' | 'KILL_SWITCH' | 'RELOGIN', targetDomain: string, payload: any }
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Manual Add Domain State
  const [manualDomain, setManualDomain] = useState('');

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = (title, message, type = 'success') => {
    setToast({ title, message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev?.id === Date.now() ? null : prev));
    }, 4000);
  };

  // Fetch Firewall & Tracked Domains
  const fetchFirewallStatus = async () => {
    try {
      const res = await axios.get('/api/admin/firewall/status?_t=' + Date.now());
      if (res.data?.success) {
        setFirewallData(res.data);
      }
    } catch (e) {
      console.warn('Failed to fetch firewall status:', e);
    }
  };

  // Fetch Upstreams Health & Status
  const fetchUpstreams = async () => {
    try {
      const res = await axios.get('/api/admin/upstreams?_t=' + Date.now());
      if (res.data?.success && Array.isArray(res.data.upstreams)) {
        setUpstreamsData(res.data.upstreams);
      }
    } catch (e) {
      console.warn('Failed to fetch upstreams:', e);
    }
  };

  // Fetch Telemetry & Stealth Metrics
  const fetchTelemetry = async () => {
    try {
      const res = await axios.get('/api/admin/metrics?_t=' + Date.now());
      if (res.data?.success) {
        setTelemetryMetrics(res.data);
      }
    } catch (e) {
      console.warn('Failed to fetch telemetry metrics:', e);
    }
  };

  const loadAllData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    await Promise.all([fetchFirewallStatus(), fetchUpstreams(), fetchTelemetry()]);
    setLoading(false);
    if (isManual) setRefreshing(false);
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      fetchFirewallStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // On-demand Upstream Origin Probe
  const handleProbeOrigins = async () => {
    setProbingUpstreams(true);
    try {
      const res = await axios.get('/api/admin/upstreams?_t=' + Date.now());
      if (res.data?.success) {
        setUpstreamsData(res.data.upstreams);
        showToast('Origin Probe Completed', 'All 5 upstream sources checked for origin-side blocks.', 'success');
      }
    } catch (e) {
      showToast('Probe Error', e.message, 'error');
    } finally {
      setProbingUpstreams(false);
    }
  };

  // Open confirmation modal for password-protected actions
  const promptSecurityAction = (action) => {
    setModalAction(action);
    setPasswordInput('');
    setPasswordError('');
    setShowPassword(false);
    setModalOpen(true);
  };

  // Execute Password-Protected Action
  const executeModalAction = async (e) => {
    if (e) e.preventDefault();
    if (!passwordInput) {
      setPasswordError('Please enter administrator password.');
      return;
    }
    setActionLoading(true);
    setPasswordError('');

    try {
      if (modalAction.type === 'BLOCK') {
        const res = await axios.post('/api/admin/firewall/block', {
          domain: modalAction.targetDomain,
          password: passwordInput
        });
        if (res.data?.success) {
          showToast('Domain Blocked', `Domain '${modalAction.targetDomain}' is now blocked with HTTP 403.`, 'success');
          setModalOpen(false);
          setManualDomain('');
          fetchFirewallStatus();
        }
      } else if (modalAction.type === 'UNBLOCK') {
        const res = await axios.post('/api/admin/firewall/unblock', {
          domain: modalAction.targetDomain,
          password: passwordInput
        });
        if (res.data?.success) {
          showToast('Domain Unlocked', `Domain '${modalAction.targetDomain}' is now allowed to access API.`, 'success');
          setModalOpen(false);
          fetchFirewallStatus();
        }
      } else if (modalAction.type === 'KILL_SWITCH') {
        const res = await axios.post('/api/admin/firewall/kill-switch', {
          state: modalAction.state,
          password: passwordInput
        });
        if (res.data?.success) {
          showToast('Emergency Kill-Switch', res.data.message, modalAction.state ? 'warning' : 'success');
          setModalOpen(false);
          fetchFirewallStatus();
        }
      } else if (modalAction.type === 'RELOGIN') {
        const res = await axios.post('/api/admin/auth/relogin', {
          password: passwordInput
        });
        if (res.data?.success) {
          showToast('Sessions Refreshed', 'Upstream Startexch & Nice444 sessions re-authenticated.', 'success');
          setModalOpen(false);
          fetchTelemetry();
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Authentication Failed';
      setPasswordError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Persona switch
  const handleSelectPersona = async (personaId) => {
    try {
      const res = await axios.post('/api/admin/stealth/select', { personaId });
      if (res.data?.success) {
        showToast('ISP Persona Switched', res.data.message, 'success');
        fetchTelemetry();
      }
    } catch (e) {
      showToast('Error', e.message, 'error');
    }
  };

  // Filter client domains
  const filteredDomains = (firewallData?.clientDomains || []).filter((item) => {
    const matchesSearch = item.domain.toLowerCase().includes(domainSearch.toLowerCase());
    if (statusFilter === 'ALLOWED') return matchesSearch && !item.isBlocked;
    if (statusFilter === 'BLOCKED') return matchesSearch && item.isBlocked;
    return matchesSearch;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#090d16',
      color: '#f8fafc',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ========================================================================= */}
      {/* 1. DEDICATED ADMIN / GATEWAY HEADER (Alag Header)                         */}
      {/* ========================================================================= */}
      <header style={{
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        padding: '0 24px',
        height: '62px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Brand Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '16px',
            color: '#fff',
            boxShadow: '0 0 12px rgba(2, 132, 199, 0.4)'
          }}>
            U
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.5px', color: '#f8fafc' }}>
                UNIVERSAL GATEWAY
              </span>
              <span style={{
                background: 'rgba(56, 189, 248, 0.1)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700
              }}>
                ADMIN V2
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: firewallData?.summary?.emergencyKillSwitch ? '#ef4444' : '#22c55e',
                boxShadow: firewallData?.summary?.emergencyKillSwitch ? '0 0 8px #ef4444' : '0 0 8px #22c55e'
              }}></span>
              <span>{firewallData?.summary?.emergencyKillSwitch ? 'FIREWALL EMERGENCY PAUSE' : 'GATEWAY OPERATIONAL (ALL PROXIES ACTIVE)'}</span>
            </div>
          </div>
        </div>

        {/* Center Nav Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#090d16', padding: '3px', borderRadius: '8px', border: '1px solid #1e293b' }}>
          <button
            onClick={() => setActiveTab('FIREWALL')}
            style={{
              background: activeTab === 'FIREWALL' ? '#1e293b' : 'transparent',
              color: activeTab === 'FIREWALL' ? '#f8fafc' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Shield size={13} style={{ color: activeTab === 'FIREWALL' ? '#38bdf8' : '#64748b' }} />
            <span>Inbound Domains</span>
            {firewallData?.summary?.blockedDomainsCount > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '10px' }}>
                {firewallData.summary.blockedDomainsCount} BLOCKED
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('UPSTREAMS')}
            style={{
              background: activeTab === 'UPSTREAMS' ? '#1e293b' : 'transparent',
              color: activeTab === 'UPSTREAMS' ? '#f8fafc' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Globe size={13} style={{ color: activeTab === 'UPSTREAMS' ? '#22c55e' : '#64748b' }} />
            <span>Upstream Origins</span>
          </button>

          <button
            onClick={() => setActiveTab('TRAFFIC')}
            style={{
              background: activeTab === 'TRAFFIC' ? '#1e293b' : 'transparent',
              color: activeTab === 'TRAFFIC' ? '#f8fafc' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Activity size={13} style={{ color: activeTab === 'TRAFFIC' ? '#f59e0b' : '#64748b' }} />
            <span>Live Traffic</span>
          </button>

          <button
            onClick={() => setActiveTab('STEALTH')}
            style={{
              background: activeTab === 'STEALTH' ? '#1e293b' : 'transparent',
              color: activeTab === 'STEALTH' ? '#f8fafc' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Radio size={13} style={{ color: activeTab === 'STEALTH' ? '#a855f7' : '#64748b' }} />
            <span>Stealth ISP</span>
          </button>

          <button
            onClick={() => setActiveTab('AUTHORITY')}
            style={{
              background: activeTab === 'AUTHORITY' ? '#1e293b' : 'transparent',
              color: activeTab === 'AUTHORITY' ? '#f8fafc' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Key size={13} style={{ color: activeTab === 'AUTHORITY' ? '#ef4444' : '#64748b' }} />
            <span>Authority Controls</span>
          </button>
        </nav>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => loadAllData(true)}
            disabled={refreshing}
            style={{
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            title="Refresh All Gateway Data"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => onSwitchTab('SPORTS')}
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Sports App ↗</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ padding: '24px', maxWidth: '1440px', width: '100%', margin: '0 auto', flex: 1 }}>

        {/* ========================================================================= */}
        {/* TAB 1: INBOUND DOMAINS & DOMAIN FIREWALL (User Requirement #3)            */}
        {/* ========================================================================= */}
        {activeTab === 'FIREWALL' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Quick Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Tracked Client Domains
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#f8fafc' }}>
                  {firewallData?.summary?.totalClientDomains || 0}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Domains & Origins hitting this API
                </div>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Active Allowed Domains
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#22c55e' }}>
                  {firewallData?.summary?.activeDomains || 0}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Traffic allowed with 200 OK
                </div>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Blocked Domains (Firewalled)
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: firewallData?.summary?.blockedDomainsCount > 0 ? '#ef4444' : '#94a3b8' }}>
                  {firewallData?.summary?.blockedDomainsCount || 0}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Rejected with HTTP 403 Forbidden
                </div>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Total Inbound API Hits
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#38bdf8' }}>
                  {Number(firewallData?.summary?.totalInboundRequests || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Blocked hits: {Number(firewallData?.summary?.totalBlockedRequests || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Manual Domain Block Form */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
                  Manually Block Any Domain or Origin
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Block any external domain from accessing your sports & casino APIs. Requires password: <code style={{ color: '#facc15' }}>Wasim@123#</code>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="e.g. unauthorized-site.com or 104.21.32.1"
                  value={manualDomain}
                  onChange={(e) => setManualDomain(e.target.value)}
                  style={{
                    background: '#090d16',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: '#fff',
                    width: '260px'
                  }}
                />
                <button
                  onClick={() => {
                    if (!manualDomain.trim()) return;
                    promptSecurityAction({ type: 'BLOCK', targetDomain: manualDomain.trim() });
                  }}
                  disabled={!manualDomain.trim()}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: manualDomain.trim() ? 'pointer' : 'not-allowed',
                    opacity: manualDomain.trim() ? 1 : 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Lock size={13} />
                  <span>Block Domain</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '400px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Search caller domain..."
                    value={domainSearch}
                    onChange={(e) => setDomainSearch(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '8px 12px 8px 32px',
                      fontSize: '12px',
                      color: '#fff'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {['ALL', 'ALLOWED', 'BLOCKED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      background: statusFilter === st ? '#1e293b' : '#0f172a',
                      color: statusFilter === st ? '#f8fafc' : '#94a3b8',
                      border: '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Inbound Domains Table */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#131b2e', borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '11px', fontWeight: 800 }}>
                    <th style={{ padding: '12px 16px' }}>CLIENT DOMAIN / ORIGIN</th>
                    <th style={{ padding: '12px 16px' }}>STATUS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>TOTAL HITS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>BLOCKED HITS</th>
                    <th style={{ padding: '12px 16px' }}>LAST ENDPOINT</th>
                    <th style={{ padding: '12px 16px' }}>LAST SEEN</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>FIREWALL ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDomains.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                        No caller domains matched the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDomains.map((c) => (
                      <tr
                        key={c.domain}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: c.isBlocked ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: c.isBlocked ? '#ef4444' : '#f8fafc' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Globe size={14} style={{ color: c.isBlocked ? '#ef4444' : '#38bdf8' }} />
                            <span>{c.domain}</span>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          {c.isBlocked ? (
                            <span style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 800
                            }}>
                              BLOCKED (403)
                            </span>
                          ) : (
                            <span style={{
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: '#22c55e',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 800
                            }}>
                              ALLOWED (200 OK)
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#f8fafc' }}>
                          {c.hits.toLocaleString()}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: c.blockedHits > 0 ? '#ef4444' : '#64748b' }}>
                          {c.blockedHits.toLocaleString()}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px' }}>
                          {c.lastEndpoint}
                        </td>

                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '11px' }}>
                          {c.lastSeen ? new Date(c.lastSeen).toLocaleTimeString() : 'N/A'}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {c.isBlocked ? (
                            <button
                              onClick={() => promptSecurityAction({ type: 'UNBLOCK', targetDomain: c.domain })}
                              style={{
                                background: '#16a34a',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '5px 12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              <Unlock size={12} />
                              <span>Unlock Domain</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => promptSecurityAction({ type: 'BLOCK', targetDomain: c.domain })}
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '4px',
                                padding: '5px 12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              <Lock size={12} />
                              <span>Block Domain</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: UPSTREAM DATA ORIGINS (User Requirement #2)                       */}
        {/* ========================================================================= */}
        {activeTab === 'UPSTREAMS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                  Upstream Data Sources & Origin-Side Health
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Live monitoring of upstream feeds (Nice444, Startexch99, Universe Score, LTVE Video CDN) and whether they blocked our connection.
                </div>
              </div>

              <button
                onClick={handleProbeOrigins}
                disabled={probingUpstreams}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: probingUpstreams ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Zap size={14} className={probingUpstreams ? 'animate-bounce' : ''} />
                <span>{probingUpstreams ? 'Probing Origins...' : 'Probe All Origins Now ⚡'}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
              {upstreamsData.map((u) => {
                const isBlocked = u.status === 'BLOCKED_BY_ORIGIN';
                const isActive = u.status === 'ACTIVE';

                return (
                  <div
                    key={u.id}
                    style={{
                      background: '#0f172a',
                      border: `1px solid ${isBlocked ? '#ef4444' : '#1e293b'}`,
                      borderRadius: '8px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>{u.name}</span>
                        {isActive ? (
                          <span style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                            ACTIVE (200 OK)
                          </span>
                        ) : isBlocked ? (
                          <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                            BLOCKED BY ORIGIN ({u.statusCode})
                          </span>
                        ) : (
                          <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                            {u.status}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', lineHeight: '1.4' }}>
                        {u.role}
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        Origin: {u.origin}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #1e293b', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                      <span style={{ color: '#94a3b8' }}>Latency: <strong style={{ color: '#f8fafc' }}>{u.latencyMs}ms</strong></span>
                      <span style={{ color: '#64748b' }}>Status: {u.message}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LIVE INBOUND TRAFFIC STREAM                                        */}
        {/* ========================================================================= */}
        {activeTab === 'TRAFFIC' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                  Live API Inbound Traffic Stream
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Real-time rolling inspector showing all incoming calls, their origin domains, IPs, and latency.
                </div>
              </div>
            </div>

            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#131b2e', borderBottom: '1px solid #1e293b', color: '#94a3b8', fontSize: '11px', fontWeight: 800 }}>
                    <th style={{ padding: '10px 16px' }}>TIME</th>
                    <th style={{ padding: '10px 16px' }}>METHOD</th>
                    <th style={{ padding: '10px 16px' }}>CALLER DOMAIN / ORIGIN</th>
                    <th style={{ padding: '10px 16px' }}>ENDPOINT</th>
                    <th style={{ padding: '10px 16px' }}>STATUS</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>LATENCY</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>QUICK ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {(firewallData?.recentLogs || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                        Waiting for incoming API requests...
                      </td>
                    </tr>
                  ) : (
                    firewallData.recentLogs.map((log) => (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: log.blocked ? 'rgba(239, 68, 68, 0.08)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '8px 16px', color: '#64748b', fontSize: '11px' }}>
                          {log.timeFormatted}
                        </td>

                        <td style={{ padding: '8px 16px' }}>
                          <span style={{
                            background: log.method === 'POST' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: log.method === 'POST' ? '#38bdf8' : '#22c55e',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            fontWeight: 800
                          }}>
                            {log.method}
                          </span>
                        </td>

                        <td style={{ padding: '8px 16px', fontWeight: 700, color: log.blocked ? '#ef4444' : '#f8fafc' }}>
                          {log.domain}
                        </td>

                        <td style={{ padding: '8px 16px', fontFamily: 'monospace', color: '#94a3b8', fontSize: '11px' }}>
                          {log.path}
                        </td>

                        <td style={{ padding: '8px 16px' }}>
                          <span style={{
                            color: log.status === 200 ? '#22c55e' : log.status === 403 ? '#ef4444' : '#f59e0b',
                            fontWeight: 800,
                            fontSize: '11px'
                          }}>
                            {log.status} {log.blocked ? '(BLOCKED)' : ''}
                          </span>
                        </td>

                        <td style={{ padding: '8px 16px', textAlign: 'right', color: '#64748b', fontSize: '11px' }}>
                          {log.latencyMs}ms
                        </td>

                        <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                          {log.domain !== 'direct-api-client' && (
                            <button
                              onClick={() => promptSecurityAction({
                                type: log.blocked ? 'UNBLOCK' : 'BLOCK',
                                targetDomain: log.domain
                              })}
                              style={{
                                background: log.blocked ? '#16a34a' : 'rgba(239, 68, 68, 0.2)',
                                color: log.blocked ? '#fff' : '#ef4444',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {log.blocked ? 'Unlock' : 'Block'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: STEALTH ISP & ROUTING                                              */}
        {/* ========================================================================= */}
        {activeTab === 'STEALTH' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                Indian Residential ISP Stealth Personas
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                Outbound proxy masking: Upstream providers never see datacenter server IPs; they see genuine Indian residential subscribers.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {(telemetryMetrics?.availablePersonas || []).map((p) => {
                const isSelected = telemetryMetrics?.stealthPersona?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPersona(p.id)}
                    style={{
                      background: isSelected ? 'rgba(56, 189, 248, 0.08)' : '#0f172a',
                      border: `1px solid ${isSelected ? '#38bdf8' : '#1e293b'}`,
                      borderRadius: '8px',
                      padding: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? '#38bdf8' : '#f8fafc' }}>
                        {p.name}
                      </span>
                      {isSelected && (
                        <span style={{ background: '#0284c7', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                          ACTIVE NOW
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.city}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>IP: {p.ip} ({p.carrier})</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: AUTHORITY CONTROLS (Full Admin Authority)                          */}
        {/* ========================================================================= */}
        {activeTab === 'AUTHORITY' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>
                Gateway Authority & Emergency Controls
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                Privileged operations requiring administrator authentication password: <code style={{ color: '#facc15' }}>Wasim@123#</code>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>

              {/* Emergency Kill-Switch */}
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Power size={18} style={{ color: firewallData?.summary?.emergencyKillSwitch ? '#ef4444' : '#22c55e' }} />
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>Global Emergency Kill-Switch</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                    Instantly halts and rejects all external inbound API requests with 403 Forbidden while keeping this admin console active.
                  </div>
                </div>

                <button
                  onClick={() => promptSecurityAction({
                    type: 'KILL_SWITCH',
                    state: !firewallData?.summary?.emergencyKillSwitch
                  })}
                  style={{
                    background: firewallData?.summary?.emergencyKillSwitch ? '#22c55e' : '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {firewallData?.summary?.emergencyKillSwitch ? 'Deactivate Kill-Switch (Resume Traffic)' : 'Engage Emergency Kill-Switch 🛑'}
                </button>
              </div>

              {/* Force Session Relogin */}
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <RefreshCw size={18} style={{ color: '#0284c7' }} />
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>Force Re-authenticate Upstreams</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                    Flushes all upstream session tokens and re-logs in to Startexch99 and Nice444 using fresh residential cookies.
                  </div>
                </div>

                <button
                  onClick={() => promptSecurityAction({ type: 'RELOGIN' })}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Flush & Re-login Upstreams 🔄
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 2. ADMIN PASSWORD CONFIRMATION MODAL (Wasim@123#)                         */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '10px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}>
                <ShieldAlert size={20} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>
                  Admin Authorization Required
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Action: {modalAction?.type} {modalAction?.targetDomain ? `(${modalAction.targetDomain})` : ''}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5', background: '#090d16', padding: '10px 12px', borderRadius: '6px', border: '1px solid #1e293b' }}>
              {modalAction?.type === 'BLOCK' && (
                <span>You are blocking domain <strong>{modalAction?.targetDomain}</strong>. Any request originating from this domain will receive HTTP 403 Forbidden.</span>
              )}
              {modalAction?.type === 'UNBLOCK' && (
                <span>You are unlocking domain <strong>{modalAction?.targetDomain}</strong>. API traffic from this domain will be restored.</span>
              )}
              {modalAction?.type === 'KILL_SWITCH' && (
                <span>You are toggling the <strong>Global Emergency Kill-Switch</strong>. This affects all external traffic across all sports and casino APIs.</span>
              )}
              {modalAction?.type === 'RELOGIN' && (
                <span>You are triggering a <strong>Force Session Re-authentication</strong> on upstream exchange networks.</span>
              )}
            </div>

            <form onSubmit={executeModalAction} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                  ADMIN PASSWORD
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      background: '#090d16',
                      border: `1px solid ${passwordError ? '#ef4444' : '#334155'}`,
                      borderRadius: '6px',
                      padding: '10px 38px 10px 12px',
                      fontSize: '13px',
                      color: '#fff',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '10px',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordError && (
                  <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontWeight: 600 }}>
                    {passwordError}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    background: '#1e293b',
                    color: '#94a3b8',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {actionLoading ? 'Verifying...' : 'Authorize Action 🔒'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: '#fff',
          padding: '12px 18px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          minWidth: '240px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800 }}>{toast.title}</div>
          <div style={{ fontSize: '11px', opacity: 0.9 }}>{toast.message}</div>
        </div>
      )}
    </div>
  );
}
