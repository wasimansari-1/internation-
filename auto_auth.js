import puppeteer from 'puppeteer-core';
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

  const candidates = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium'
  ];
  let chromePath = candidates.find(c => fs.existsSync(c)) || null;

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-zygote',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,800'
  ];

  try {
    const net = await import('net');
    const isWarpActive = await new Promise(resolve => {
      const client = net.createConnection({ port: 40000, host: '127.0.0.1' }, () => {
        client.destroy();
        resolve(true);
      });
      client.on('error', () => resolve(false));
      client.setTimeout(400, () => { client.destroy(); resolve(false); });
    });
    if (isWarpActive) {
      launchArgs.push('--proxy-server=socks5://127.0.0.1:40000');
      console.log('[AutoAuth] Routing through Cloudflare WARP proxy on 127.0.0.1:40000');
    }
  } catch (e) {}

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
      await page.goto(host, { waitUntil: 'networkidle2', timeout: 35000 });

      const pageTitle = await page.title();
      console.log(`[AutoAuth] Landed on ${page.url()} | Title: ${pageTitle}`);

      // Discover all clickable buttons and links related to Demo or Login
      const buttonsInfo = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
        return els.map(e => ({
          tag: e.tagName,
          text: (e.innerText || e.value || '').trim(),
          href: e.href || '',
          className: e.className || ''
        })).filter(e => e.text.toLowerCase().includes('demo') || e.text.toLowerCase().includes('login') || e.href.toLowerCase().includes('demo'));
      });
      console.log(`[AutoAuth] Found elements:`, JSON.stringify(buttonsInfo));

      // Click the demo button
      const clicked = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('button, a, div, span'));
        const target = els.find(e => {
          const t = (e.innerText || '').toLowerCase().trim();
          return t === 'demo login' || t === 'demo' || (t.includes('demo') && t.includes('login'));
        });
        if (target) {
          target.click();
          return target.innerText;
        }
        return null;
      });
      console.log(`[AutoAuth] Clicked:`, clicked);

      // Wait 5 seconds for network activity and login redirection
      await new Promise(r => setTimeout(r, 5000));
      console.log(`[AutoAuth] Current URL after click: ${page.url()}`);

      // Check all storage
      const storageData = await page.evaluate(() => {
        const local = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          local[k] = localStorage.getItem(k);
        }
        return {
          localStorage: local,
          cookies: document.cookie
        };
      });
      console.log(`[AutoAuth] LocalStorage keys:`, Object.keys(storageData.localStorage));

      const cookies = await page.cookies();
      acquiredCookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Find token
      acquiredToken = storageData.localStorage['token'] 
        || storageData.localStorage['user_token'] 
        || storageData.localStorage['g_token']
        || null;

      if (!acquiredToken) {
        // Try to find any token-like value in localStorage
        for (const [k, v] of Object.entries(storageData.localStorage)) {
          if (typeof v === 'string' && (k.toLowerCase().includes('token') || k.toLowerCase().includes('auth') || k.toLowerCase().includes('jwt'))) {
            acquiredToken = v;
            console.log(`[AutoAuth] Found token in key '${k}'`);
            break;
          }
        }
      }

      console.log(`[AutoAuth] Cookies count: ${cookies.length}, Token: ${acquiredToken ? `${acquiredToken.slice(0, 15)}...` : 'None'}`);

      // Now test live fetch directly INSIDE browser page (which has full Cloudflare clearance!)
      console.log(`[AutoAuth] Testing in-page fetch for Super Over 2 (zero 403 block)...`);
      const testResult = await page.evaluate(async (encData) => {
        try {
          const res = await fetch('/api/front/casino/tabdata?type=superover2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: encData }),
            credentials: 'include'
          });
          const json = await res.json();
          return { status: res.status, json };
        } catch (err) {
          return { error: err.message };
        }
      }, encrypt({ ismob: 1, type: 'superover2' }));

      console.log(`[AutoAuth] In-page fetch status:`, testResult.status);
      if (testResult.json?.data) {
        const dec = decrypt(testResult.json.data);
        if (dec?.data?.t1) {
          console.log(`\n🎉 [AutoAuth SUCCESS] IN-PAGE LIVE STREAM VERIFIED!`);
          console.log(`   Real Round ID: ${dec.data.t1.mid || dec.data.t1.gmid}`);
          console.log(`   Real Status: ${dec.data.t1.status}, Real LeftSec: ${dec.data.t1.lt}`);
          console.log(`   Real Markets: ${(dec.data.t2 || []).map(m => m.mname).join(', ')}\n`);
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

