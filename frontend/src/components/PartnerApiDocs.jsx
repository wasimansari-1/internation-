import React, { useState } from 'react';
import {
  ShieldCheck,
  Key,
  Terminal,
  Copy,
  Check,
  Code2,
  FileText,
  Lock,
  Zap,
  Globe,
  Radio,
  ExternalLink,
} from 'lucide-react';

export default function PartnerApiDocs() {
  const [activeLang, setActiveLang] = useState('nodejs');
  const [copiedIndex, setCopiedIndex] = useState(null);

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const CODE_SNIPPETS = {
    nodejs: `// =========================================================================
// Universal Sports & Casino Partner Client (Node.js / Axios)
// =========================================================================
import axios from "axios";
import crypto from "crypto";

const API_BASE_URL = "https://your-api-domain.com"; // Your Universal API Domain
const API_KEY = "uapi_live_your_api_key_here";      // Provided by Admin upon IP Whitelist
const API_SECRET = "sec_live_your_secret_here";      // Used for AES-256 Decryption

/**
 * Diamond-Grade AES-256 Payload Decryption
 * Automatically decrypts sealed ciphertext responses into JSON
 */
function decryptDiamondPayload(encryptedObj, secretKey = API_SECRET) {
  if (!encryptedObj || !encryptedObj.enc || !encryptedObj.data || !encryptedObj.salt) {
    return encryptedObj; // Plain unencrypted response
  }
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const iv = Buffer.from(encryptedObj.salt, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedObj.data, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

// 1. Fetch Real-time Cricket Match Odds & Bookmaker Bhav
async function getLiveCricketRates(eventId) {
  const response = await axios.get(\`\${API_BASE_URL}/api/sports/live-rates/\${eventId}?sportId=4\`, {
    headers: {
      "X-API-Key": API_KEY,
      "X-Payload-Encryption": "aes-256", // Requests Diamond-Grade encrypted transmission
      "Content-Type": "application/json"
    }
  });

  const payload = decryptDiamondPayload(response.data);
  console.log("Match Odds & Bookmaker:", payload.data);
  return payload;
}

// 2. Fetch Live Casino Table Odds (e.g. 20-20 Teen Patti, Lucky 7, Dragon Tiger)
async function getCasinoLiveOdds(gameId = "99.0010") {
  const response = await axios.get(\`\${API_BASE_URL}/api/casino/live-odds/\${gameId}\`, {
    headers: { "X-API-Key": API_KEY }
  });
  return decryptDiamondPayload(response.data);
}

// 3. Obtain Ultra-Low Latency Live Dealer WebRTC Stream WatchLink
async function getCasinoStreamWatchLink(streamId = "99.0010") {
  const response = await axios.post(\`\${API_BASE_URL}/api/stream/watch-link\`, {
    streamId
  }, {
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" }
  });
  return decryptDiamondPayload(response.data);
}`,

    php: `<?php
// =========================================================================
// Universal Sports & Casino Partner Client (PHP 7.4+ / cURL / OpenSSL)
// =========================================================================

define('API_BASE_URL', 'https://your-api-domain.com');
define('API_KEY', 'uapi_live_your_api_key_here');
define('API_SECRET', 'sec_live_your_secret_here');

/**
 * Diamond-Grade AES-256 Decryption in PHP
 */
function decryptDiamondPayload($encryptedObj, $secretKey = API_SECRET) {
    if (!isset($encryptedObj['enc']) || !isset($encryptedObj['data']) || !isset($encryptedObj['salt'])) {
        return $encryptedObj;
    }
    $key = hash('sha256', $secretKey, true);
    $iv = hex2bin($encryptedObj['salt']);
    $decrypted = openssl_decrypt($encryptedObj['data'], 'AES-256-CBC', $key, 0, $iv);
    return json_decode($decrypted, true);
}

// Execute Partner API Call
function callUniversalApi($endpoint, $method = 'GET', $body = null) {
    $ch = curl_init(API_BASE_URL . $endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'X-API-Key: ' . API_KEY,
        'X-Payload-Encryption: aes-256',
        'Content-Type: application/json'
    ]);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($body) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $rawResponse = curl_exec($ch);
    curl_close($ch);

    $json = json_decode($rawResponse, true);
    return decryptDiamondPayload($json);
}

// Example 1: Fetch Live Cricket Rates
$rates = callUniversalApi('/api/sports/live-rates/4002026117175719903?sportId=4');
print_r($rates);

// Example 2: Fetch Live 20-20 Teen Patti Odds
$casinoOdds = callUniversalApi('/api/casino/live-odds/99.0010');
print_r($casinoOdds);
?>`,

    python: `# =========================================================================
# Universal Sports & Casino Partner Client (Python 3.8+ / Cryptodome)
# pip install requests pycryptodome
# =========================================================================
import requests
import json
import hashlib
from Crypto.Cipher import AES
from base64 import b64decode

API_BASE_URL = "https://your-api-domain.com"
API_KEY = "uapi_live_your_api_key_here"
API_SECRET = "sec_live_your_secret_here"

def decrypt_diamond_payload(encrypted_obj, secret_key=API_SECRET):
    if not isinstance(encrypted_obj, dict) or not encrypted_obj.get("enc"):
        return encrypted_obj
    
    key = hashlib.sha256(secret_key.encode("utf-8")).digest()
    iv = bytes.fromhex(encrypted_obj["salt"])
    cipher = AES.new(key, AES.MODE_CBC, iv)
    decrypted_bytes = cipher.decrypt(b64decode(encrypted_obj["data"]))
    
    # Strip PKCS7 padding
    pad_len = decrypted_bytes[-1]
    plaintext = decrypted_bytes[:-pad_len].decode("utf-8")
    return json.loads(plaintext)

# 1. Fetch Live Cricket Rates
res = requests.get(
    f"{API_BASE_URL}/api/sports/live-rates/4002026117175719903?sportId=4",
    headers={
        "X-API-Key": API_KEY,
        "X-Payload-Encryption": "aes-256",
        "Content-Type": "application/json"
    }
)
data = decrypt_diamond_payload(res.json())
print("Decrypted Cricket Rates:", data)
`
  };

  const ENDPOINTS = [
    {
      category: "Sports & Exchange",
      method: "GET",
      path: "/api/sports/list",
      desc: "Returns active sports catalogue (Cricket, Soccer, Tennis, etc.)",
      headers: "X-API-Key"
    },
    {
      category: "Sports & Exchange",
      method: "GET",
      path: "/api/sports/live-rates/:eventId?sportId=4",
      desc: "Real-time rates for Match Odds, Bookmaker Bhav, Fancy, and Sportsbook with per-market news",
      headers: "X-API-Key, X-Payload-Encryption"
    },
    {
      category: "Sports & Exchange",
      method: "POST",
      path: "/api/sports/markets-event-list",
      desc: "Complete market layout, runners, fancy sessions, and active news badges",
      headers: "X-API-Key, Content-Type: application/json"
    },
    {
      category: "Sports & Exchange",
      method: "GET",
      path: "/api/sports/news",
      desc: "Global sports exchange news ticker across all markets",
      headers: "X-API-Key"
    },
    {
      category: "Live Casino",
      method: "POST",
      path: "/api/casino/tables",
      desc: "21+ Live studio tables (Teen Patti 20-20, Lucky 7, Dragon Tiger, Baccarat, 32 Cards, Amar Akbar)",
      headers: "X-API-Key, Content-Type: application/json"
    },
    {
      category: "Live Casino",
      method: "GET",
      path: "/api/casino/live-odds/:gameId",
      desc: "Ultra-fast live odds, roundId, countdown clock, betting status, and winner badges",
      headers: "X-API-Key"
    },
    {
      category: "Live Casino",
      method: "GET",
      path: "/api/casino/results/:gameId",
      desc: "Recent round results history with winner badges (P1, P2, TIE, HIGH, LOW)",
      headers: "X-API-Key"
    },
    {
      category: "Zero-Latency Video Streams",
      method: "POST",
      path: "/api/direct-stream/watch-link",
      desc: "Sub-second studio WebRTC feed url for embed in iframe or native player",
      headers: "X-API-Key, Content-Type: application/json"
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Overview Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
          borderRadius: '14px',
          border: '1px solid #059669',
          padding: '28px 32px',
          color: '#ffffff',
          boxShadow: '0 8px 30px rgba(5, 150, 105, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#064e3b',
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
            Enterprise Partner API &amp; SDK Guide
          </h2>
          <span
            style={{
              background: 'rgba(52, 211, 153, 0.2)',
              color: '#6ee7b7',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: '999px',
              border: '1px solid rgba(52, 211, 153, 0.4)',
            }}
          >
            REST &amp; WEBRTC
          </span>
        </div>
        <p style={{ color: '#d1fae5', fontSize: '13px', lineHeight: 1.6, margin: 0, maxWidth: '820px' }}>
          Connect your sports exchange, betting platform, or mobile application directly to our Universal Multi-Origin Mesh.
          All endpoints are guarded by <strong>Strict IP Whitelisting</strong>, <strong>API Key Authentication</strong>, and optional <strong>Diamond-Grade AES-256 Payload Encryption</strong>.
        </p>
      </div>

      {/* 3 Steps Onboarding */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div
          style={{
            background: '#0d1520',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#065f46', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px' }}>
              1
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Submit Server IP for Whitelist
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
            Contact our integration team with your production server outbound IP address. Only whitelisted IPs can establish connections.
          </p>
        </div>

        <div
          style={{
            background: '#0d1520',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#065f46', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px' }}>
              2
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Obtain API Key &amp; Secret
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
            Upon whitelisting, you will receive a unique API Key (<code>X-API-Key: uapi_live_...</code>) and AES Decryption Secret.
          </p>
        </div>

        <div
          style={{
            background: '#0d1520',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#065f46', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px' }}>
              3
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Pass Required Headers
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
            Include <code>X-API-Key</code> in every request. Use <code>X-Payload-Encryption: aes-256</code> to receive sealed Diamond-grade ciphertext.
          </p>
        </div>
      </div>

      {/* Code SDK Section */}
      <div
        style={{
          background: '#0b111a',
          borderRadius: '12px',
          border: '1px solid #1e293b',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            background: '#070b12',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Code2 size={16} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
              Diamond-Grade AES-256 Decryption SDK
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {['nodejs', 'php', 'python'].map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveLang(lang)}
                style={{
                  background: activeLang === lang ? '#065f46' : '#1e293b',
                  color: activeLang === lang ? '#34d399' : '#94a3b8',
                  border: activeLang === lang ? '1px solid #059669' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {lang}
              </button>
            ))}

            <button
              type="button"
              onClick={() => copyToClipboard(CODE_SNIPPETS[activeLang], 'sdk')}
              style={{
                background: '#1e293b',
                color: copiedIndex === 'sdk' ? '#34d399' : '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {copiedIndex === 'sdk' ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedIndex === 'sdk' ? 'Copied' : 'Copy SDK'}</span>
            </button>
          </div>
        </div>

        <pre
          style={{
            margin: 0,
            padding: '18px 20px',
            background: '#070c14',
            color: '#e2e8f0',
            fontSize: '12px',
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
            lineHeight: 1.6,
            overflowX: 'auto',
          }}
        >
          <code>{CODE_SNIPPETS[activeLang]}</code>
        </pre>
      </div>

      {/* Endpoint Catalogue Table */}
      <div
        style={{
          background: '#0b111a',
          borderRadius: '12px',
          border: '1px solid #1e293b',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', background: '#070b12', borderBottom: '1px solid #1e293b' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            Production Endpoints Specification
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0 0' }}>
            All requests must originate from your whitelisted server IP address.
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#080e18', borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Category</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Method</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Endpoint Path</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Description</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Headers</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((ep, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #141e2e' }}>
                  <td style={{ padding: '12px 16px', color: '#38bdf8', fontWeight: 600 }}>{ep.category}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 800,
                        fontSize: '10px',
                        background: ep.method === 'POST' ? 'rgba(5, 150, 105, 0.2)' : 'rgba(2, 132, 199, 0.2)',
                        color: ep.method === 'POST' ? '#34d399' : '#38bdf8',
                        border: ep.method === 'POST' ? '1px solid #059669' : '1px solid #0284c7',
                      }}
                    >
                      {ep.method}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#f8fafc', fontWeight: 700 }}>
                    {ep.path}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{ep.desc}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>
                    {ep.headers}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

