import axios from 'axios';
import { getDirectCasinoStreamUrl } from '../backend/directStreamEngine/casinoDirectStream.js';
import { nativeHttpsAgent } from '../backend/services/streamService.js';

async function inspectPlayerHtml() {
  const streamInfo = await getDirectCasinoStreamUrl('3030', true);
  const res = await axios.get(streamInfo.url, {
    headers: {
      Origin: 'https://casino.startexch99.com',
      Referer: 'https://casino.startexch99.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    },
    httpsAgent: nativeHttpsAgent
  });

  const html = res.data;
  console.log('=== HTML PREVIEW (Scripts & Endpoints) ===');
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const s of scripts) {
    console.log('Script tag:\n', s[0].slice(0, 500));
  }
}

inspectPlayerHtml();

