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
  // 1. Test Super Over 2
  try {
    const enc = encrypt({ ismob: 1, type: 'superover2' });
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
    console.log(`[${host}] SuperOver2 HTTP:`, res.status);
    if (res.data?.data) {
      const dec = decrypt(res.data.data);
      console.log(`[${host}] SuperOver2 Decrypted status:`, dec.status, 'msg:', dec.msg);
      if (dec?.data?.t1) {
        console.log(`[${host}] SuperOver2 Round ID:`, dec.data.t1.mid || dec.data.t1.gmid);
        console.log(`[${host}] SuperOver2 Status:`, dec.data.t1.status, 'LeftSec:', dec.data.t1.lt, 'Card:', dec.data.t1.card);
        console.log(`[${host}] SuperOver2 Markets:`, (dec.data.t2 || []).map(m => m.mname).join(', '));
      }
    }
  } catch (err) {
    console.log(`[${host}] SuperOver2 Error:`, err.response ? `HTTP ${err.response.status}` : err.message);
  }

  // 2. Test Goal 2
  try {
    const enc2 = encrypt({ ismob: 1, type: 'goal2' });
    const res2 = await axios.post(`${host}/api/front/casino/data2?gtype=goal2`, 
      { data: enc2 },
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
    console.log(`[${host}] Goal2 HTTP:`, res2.status);
    if (res2.data?.data) {
      const dec2 = decrypt(res2.data.data);
      console.log(`[${host}] Goal2 Decrypted status:`, dec2.status, 'msg:', dec2.msg);
      if (dec2?.data) {
        console.log(`[${host}] Goal2 Round ID:`, dec2.data.mid);
        console.log(`[${host}] Goal2 Status:`, dec2.data.status, 'LeftSec:', dec2.data.lt, 'Remark:', dec2.data.remark || dec2.data.rdesc);
        console.log(`[${host}] Goal2 Runners Count:`, dec2.data.sub?.length);
      }
    }
  } catch (err2) {
    console.log(`[${host}] Goal2 Error:`, err2.response ? `HTTP ${err2.response.status}` : err2.message);
  }
}

async function main() {
  for (const host of ['https://mouseexch.com', 'https://br365bet.live', 'https://d247.com']) {
    await testHost(host);
  }
}
main();
