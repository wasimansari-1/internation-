import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  Sliders,
  Globe,
  Radio,
  ExternalLink,
  Ban,
  Lock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Power,
  Server,
  Zap,
} from 'lucide-react';

export default function FirewallWhitelistView({ showToast }) {
  const [securityData, setSecurityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New IP Whitelist Form State
  const [newIp, setNewIp] = useState('');
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newScope, setNewScope] = useState('ALL');
  const [newRateLimit, setNewRateLimit] = useState(600);
  const [submittingIp, setSubmittingIp] = useState(false);

  // Scoreboard & Results Whitelist State
  const [newScoreboardDomain, setNewScoreboardDomain] = useState('');
  const [submittingDomain, setSubmittingDomain] = useState(false);
  const [togglingDirectHits, setTogglingDirectHits] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [updatingConfig, setUpdatingConfig] = useState(false);

  const fetchSecurityOverview = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await axios.get('/api/admin/security/overview?_t=' + Date.now());
      if (res.data?.success) {
        setSecurityData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch security overview:', err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSecurityOverview();
    const timer = setInterval(() => fetchSecurityOverview(false), 3000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddWhitelist = async (e) => {
    e.preventDefault();
    if (!newIp.trim()) {
      showToast('Validation Error', 'IP Address is required', 'warning');
      return;
    }

    setSubmittingIp(true);
    try {
      const res = await axios.post('/api/admin/security/whitelist/add', {
        ip: newIp.trim(),
        partnerName: newPartnerName.trim() || undefined,
        domain: newDomain.trim() || undefined,
        scope: newScope,
        rateLimit: Number(newRateLimit) || 600,
      });

      if (res.data?.success) {
        showToast('IP Whitelisted', `${res.data.partner.ip} added successfully with API Key`, 'success');
        setNewIp('');
        setNewPartnerName('');
        setNewDomain('');
        fetchSecurityOverview(true);
      }
    } catch (err) {
      showToast('Whitelist Failed', err.response?.data?.error || err.message, 'error');
    } finally {
      setSubmittingIp(false);
    }
  };

  const handleRemoveWhitelist = async (ip) => {
    if (!window.confirm(`Are you sure you want to remove IP ${ip} from the whitelist? Requests from this IP will be blocked immediately.`)) {
      return;
    }

    try {
      const res = await axios.post('/api/admin/security/whitelist/remove', { ip });
      if (res.data?.success) {
        showToast('IP Removed', `IP ${ip} removed from authorized whitelist`, 'warning');
        fetchSecurityOverview(true);
      }
    } catch (err) {
      showToast('Error', err.response?.data?.error || err.message, 'error');
    }
  };

  const handleToggleBlock = async (ip, targetStatus) => {
    try {
      const res = await axios.post('/api/admin/security/whitelist/toggle', { ip, status: targetStatus });
      if (res.data?.success) {
        const actionWord = targetStatus === 'BLOCKED' ? 'Blocked' : 'Unblocked';
        showToast(`IP ${actionWord}`, `IP ${ip} is now ${targetStatus}`, targetStatus === 'BLOCKED' ? 'warning' : 'success');
        fetchSecurityOverview(true);
      }
    } catch (err) {
      showToast('Error', err.response?.data?.error || err.message, 'error');
    }
  };

  const handleUpdateFirewallConfig = async (patch) => {
    setUpdatingConfig(true);
    try {
      const res = await axios.post('/api/admin/security/config', patch);
      if (res.data?.success) {
        showToast('Firewall Rule Updated', 'Global security policy applied instantly', 'success');
        fetchSecurityOverview(true);
      }
    } catch (err) {
      showToast('Update Failed', err.response?.data?.error || err.message, 'error');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleAddScoreboardDomain = async (e) => {
    e.preventDefault();
    if (!newScoreboardDomain.trim()) {
      showToast('Validation Error', 'Domain or URL is required', 'warning');
      return;
    }
    setSubmittingDomain(true);
    try {
      const res = await axios.post('/api/admin/security/scoreboard-whitelist/add', {
        domain: newScoreboardDomain.trim(),
      });
      if (res.data?.success) {
        showToast('Domain Whitelisted', res.data.message, 'success');
        setNewScoreboardDomain('');
        fetchSecurityOverview(true);
      }
    } catch (err) {
      showToast('Whitelist Failed', err.response?.data?.error || err.message, 'error');
    } finally {
      setSubmittingDomain(false);
    }
  };

  const handleRemoveScoreboardDomain = async (domain) => {
    if (!window.confirm(`Remove "${domain}" from Scoreboard & Results whitelist?`)) return;
    try {
      const res = await axios.post('/api/admin/security/scoreboard-whitelist/remove', { domain });
      if (res.data?.success) {
        showToast('Domain Removed', res.data.message, 'warning');
        fetchSecurityOverview(true);
      }
    } catch (err) {
      showToast('Error', err.response?.data?.error || err.message, 'error');
    }
  };

  const handleToggleDirectHits = async (currentVal) => {
    setTogglingDirectHits(true);
    try {
      const res = await axios.post('/api/admin/security/scoreboard-whitelist/toggle-direct', {
        allowDirectUrlHits: !currentVal,
      });
      if (res.data?.success) {
        showToast('Direct Hits Updated', res.data.message, 'info');
        fetchSecurityOverview(true);
      }
    } catch (err) {
      showToast('Error', err.response?.data?.error || err.message, 'error');
    } finally {
      setTogglingDirectHits(false);
    }
  };

  const stats = securityData?.stats || {};
  const firewallConfig = securityData?.firewallConfig || {};
  const resultsConfig = securityData?.resultsScoreboardConfig || {
    allowDirectUrlHits: true,
    allowedDomains: ['aura.igambli.com', 'igambli.com', 'chimneysolutions.info', 'localhost'],
    allowedIps: ['187.127.98.247', '187.127.119.222', '187.127.119.224'],
  };
  const whitelist = securityData?.whitelist || [];
  const blockedAttempts = securityData?.recentBlockedAttempts || [];
  const connectedDomains = securityData?.connectedDomains || [];

  const filteredWhitelist = whitelist.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      (item.ip && item.ip.toLowerCase().includes(term)) ||
      (item.partnerName && item.partnerName.toLowerCase().includes(term)) ||
      (item.domain && item.domain.toLowerCase().includes(term)) ||
      (item.apiKey && item.apiKey.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 4 Security KPI Stats Cards */}
      <section className="adm-grid-4">
        {/* KPI 1: Whitelisted IPs */}
        <div className="adm-card adm-kpi">
          <div className="adm-kpi-top">
            <span className="adm-label">Whitelisted IPs</span>
            <ShieldCheck size={18} style={{ color: '#1b6e38' }} />
          </div>
          <div className="adm-kpi-value" style={{ color: '#1c2721' }}>
            {stats.totalWhitelistedIps || whitelist.length}
            <span className="adm-kpi-unit">Authorized</span>
          </div>
          <div className="adm-kpi-sub">
            Active Partners: <strong>{stats.totalActivePartners || whitelist.length}</strong>
          </div>
          <div className="adm-kpi-footer">
            <span>Status</span>
            <span style={{ color: '#1b6e38', fontWeight: 700 }}>ACTIVE</span>
          </div>
        </div>

        {/* KPI 2: Blocked Bypass Attempts */}
        <div className="adm-card adm-kpi">
          <div className="adm-kpi-top">
            <span className="adm-label">Blocked Requests</span>
            <ShieldAlert size={18} style={{ color: (stats.totalBlocked || 0) > 0 ? '#e04838' : '#1b6e38' }} />
          </div>
          <div
            className="adm-kpi-value"
            style={{ color: (stats.totalBlocked || 0) > 0 ? '#e04838' : '#1c2721' }}
          >
            {stats.totalBlocked || 0}
            <span className="adm-kpi-unit">Denied</span>
          </div>
          <div className="adm-kpi-sub">
            {(stats.totalBlocked || 0) > 0
              ? 'Unauthorized IP access denied (403)'
              : 'All incoming traffic authorized'}
          </div>
          <div className="adm-kpi-footer">
            <span>Filter</span>
            <span style={{ color: '#1b6e38', fontWeight: 700 }}>ACTIVE</span>
          </div>
        </div>

        {/* KPI 3: Connected Client Domains */}
        <div className="adm-card adm-kpi">
          <div className="adm-kpi-top">
            <span className="adm-label">Active Domains</span>
            <Globe size={18} style={{ color: '#1b6e38' }} />
          </div>
          <div className="adm-kpi-value" style={{ color: '#1c2721' }}>
            {connectedDomains.length || 1}
            <span className="adm-kpi-unit">Domains</span>
          </div>
          <div className="adm-kpi-sub">
            Origin and Referer domain monitoring
          </div>
          <div className="adm-kpi-footer">
            <span>Tracker</span>
            <span style={{ color: '#1b6e38', fontWeight: 700 }}>RUNNING</span>
          </div>
        </div>

        {/* KPI 4: Firewall Enforcement Engine */}
        <div className="adm-card adm-kpi">
          <div className="adm-kpi-top">
            <span className="adm-label">Firewall Mode</span>
            <Lock size={18} style={{ color: '#1b6e38' }} />
          </div>
          <div className="adm-kpi-value" style={{ color: '#1c2721', fontSize: '19px' }}>
            {firewallConfig.strictMode ? 'STRICT GUARD' : 'PERMISSIVE'}
          </div>
          <div className="adm-kpi-sub">
            Payload Encryption: <strong>{firewallConfig.payloadEncryption ? 'AES-256' : 'OFF'}</strong>
          </div>
          <div className="adm-kpi-footer">
            <span>Security Policy</span>
            <span style={{ color: '#1b6e38', fontWeight: 700 }}>ENFORCED</span>
          </div>
        </div>
      </section>

      {/* Security Policies */}
      <section className="adm-card adm-section">
        <div className="adm-section-head">
          <div className="adm-section-title-group">
            <div className="adm-icon-tile adm-icon-emerald">
              <Sliders size={16} />
            </div>
            <div>
              <h2 className="adm-h2">Security &amp; Firewall Policies</h2>
              <p className="adm-muted-sm">Control access authorization and payload encryption rules</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '12px' }}>
          {/* Rule 1: Strict Mode */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: firewallConfig.strictMode ? '1px solid #d4ded7' : '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#1c2721' }}>
                Strict IP Whitelist
              </div>
              <div style={{ fontSize: '11px', color: '#4d5e54', marginTop: '2px' }}>
                Only authorized IP addresses can access protected API endpoints.
              </div>
            </div>
            <button
              type="button"
              disabled={updatingConfig}
              onClick={() => handleUpdateFirewallConfig({ strictMode: !firewallConfig.strictMode })}
              style={{
                marginLeft: '12px',
                flexShrink: 0,
                background: firewallConfig.strictMode ? '#e04838' : '#e2eae4',
                color: firewallConfig.strictMode ? '#ffffff' : '#4a5b52',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <span>{firewallConfig.strictMode ? 'STRICT (ON)' : 'OFF'}</span>
            </button>
          </div>

          {/* Rule 2: Payload Encryption */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: firewallConfig.payloadEncryption ? '1px solid #d4ded7' : '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#1c2721' }}>
                Payload Encryption (AES-256)
              </div>
              <div style={{ fontSize: '11px', color: '#4d5e54', marginTop: '2px' }}>
                Optional encrypted JSON payloads for external client integrations.
              </div>
            </div>
            <button
              type="button"
              disabled={updatingConfig}
              onClick={() => handleUpdateFirewallConfig({ payloadEncryption: !firewallConfig.payloadEncryption })}
              style={{
                marginLeft: '12px',
                flexShrink: 0,
                background: firewallConfig.payloadEncryption ? '#e04838' : '#e2eae4',
                color: firewallConfig.payloadEncryption ? '#ffffff' : '#4a5b52',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <span>{firewallConfig.payloadEncryption ? 'ENCRYPTED' : 'RAW'}</span>
            </button>
          </div>

          {/* Rule 3: Localhost Access */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: firewallConfig.internalBypass ? '1px solid #d4ded7' : '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#1c2721' }}>
                Localhost &amp; Loopback Access
              </div>
              <div style={{ fontSize: '11px', color: '#4d5e54', marginTop: '2px' }}>
                Allow local connections originating from this server's loopback interface.
              </div>
            </div>
            <button
              type="button"
              disabled={updatingConfig}
              onClick={() => handleUpdateFirewallConfig({ internalBypass: !firewallConfig.internalBypass })}
              style={{
                marginLeft: '12px',
                flexShrink: 0,
                background: firewallConfig.internalBypass ? '#e04838' : '#e2eae4',
                color: firewallConfig.internalBypass ? '#ffffff' : '#4a5b52',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <span>{firewallConfig.internalBypass ? 'ACTIVE' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Scoreboard & Casino Results Dedicated Whitelist & Direct URL Access Card */}
      <section className="adm-card adm-section">
        <div className="adm-section-head">
          <div className="adm-section-title-group">
            <div className="adm-icon-tile adm-icon-emerald">
              <Globe size={16} />
            </div>
            <div>
              <h2 className="adm-h2">Scoreboard &amp; Casino Results Whitelist (Domains &amp; Direct URL Access)</h2>
              <p className="adm-muted-sm">Whitelist client domains (e.g. aura.igambli.com) &amp; direct hits so players and client frontends never face 403 blocks</p>
            </div>
          </div>
          <span className="adm-tag adm-tag-emerald">RESULTS &amp; SCOREBOARD</span>
        </div>

        {/* Direct URL Hits Toggle */}
        <div
          style={{
            marginTop: '16px',
            padding: '16px',
            borderRadius: '10px',
            border: resultsConfig.allowDirectUrlHits ? '1px solid #cad7cf' : '1px solid #dbe3dc',
            background: resultsConfig.allowDirectUrlHits ? '#edf2ee' : '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '13px', color: '#1c2721' }}>
              Allow Direct Browser URL Hits for Scoreboard &amp; Casino Results
            </div>
            <div style={{ fontSize: '11px', color: '#4a5b52', marginTop: '2px' }}>
              When active, client frontends can access Scoreboard and Casino Results directly without receiving 403 Forbidden.
            </div>
          </div>
          <button
            type="button"
            disabled={togglingDirectHits}
            onClick={() => handleToggleDirectHits(resultsConfig.allowDirectUrlHits)}
            style={{
              background: resultsConfig.allowDirectUrlHits ? '#e04838' : '#e2eae4',
              color: resultsConfig.allowDirectUrlHits ? '#ffffff' : '#4a5b52',
              border: resultsConfig.allowDirectUrlHits ? 'none' : '1px solid #cad7cf',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <span>{resultsConfig.allowDirectUrlHits ? 'DIRECT HITS (ALLOWED)' : 'RESTRICTED'}</span>
          </button>
        </div>

        {/* Add Domain Form */}
        <form onSubmit={handleAddScoreboardDomain} style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) auto', gap: '12px', marginTop: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1e261f', marginBottom: '6px' }}>
              Whitelist Client Site Domain or URL
            </label>
            <input
              type="text"
              placeholder="e.g. aura.igambli.com or https://aura.igambli.com"
              value={newScoreboardDomain}
              onChange={(e) => setNewScoreboardDomain(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cad7c3',
                fontSize: '13px',
                fontFamily: 'monospace',
                background: '#ffffff',
                outline: 'none',
                color: '#1e261f',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={submittingDomain}
            style={{
              height: '38px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#E8412C',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: submittingDomain ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(232, 65, 44, 0.25)',
              transition: 'background 0.15s',
            }}
          >
            <Plus size={14} />
            <span>{submittingDomain ? 'Whitelisting...' : 'Whitelist Domain'}</span>
          </button>
        </form>

        {/* Active Allowed Domains Badges */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e261f', marginBottom: '8px' }}>
            Active Whitelisted Domains for Results &amp; Scoreboard:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(resultsConfig.allowedDomains || []).map((dom) => (
              <span
                key={dom}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  background: '#e3ebd9',
                  border: '1px solid #cad7c3',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#1e261f',
                }}
              >
                <Globe size={13} style={{ color: '#9CAF88' }} />
                <span>{dom}</span>
                {dom !== 'localhost' && dom !== 'chimneysolutions.info' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveScoreboardDomain(dom)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#E8412C',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={`Remove ${dom}`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Server IPs linked */}
        <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: '#edf2ee', border: '1px solid #cad7cf', fontSize: '11px', color: '#1c2721' }}>
          <strong>Linked Infrastructure IPs:</strong> 187.127.98.247, 187.127.119.222, 187.127.119.224 &mdash; Client websites hosted on these server IPs automatically have direct access to scoreboards and casino results without 403 errors.
        </div>
      </section>

      {/* Add New Whitelisted IP / Partner Form */}
      <section className="adm-card adm-section">
        <div className="adm-section-head">
          <div className="adm-section-title-group">
            <div className="adm-icon-tile adm-icon-emerald">
              <Plus size={16} />
            </div>
            <div>
              <h2 className="adm-h2">Whitelist Partner IP &amp; Issue API Key</h2>
              <p className="adm-muted-sm">Authorize a server IP address and generate integration credentials</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleAddWhitelist} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1e261f', marginBottom: '6px' }}>
              IP Address *
            </label>
            <input
              type="text"
              placeholder="e.g. 187.127.98.247"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cad7c3',
                fontSize: '13px',
                fontFamily: 'monospace',
                background: '#ffffff',
                outline: 'none',
                color: '#1e261f',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1e261f', marginBottom: '6px' }}>
              Partner Name
            </label>
            <input
              type="text"
              placeholder="e.g. Igmaster1"
              value={newPartnerName}
              onChange={(e) => setNewPartnerName(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cad7c3',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
                color: '#1e261f',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1e261f', marginBottom: '6px' }}>
              Client Domain (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. aura.igambli.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cad7c3',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
                color: '#1e261f',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1e261f', marginBottom: '6px' }}>
              Access Scope
            </label>
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cad7c3',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
                color: '#1e261f',
              }}
            >
              <option value="ALL">Full Access (Sports + Casino + Streams)</option>
              <option value="SPORTS">Sports &amp; Exchange Only</option>
              <option value="CASINO">Live Casino Only</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={submittingIp}
              style={{
                width: '100%',
                height: '40px',
                justifyContent: 'center',
                background: '#E8412C',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: submittingIp ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(232, 65, 44, 0.25)',
                transition: 'background 0.15s',
              }}
            >
              <Key size={14} />
              <span>{submittingIp ? 'Whitelisting...' : 'Whitelist IP & Issue Key'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Whitelisted IPs & Partners Table */}
      <section className="adm-card adm-section">
        <div className="adm-section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="adm-h2">Authorized Whitelist &amp; Partner Keys</h2>
            <span className="adm-tag adm-tag-emerald">{whitelist.length} Authorized</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search IP, partner, domain..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '7px 12px 7px 30px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none',
                  width: '220px',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => fetchSecurityOverview(true)}
              className="adm-btn"
              disabled={refreshing}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Partner Name</th>
                <th>Whitelisted IP</th>
                <th>Domain</th>
                <th>API Key</th>
                <th>Status</th>
                <th>Total Hits</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWhitelist.length === 0 ? (
                <tr>
                  <td colSpan={7} className="adm-table-empty">
                    No whitelisted IPs found matching "{searchTerm}"
                  </td>
                </tr>
              ) : (
                filteredWhitelist.map((item) => {
                  const isLocal = item.ip === '127.0.0.1' || item.ip === '::1';
                  const isActive = item.status === 'ACTIVE';

                  return (
                    <tr key={item.ip}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#1c2721' }}>{item.partnerName}</div>
                        <div style={{ fontSize: '11px', color: '#4a5b52' }}>Scope: {item.scope || 'ALL'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <code className="adm-mono" style={{ fontWeight: 800, color: '#1b6e38' }}>
                            {item.ip}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.ip, item.ip)}
                            title="Copy IP"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                          >
                            {copiedKey === item.ip ? <Check size={12} color="#059669" /> : <Copy size={12} color="#94a3b8" />}
                          </button>
                        </div>
                      </td>
                      <td>
                        {item.domain ? (
                          <span style={{ color: '#0284c7', fontWeight: 600 }}>{item.domain}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <code className="adm-mono" style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            {item.apiKey ? `${item.apiKey.substring(0, 16)}...` : '—'}
                          </code>
                          {item.apiKey && (
                            <button
                              type="button"
                              onClick={() => handleCopy(item.apiKey, item.apiKey)}
                              title="Copy API Key"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                            >
                              {copiedKey === item.apiKey ? <Check size={12} color="#059669" /> : <Copy size={12} color="#94a3b8" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        {isActive ? (
                          <span
                            style={{
                              background: '#e3ebd9',
                              color: '#1e261f',
                              border: '1px solid #9CAF88',
                              borderRadius: '999px',
                              padding: '3px 10px',
                              fontSize: '11px',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Check size={11} color="#9CAF88" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              background: '#fbe8e5',
                              color: '#E8412C',
                              border: '1px solid #E8412C',
                              borderRadius: '999px',
                              padding: '3px 10px',
                              fontSize: '11px',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Ban size={11} />
                            <span>Blocked</span>
                          </span>
                        )}
                      </td>
                      <td className="adm-mono" style={{ fontWeight: 700, color: '#1e261f' }}>
                        {(item.totalHits || 0).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {!isLocal ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {isActive ? (
                              <button
                                type="button"
                                onClick={() => handleToggleBlock(item.ip, 'BLOCKED')}
                                style={{
                                  background: '#E8412C',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 12px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  boxShadow: '0 2px 6px rgba(232, 65, 44, 0.25)',
                                  transition: 'background 0.15s',
                                }}
                                title="Block this IP immediately"
                              >
                                <Ban size={12} />
                                <span>Block</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleBlock(item.ip, 'ACTIVE')}
                                style={{
                                  background: '#9CAF88',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '5px 12px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  boxShadow: '0 2px 6px rgba(156, 175, 136, 0.3)',
                                  transition: 'background 0.15s',
                                }}
                                title="Unblock this IP and restore access"
                              >
                                <CheckCircle2 size={12} />
                                <span>Unblock</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveWhitelist(item.ip)}
                              style={{
                                background: '#ffffff',
                                color: '#E8412C',
                                border: '1px solid #cad7c3',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Remove from whitelist"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#748373', fontSize: '11px', fontWeight: 600 }}>
                            Gateway Local
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Real-time Blocked Bypass Attempts Monitor */}
      <section className="adm-card adm-section">
        <div className="adm-section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="adm-icon-tile" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
              <Ban size={16} />
            </div>
            <div>
              <h2 className="adm-h2">Live Blocked Bypass &amp; Intrusion Monitor</h2>
              <p className="adm-muted-sm">Real-time log of unauthorized IPs blocked by the firewall</p>
            </div>
          </div>
          <span className="adm-tag" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}>
            {blockedAttempts.length} BLOCKED
          </span>
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Unauthorized IP</th>
                <th>Target Endpoint</th>
                <th>Domain / Referer</th>
                <th>Violation Reason</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="adm-table-empty">
                    <CheckCircle2 size={20} style={{ color: '#059669', margin: '0 auto 6px' }} />
                    <div>Zero intrusion attempts detected. All current traffic is authorized.</div>
                  </td>
                </tr>
              ) : (
                blockedAttempts.map((att) => (
                  <tr key={att.id}>
                    <td className="adm-mono adm-muted-sm">{att.displayTime || att.time}</td>
                    <td>
                      <code className="adm-mono" style={{ color: '#dc2626', fontWeight: 800 }}>
                        {att.ip}
                      </code>
                    </td>
                    <td className="adm-mono adm-endpoint-cell" title={att.path}>
                      <span className="adm-method" style={{ color: '#dc2626' }}>{att.method}</span>
                      <span>{att.path}</span>
                    </td>
                    <td>
                      <span style={{ color: '#64748b' }}>{att.domain || 'direct'}</span>
                    </td>
                    <td>
                      <span
                        style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        {att.reason}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setNewIp(att.ip);
                          window.scrollTo({ top: 380, behavior: 'smooth' });
                        }}
                        className="adm-btn adm-btn-emerald"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        <Plus size={11} />
                        <span>Whitelist IP</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Connected Domains Tracker */}
      <section className="adm-card adm-section">
        <div className="adm-section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="adm-icon-tile adm-icon-emerald">
              <Globe size={16} />
            </div>
            <div>
              <h2 className="adm-h2">Connected Client Domains Tracker</h2>
              <p className="adm-muted-sm">All websites and hostnames sending traffic to our Universal API</p>
            </div>
          </div>
          <span className="adm-tag adm-tag-emerald">{connectedDomains.length} Active</span>
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Domain / Hostname</th>
                <th>Total Requests</th>
                <th>Authorized Hits</th>
                <th>Blocked Hits</th>
                <th>Unique IPs</th>
                <th>Last Active</th>
                <th style={{ textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {connectedDomains.length === 0 ? (
                <tr>
                  <td colSpan={7} className="adm-table-empty">
                    Waiting for domain traffic...
                  </td>
                </tr>
              ) : (
                connectedDomains.map((dom) => (
                  <tr key={dom.domain}>
                    <td style={{ fontWeight: 800, color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={13} style={{ color: '#059669' }} />
                        <span>{dom.domain}</span>
                      </div>
                    </td>
                    <td className="adm-mono" style={{ fontWeight: 700 }}>
                      {dom.totalRequests.toLocaleString()}
                    </td>
                    <td className="adm-mono" style={{ color: '#059669', fontWeight: 700 }}>
                      {dom.whitelistedHits.toLocaleString()}
                    </td>
                    <td className="adm-mono" style={{ color: dom.blockedHits > 0 ? '#dc2626' : '#64748b' }}>
                      {dom.blockedHits.toLocaleString()}
                    </td>
                    <td>
                      <span className="adm-muted-sm">{dom.uniqueIpsCount} IP(s)</span>
                    </td>
                    <td className="adm-muted-sm">
                      {new Date(dom.lastActive).toLocaleTimeString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        className="adm-tag"
                        style={{
                          background: dom.blockedHits > 0 ? '#fffbeb' : '#ecfdf5',
                          color: dom.blockedHits > 0 ? '#d97706' : '#059669',
                          borderColor: dom.blockedHits > 0 ? '#fde68a' : '#a7f3d0',
                        }}
                      >
                        {dom.blockedHits > 0 ? 'PARTIAL_BLOCKS' : 'AUTHORIZED'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

