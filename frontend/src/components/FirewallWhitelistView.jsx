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

  const handleToggleStatus = async (ip) => {
    try {
      const res = await axios.post('/api/admin/security/whitelist/toggle', { ip });
      if (res.data?.success) {
        showToast('Status Updated', `IP ${ip} is now ${res.data.partner?.status}`, 'info');
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

  const stats = securityData?.stats || {};
  const firewallConfig = securityData?.firewallConfig || {};
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
            <ShieldCheck size={18} style={{ color: '#059669' }} />
          </div>
          <div className="adm-kpi-value" style={{ color: '#047857' }}>
            {stats.totalWhitelistedIps || whitelist.length}
            <span className="adm-kpi-unit">Authorized</span>
          </div>
          <div className="adm-kpi-sub">
            Active Partners: <strong>{stats.totalActivePartners || whitelist.length}</strong>
          </div>
          <div className="adm-kpi-footer">
            <span>Access Guard</span>
            <span style={{ color: '#059669', fontWeight: 700 }}>ACTIVE</span>
          </div>
        </div>

        {/* KPI 2: Blocked Bypass Attempts */}
        <div className="adm-card adm-kpi">
          <div className="adm-kpi-top">
            <span className="adm-label">Blocked Bypass Attempts</span>
            <ShieldAlert size={18} style={{ color: (stats.totalBlocked || 0) > 0 ? '#dc2626' : '#059669' }} />
          </div>
          <div
            className="adm-kpi-value"
            style={{ color: (stats.totalBlocked || 0) > 0 ? '#dc2626' : '#047857' }}
          >
            {stats.totalBlocked || 0}
            <span className="adm-kpi-unit">Blocked</span>
          </div>
          <div className="adm-kpi-sub">
            {(stats.totalBlocked || 0) > 0
              ? 'Unauthorized IP access denied (403)'
              : 'Zero unauthorized leaks detected'}
          </div>
          <div className="adm-kpi-footer">
            <span>Intrusion Shield</span>
            <span style={{ color: '#047857', fontWeight: 700 }}>ARMED</span>
          </div>
        </div>

        {/* KPI 3: Connected Client Domains */}
        <div className="adm-card adm-kpi">
          <div className="adm-kpi-top">
            <span className="adm-label">Active Client Domains</span>
            <Globe size={18} style={{ color: '#059669' }} />
          </div>
          <div className="adm-kpi-value">
            {connectedDomains.length || 1}
            <span className="adm-kpi-unit">Domains</span>
          </div>
          <div className="adm-kpi-sub">
            Real-time Origin / Referer Traffic Tracking
          </div>
          <div className="adm-kpi-footer">
            <span>Origin Sensor</span>
            <span style={{ color: '#059669', fontWeight: 700 }}>LIVE</span>
          </div>
        </div>

        {/* KPI 4: Firewall Enforcement Engine */}
        <div className="adm-card adm-kpi">
          <div className="adm-kpi-top">
            <span className="adm-label">Firewall Mode</span>
            <Lock size={18} style={{ color: '#059669' }} />
          </div>
          <div className="adm-kpi-value" style={{ color: '#047857', fontSize: '19px' }}>
            {firewallConfig.strictMode ? 'STRICT GUARD' : 'PERMISSIVE'}
          </div>
          <div className="adm-kpi-sub">
            Payload Encryption: <strong>{firewallConfig.payloadEncryption ? 'AES-256 (Diamond)' : 'OFF'}</strong>
          </div>
          <div className="adm-kpi-footer">
            <span>Network Sealed</span>
            <span style={{ color: '#059669', fontWeight: 700 }}>100% HARDENED</span>
          </div>
        </div>
      </section>

      {/* Global Security Policy & Diamond-Grade Encryption Controls */}
      <section className="adm-card adm-section">
        <div className="adm-section-head">
          <div className="adm-section-title-group">
            <div className="adm-icon-tile adm-icon-emerald">
              <Sliders size={16} />
            </div>
            <div>
              <h2 className="adm-h2">Global Firewall &amp; Transmission Encryption</h2>
              <p className="adm-muted-sm">Hardened edge policy rules protecting production routes</p>
            </div>
          </div>
          <span className="adm-tag adm-tag-emerald">ENTERPRISE GRADE</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '12px' }}>
          {/* Rule 1: Strict Mode */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: firewallConfig.strictMode ? '1px solid #10b981' : '1px solid #e2e8f0',
              background: firewallConfig.strictMode ? '#f0fdf4' : '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                Strict IP Whitelist Enforcement
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Only authorized whitelisted IPs can call API endpoints. External unwhitelisted IPs get instant 403 Forbidden.
              </div>
            </div>
            <button
              type="button"
              disabled={updatingConfig}
              onClick={() => handleUpdateFirewallConfig({ strictMode: !firewallConfig.strictMode })}
              className={`adm-mini-btn ${firewallConfig.strictMode ? 'is-emerald' : 'is-danger'}`}
              style={{ marginLeft: '12px', flexShrink: 0 }}
            >
              <span>{firewallConfig.strictMode ? 'STRICT (ON)' : 'PERMISSIVE'}</span>
            </button>
          </div>

          {/* Rule 2: Diamond Payload Encryption */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: firewallConfig.payloadEncryption ? '1px solid #10b981' : '1px solid #e2e8f0',
              background: firewallConfig.payloadEncryption ? '#f0fdf4' : '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                Diamond-Style AES-256 Payload Encryption
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Inspect / Network tab displays 100% encrypted ciphertext. Scrapers &amp; competitors cannot read responses.
              </div>
            </div>
            <button
              type="button"
              disabled={updatingConfig}
              onClick={() => handleUpdateFirewallConfig({ payloadEncryption: !firewallConfig.payloadEncryption })}
              className={`adm-mini-btn ${firewallConfig.payloadEncryption ? 'is-emerald' : 'is-danger'}`}
              style={{ marginLeft: '12px', flexShrink: 0 }}
            >
              <span>{firewallConfig.payloadEncryption ? 'SEALED (ON)' : 'RAW'}</span>
            </button>
          </div>

          {/* Rule 3: Internal Web App Bypass */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: firewallConfig.internalBypass ? '1px solid #10b981' : '1px solid #e2e8f0',
              background: firewallConfig.internalBypass ? '#f0fdf4' : '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                Internal Web App Zero-Disruption Shield
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Server-hosted frontend traffic operates seamlessly without getting blocked. Production UI never stops.
              </div>
            </div>
            <button
              type="button"
              disabled={updatingConfig}
              onClick={() => handleUpdateFirewallConfig({ internalBypass: !firewallConfig.internalBypass })}
              className={`adm-mini-btn ${firewallConfig.internalBypass ? 'is-emerald' : 'is-danger'}`}
              style={{ marginLeft: '12px', flexShrink: 0 }}
            >
              <span>{firewallConfig.internalBypass ? 'ACTIVE' : 'OFF'}</span>
            </button>
          </div>
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
              <p className="adm-muted-sm">Authorize a new server IP address and generate credentials</p>
            </div>
          </div>
          <span className="adm-tag adm-tag-emerald">ONBOARDING</span>
        </div>

        <form onSubmit={handleAddWhitelist} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              IP Address *
            </label>
            <input
              type="text"
              placeholder="e.g. 103.21.124.5"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontFamily: 'monospace',
                background: '#ffffff',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Partner / Client Name
            </label>
            <input
              type="text"
              placeholder="e.g. Kingz Exchange"
              value={newPartnerName}
              onChange={(e) => setNewPartnerName(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Client Domain (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. kingz.pro"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
              Access Scope
            </label>
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="ALL">Full Mesh (Sports + Casino + Streams)</option>
              <option value="SPORTS">Sports &amp; Exchange Only</option>
              <option value="CASINO">Live Casino Only</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={submittingIp}
              className="adm-btn adm-btn-emerald"
              style={{ width: '100%', height: '40px', justifyContent: 'center' }}
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
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.partnerName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Scope: {item.scope || 'ALL'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <code className="adm-mono" style={{ fontWeight: 800, color: '#047857' }}>
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
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item.ip)}
                          disabled={isLocal}
                          style={{
                            background: isActive ? '#ecfdf5' : '#fef2f2',
                            color: isActive ? '#059669' : '#dc2626',
                            border: `1px solid ${isActive ? '#a7f3d0' : '#fecaca'}`,
                            borderRadius: '999px',
                            padding: '3px 10px',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: isLocal ? 'default' : 'pointer',
                          }}
                        >
                          {isActive ? 'ACTIVE' : 'PAUSED'}
                        </button>
                      </td>
                      <td className="adm-mono" style={{ fontWeight: 700, color: '#334155' }}>
                        {(item.totalHits || 0).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!isLocal && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWhitelist(item.ip)}
                            className="adm-mini-btn is-danger"
                            title="Remove from whitelist"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
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

