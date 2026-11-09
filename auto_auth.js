import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
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
    return null;
  }
}

async function runAutoAuth() {
  console.log('[AutoAuth] Starting Autonomous 1-Shot Authenticator...');

  const chromePath = fs.existsSync('/usr/bin/google-chrome-stable') 
    ? '/usr/bin/google-chrome-stable' 
    : (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : (fs.existsSync('/usr/bin/chromium-browser') ? '/usr/bin/chromium-browser' : null));

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-zygote',
    '--window-size=1280,800'
  ];

  console.log(`[AutoAuth] Launching 1-shot headless browser (Path: ${chromePath || 'default'})...`);
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromePath || undefined,
    args: launchArgs
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  let acquiredToken = null;
  let acquiredCookies = '';

  // Intercept any API requests to grab Bearer token immediately
  page.on('request', (req) => {
    const headers = req.headers();
    if (headers['authorization'] && headers['authorization'].startsWith('Bearer ')) {
      acquiredToken = headers['authorization'].replace('Bearer ', '').trim();
    }
  });

  const targetHosts = ['https://mouseexch.com', 'https://br365bet.live'];

  for (const host of targetHosts) {
    try {
      console.log(`[AutoAuth] Navigating to ${host}...`);
      await page.goto(host, { waitUntil: 'networkidle2', timeout: 25000 });

      console.log(`[AutoAuth] Landed on ${page.url()}. Clicking Demo Login...`);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a, div'));
        const demoBtn = btns.find(b => {
          const t = (b.innerText || '').toLowerCase().trim();
          return t === 'demo login' || t === 'demo' || t.includes('demo login');
        });
        if (demoBtn) {
          demoBtn.click();
          return true;
        }
        return false;
      });

      // Wait 3 seconds for session cookies & token to generate
      await new Promise(r => setTimeout(r, 3500));

      const cookies = await page.cookies();
      acquiredCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const tokenFromStorage = await page.evaluate(() => {
        return localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('user_token') || null;
      });

      if (tokenFromStorage) {
        acquiredToken = tokenFromStorage;
      }

      console.log(`[AutoAuth] Cookies acquired: ${cookies.length}, Token: ${acquiredToken ? `${acquiredToken.slice(0, 15)}...` : 'None'}`);

      if (acquiredCookies || acquiredToken) {
        const sessionData = {
          token: acquiredToken,
          cookies: acquiredCookies,
          lastLogin: Date.now(),
          status: 'LIVE_CONNECTED',
          host: host
        };

        fs.writeFileSync(path.resolve(process.cwd(), '.direct_exchange_session.json'), JSON.stringify(sessionData, null, 2));
        fs.writeFileSync(path.resolve(process.cwd(), '.d247_session.json'), JSON.stringify(sessionData, null, 2));
        console.log(`[AutoAuth] Successfully saved session to disk!`);

        // Test real Super Over 2
        console.log(`[AutoAuth] Verifying live connection on ${host}...`);
        const enc = encrypt({ ismob: 1, type: 'superover2' });
        const res = await axios.post(`${host}/api/front/casino/tabdata?type=superover2`, { data: enc }, {
          headers: {
            'Content-Type': 'application/json',
            'Origin': host,
            'Referer': `${host}/`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            ...(acquiredToken ? { 'Authorization': `Bearer ${acquiredToken}` } : {}),
            ...(acquiredCookies ? { 'Cookie': acquiredCookies } : {})
          },
          timeout: 5000
        });

        if (res.data?.data) {
          const dec = decrypt(res.data.data);
          if (dec?.data?.t1) {
            console.log(`\n🎉 [AutoAuth SUCCESS] REAL LIVE STREAM VERIFIED!`);
            console.log(`   Real Round ID: ${dec.data.t1.mid || dec.data.t1.gmid}`);
            console.log(`   Real Status: ${dec.data.t1.status}, Real LeftSec: ${dec.data.t1.lt}`);
            console.log(`   Real Markets: ${(dec.data.t2 || []).map(m => m.mname).join(', ')}\n`);
            break;
          }
        }
      }
    } catch (e) {
      console.log(`[AutoAuth] Error on ${host}:`, e.message);
    }
  }

  console.log('[AutoAuth] Closing 1-shot browser and terminating...');
  await browser.close().catch(() => {});
  console.log('[AutoAuth] Done. Zero background browser processes.');
}

runAutoAuth().catch(e => console.error('[AutoAuth Fatal]', e));
