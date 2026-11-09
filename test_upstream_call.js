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

async function testHost(host) {
  console.log(`\n================ Testing ${host} ================`);
  const enc = encrypt({ ismob: 1, type: 'superover2' });
  try {
    const res = await axios.post(`${host}/api/front/casino/tabdata?type=superover2`, 
      { data: enc },
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': host,
          'Referer': `${host}/`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        },
        timeout: 5000
      }
    );
    console.log(`[${host}] HTTP Status:`, res.status);
    console.log(`[${host}] Response keys:`, Object.keys(res.data));
    if (res.data?.data) {
      const dec = decrypt(res.data.data);
      console.log(`[${host}] Decrypted keys:`, Object.keys(dec));
      if (dec?.data) {
        console.log(`[${host}] Round ID:`, dec.data?.t1?.mid || dec.data?.t1?.gmid);
        console.log(`[${host}] Status:`, dec.data?.t1?.status, 'LeftSec:', dec.data?.t1?.lt);
        console.log(`[${host}] Markets Count:`, dec.data?.t2?.length);
        if (dec.data?.t2) {
          dec.data.t2.forEach(m => console.log('   Market:', m.mname, '| Runners:', m.section?.length));
        }
      }
    }
  } catch (err) {
    console.log(`[${host}] Error:`, err.response ? `HTTP ${err.response.status}` : err.message);
  }
}

async function main() {
  for (const host of ['https://mouseexch.com', 'https://br365bet.live', 'https://d247.com']) {
    await testHost(host);
  }
}
main();
