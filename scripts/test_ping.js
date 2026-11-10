import axios from 'axios';
import { getDirectCasinoStreamUrl } from '../backend/directStreamEngine/casinoDirectStream.js';
import { nativeHttpsAgent } from '../backend/services/streamService.js';

async function testPing() {
  const streamInfo = await getDirectCasinoStreamUrl('3030', true);
  const watchUrl = streamInfo.url;
  console.log('Watch URL:', watchUrl);

  const res = await axios.get(watchUrl, {
    headers: {
      Origin: 'https://casino.startexch99.com',
      Referer: 'https://casino.startexch99.com/'
    },
    httpsAgent: nativeHttpsAgent
  });

  const cfgMatch = res.data.match(/<script type="application\/json" id="cfg">([\s\S]*?)<\/script>/);
  if (!cfgMatch) return console.log('No cfg found');
  const cfg = JSON.parse(cfgMatch[1]);
  console.log('CFG:', cfg);

  // Test pingUrl
  try {
    const pingRes = await axios.post(cfg.pingUrl, {
      screen: { width: 1920, height: 1080 },
      ts: Date.now()
    }, {
      headers: {
        Origin: 'https://casino.startexch99.com',
        Referer: watchUrl,
        'Content-Type': 'application/json'
      },
      httpsAgent: nativeHttpsAgent
    });
    console.log('Ping response:\n', pingRes.data);
  } catch(e) {
    console.error('Ping error:', e.response?.status, e.message);
  }
}

testPing();

