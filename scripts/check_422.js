import axios from 'axios';
import { getStartexchToken } from '../backend/services/authService.js';

async function check422WithIp() {
  const token = await getStartexchToken(false);
  const ip = "49.36.142.88"; // Jio Fiber Mumbai
  try {
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
          'CF-Connecting-IP': ip,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      }
    );
    console.log('Success with IP:', res.data);
  } catch(e) {
    console.log('Status with IP:', e.response?.status);
    console.log('Data with IP:', e.response?.data);
  }
}

check422WithIp();
