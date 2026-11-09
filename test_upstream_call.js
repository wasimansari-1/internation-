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

async function testTarget(host) {
  console.log(`\n================ Testing ${host} ================`);
  for (const endpoint of ['/api/front/tablist', '/api/front/casino/tabdata?type=superover2', '/api/front/casino/data2?gtype=goal2']) {
    try {
      const payload = endpoint.includes('superover') ? { ismob: 1, type: 'superover2' } : (endpoint.includes('goal') ? { ismob: 1, type: 'goal2' } : { ismob: 1 });
      const enc = encrypt(payload);
      const res = await axios.post(`${host}${endpoint}`, { data: enc }, {
        headers: {
          'Content-Type': 'application/json',
          'Origin': host,
          'Referer': `${host}/`,
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        },
        timeout: 5000,
        validateStatus: () => true
      });

      let dec = res.data;
      if (res.data?.data && typeof res.data.data === 'string') {
        dec = decrypt(res.data.data);
      }
      console.log(`[${endpoint}] HTTP ${res.status}:`, dec?.msg || dec?.status || JSON.stringify(dec).slice(0, 100));
      if (dec?.data?.t1) {
        console.log(`   -> SUCCESS! Round: ${dec.data.t1.mid || dec.data.t1.gmid}, LeftSec: ${dec.data.t1.lt}, Status: ${dec.data.t1.status}`);
      }
    } catch (err) {
      console.log(`[${endpoint}] Error:`, err.message);
    }
  }
}

async function main() {
  await testTarget('https://br365bet.live');
  await testTarget('https://mouseexch.com');
}

main();
