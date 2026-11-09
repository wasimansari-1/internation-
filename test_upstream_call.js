import axios from 'axios';
import CryptoJS from 'crypto-js';

const AES_KEY = "cae7b808-8b1e-4f47-87a5-1a4b6a08030e";
function encrypt(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), AES_KEY).toString();
}
function decrypt(ciphertext) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, AES_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (e) {
    return { error: e.message, raw: String(ciphertext).slice(0, 100) };
  }
}

async function probeEndpoint(host, endpoint, payload = {}, method = 'POST') {
  const enc = encrypt(payload);
  try {
    const res = await axios({
      method,
      url: `${host}${endpoint}`,
      data: method === 'POST' ? { data: enc } : undefined,
      headers: {
        'Content-Type': 'application/json',
        'Origin': host,
        'Referer': `${host}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      },
      timeout: 5000,
      validateStatus: () => true
    });

    let dec = null;
    if (res.data?.data && typeof res.data.data === 'string') {
      dec = decrypt(res.data.data);
    }
    console.log(`[${method} ${endpoint}] -> HTTP ${res.status}`, dec || (typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 120) : ''));
    return { status: res.status, data: res.data, dec, headers: res.headers };
  } catch (err) {
    console.log(`[${method} ${endpoint}] -> Error: ${err.message}`);
    return null;
  }
}

async function main() {
  const host = 'https://mouseexch.com';
  console.log(`\n=== PROBING ${host} AUTH & PUBLIC ENDPOINTS ===\n`);

  // 1. Try public unauth endpoints
  await probeEndpoint(host, '/api/front/tablist', { ismob: 1 });
  await probeEndpoint(host, '/api/front/latest-events', {});
  await probeEndpoint(host, '/api/front/highlighthomePrivate?etid=4', { etid: 4, type: 'all' });
  await probeEndpoint(host, '/api/front/get_casino_table_list', { ismob: 1 });

  // 2. Try demo login variations
  await probeEndpoint(host, '/api/front/demo-login', {});
  await probeEndpoint(host, '/api/front/demologin', {});
  await probeEndpoint(host, '/api/front/demo', {});
  await probeEndpoint(host, '/api/front/login', { username: 'demo', password: 'demo' });
  await probeEndpoint(host, '/api/front/userlogin', { username: 'demo', password: 'demo' });
  await probeEndpoint(host, '/app/users/userLogin', { userName: 'demo52', password: 'Asdf1234' });

  // 3. Try HTML home page to check cookies/scripts
  try {
    const home = await axios.get(`${host}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });
    console.log(`[GET /] -> HTTP ${home.status}, Set-Cookie:`, home.headers['set-cookie'] || 'None');
    const scripts = (home.data.match(/src="([^"]+\.js[^"]*)"/g) || []).slice(0, 5);
    console.log('Scripts:', scripts);
  } catch (e) {
    console.log('[GET /] Error:', e.message);
  }
}

main();

