import axios from 'axios';
import { getStartexchToken } from '../backend/services/authService.js';
import { nativeHttpsAgent } from '../backend/services/streamService.js';

async function testCorsOnPing() {
  const token = await getStartexchToken(false);
  const ip = "49.36.142.88";
  const res = await axios.post(
    'https://casino.startexch99.com/casinoapp/exchange/users/streaming/casinoGameWatchLink',
    { streamId: '99.0010', timestamp: Date.now() },
    {
      headers: {
        Origin: 'https://casino.startexch99.com',
        Referer: 'https://casino.startexch99.com/',
        Authorization: `Bearer ${token}`,
        'X-Forwarded-For': ip,
        'X-Real-IP': ip,
        'CF-Connecting-IP': ip
      }
    }
  );

  const watchUrl = res.data?.data?.url;
  console.log('Watch URL:', watchUrl);

  const pageRes = await axios.get(watchUrl, {
    headers: {
      Origin: 'https://casino.startexch99.com',
      Referer: 'https://casino.startexch99.com/'
    },
    httpsAgent: nativeHttpsAgent
  });

  const cfgMatch = pageRes.data.match(/<script type="application\/json" id="cfg">([\s\S]*?)<\/script>/);
  const cfg = JSON.parse(cfgMatch[1]);
  console.log('pingUrl:', cfg.pingUrl);

  // Test OPTIONS (CORS preflight) from localhost
  try {
    const optRes = await axios({
      method: 'OPTIONS',
      url: cfg.pingUrl,
      headers: {
        'Origin': 'http://localhost:5001',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    console.log('CORS Preflight status:', optRes.status);
    console.log('CORS Allow Origin header:', optRes.headers['access-control-allow-origin']);
  } catch(e) {
    console.log('CORS Preflight failed:', e.response?.status, e.message);
  }
}

testCorsOnPing();

