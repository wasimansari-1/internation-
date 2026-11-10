import { getDirectCasinoStreamUrl } from '../backend/directStreamEngine/casinoDirectStream.js';
import axios from 'axios';
import { nativeHttpsAgent } from '../backend/services/streamService.js';

async function testReferer() {
  const streamInfo = await getDirectCasinoStreamUrl('3030', true);
  console.log('Stream info:', streamInfo);

  const referers = [
    { origin: 'https://casino.startexch99.com', referer: 'https://casino.startexch99.com/' },
    { origin: 'https://startexch99.com', referer: 'https://startexch99.com/' },
    { origin: 'https://casino.nice444.com', referer: 'https://casino.nice444.com/' }
  ];

  for (const r of referers) {
    try {
      console.log(`Testing with Origin: ${r.origin}`);
      const res = await axios.get(streamInfo.url, {
        headers: {
          Origin: r.origin,
          Referer: r.referer,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        httpsAgent: nativeHttpsAgent,
        timeout: 5000
      });
      console.log(`--> Status: ${res.status}, Length: ${res.data?.length}`);
    } catch(e) {
      console.log(`--> Failed with ${r.origin}:`, e.response?.status, e.message);
    }
  }
}

testReferer();

