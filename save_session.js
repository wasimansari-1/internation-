import fs from 'fs';
import path from 'path';
import axios from 'axios';
import CryptoJS from 'crypto-js';

const input = process.argv.slice(2).join(' ').trim();
if (!input) {
  console.log('\nUsage: node save_session.js "<PASTE_CURL_OR_TOKEN_OR_COOKIE_HERE>"\n');
  process.exit(1);
}

const AES_KEY = "cae7b808-8b1e-4f47-87a5-1a4b6a08030e";
function encrypt(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), AES_KEY).toString();
}
function decrypt(ciphertext) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, AES_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (e) {
    return null;
  }
}

let token = null;
let cookies = '';

// Extract token
const tokenMatch = input.match(/authorization:\s*(?:Bearer\s*)?([^\s"'\r\n]+)/i)
  || input.match(/-H\s+['"]authorization:\s*(?:Bearer\s*)?([^'"]+)['"]/i)
  || input.match(/token["']?\s*:\s*["']([^"']+)["']/i);

if (tokenMatch) {
  token = tokenMatch[1].trim();
} else if (input.length >= 30 && !input.includes(' ') && !input.includes('=')) {
  token = input.trim();
}

// Extract cookies
const cookieMatch = input.match(/cookie:\s*([^\r\n"']+)/i)
  || input.match(/-H\s+['"]cookie:\s*([^'"]+)['"]/i);

if (cookieMatch) {
  cookies = cookieMatch[1].trim();
} else if (input.includes('=')) {
  cookies = input.trim();
}

console.log('\n[Session Parser] Extracted:');
console.log('   Token:', token ? `${token.slice(0, 15)}...` : 'None');
console.log('   Cookies length:', cookies ? cookies.length : 0);

const sessionData = {
  token: token || null,
  cookies: cookies || '',
  lastLogin: Date.now(),
  status: 'LIVE_CONNECTED'
};

// Save to disk for backend
fs.writeFileSync(path.resolve(process.cwd(), '.direct_exchange_session.json'), JSON.stringify(sessionData, null, 2));
fs.writeFileSync(path.resolve(process.cwd(), '.d247_session.json'), JSON.stringify(sessionData, null, 2));
console.log('Saved to .direct_exchange_session.json and .d247_session.json');

// Test upstream immediately with new session
async function verify() {
  for (const host of ['https://mouseexch.com', 'https://br365bet.live']) {
    console.log(`\nVerifying live feed on ${host}...`);
    try {
      const enc = encrypt({ ismob: 1, type: 'superover2' });
      const res = await axios.post(`${host}/api/front/casino/tabdata?type=superover2`, 
        { data: enc },
        {
          headers: {
            'Content-Type': 'application/json',
            'Origin': host,
            'Referer': `${host}/`,
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(cookies ? { 'Cookie': cookies } : {})
          },
          timeout: 4000
        }
      );

      if (res.data?.data) {
        const dec = decrypt(res.data.data);
        if (dec?.data?.t1) {
          console.log(`SUCCESS! Live Super Over 2 connected!`);
          console.log(`   Round ID: ${dec.data.t1.mid || dec.data.t1.gmid}`);
          console.log(`   Status: ${dec.data.t1.status}, LeftSec: ${dec.data.t1.lt}`);
          console.log(`   Markets: ${(dec.data.t2 || []).map(m => m.mname).join(', ')}`);
          return;
        } else {
          console.log(`Response:`, dec ? (dec.msg || dec.status) : 'Invalid format');
        }
      }
    } catch (e) {
      console.log(`Failed on ${host}:`, e.response ? `HTTP ${e.response.status}` : e.message);
    }
  }
}

verify();
