import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\rishi\\AppData\\Local\\Temp\\chrome_verify_profile_' + Date.now();

const chrome = spawn(chromePath, [
  '--headless=new',
  `--user-data-dir=${userDataDir}`,
  '--remote-debugging-port=9222',
  '--window-size=1280,1100',
  'about:blank',
]);

await new Promise((r) => setTimeout(r, 1500));

const versionRes = await fetch('http://127.0.0.1:9222/json/version');
const versionData = await versionRes.json();
const wsUrl = versionData.webSocketDebuggerUrl;

const WebSocket = globalThis.WebSocket;
const ws = new WebSocket(wsUrl);

let id = 1;
const listeners = new Map();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (listeners.has(msg.id)) {
    const { resolve, reject } = listeners.get(msg.id);
    listeners.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  }
};

const send = (method, params = {}) => {
  return new Promise((resolve, reject) => {
    const msgId = id++;
    listeners.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
};

const sendSession = (sessionId, method, params = {}) => {
  return new Promise((resolve, reject) => {
    const msgId = id++;
    listeners.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, sessionId, method, params }));
  });
};

ws.onopen = async () => {
  try {
    const { targetId } = await send('Target.createTarget', { url: 'http://localhost:5173/' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

    const sessionSend = (method, params = {}) => sendSession(sessionId, method, params);

    await sessionSend('Page.enable');
    await sessionSend('Runtime.enable');

    // 1. LANDING PAGE - LATEST 5 MODE
    await sessionSend('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise((r) => setTimeout(r, 2500));

    // Scroll to the network hero section
    await sessionSend('Runtime.evaluate', {
      expression: `
        const hero = document.querySelector('h3');
        if (hero) hero.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
    });
    await new Promise((r) => setTimeout(r, 500));

    let snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('landing_latest_5.png', Buffer.from(snap.data, 'base64'));
    console.log('Saved landing_latest_5.png');

    // 2. LANDING PAGE - SHOW ALL MODE
    await sessionSend('Runtime.evaluate', {
      expression: `
        const buttons = Array.from(document.querySelectorAll('button'));
        const showAllBtn = buttons.find(b => b.textContent.includes('Show All Active Trades'));
        if (showAllBtn) showAllBtn.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1000));

    snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('landing_show_all.png', Buffer.from(snap.data, 'base64'));
    console.log('Saved landing_show_all.png');

    // 3. HOSPITAL DASHBOARD - LATEST 5 & SHOW ALL
    // Inject Apollo authentication
    await sessionSend('Runtime.evaluate', {
      expression: `
        localStorage.setItem('sms_auth_session', JSON.stringify({
          user: {
            id: 'hosp-1',
            name: 'Apollo Hospital',
            email: 'apollo.mumbai@medex.org',
            role: 'hospital',
            status: 'verified',
            city: 'Mumbai',
            state: 'Maharashtra'
          },
          token: 'mock_hospital_token_apollo'
        }));
      `,
    });

    await sessionSend('Page.navigate', { url: 'http://localhost:5173/hospital/dashboard' });
    await new Promise((r) => setTimeout(r, 2500));

    // Scroll to the network map
    await sessionSend('Runtime.evaluate', {
      expression: `
        const el = document.querySelector('h3');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
    });
    await new Promise((r) => setTimeout(r, 500));

    snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('dashboard_latest_5.png', Buffer.from(snap.data, 'base64'));
    console.log('Saved dashboard_latest_5.png');

    // 4. HOSPITAL DASHBOARD - CLICK SHOW ALL
    await sessionSend('Runtime.evaluate', {
      expression: `
        const buttons = Array.from(document.querySelectorAll('button'));
        const showAllBtn = buttons.find(b => b.textContent.includes('Show All Active Trades'));
        if (showAllBtn) showAllBtn.click();
      `,
    });
    await new Promise((r) => setTimeout(r, 1000));

    snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('dashboard_show_all.png', Buffer.from(snap.data, 'base64'));
    console.log('Saved dashboard_show_all.png');

    // 5. HOSPITAL DASHBOARD - SELECT A TRADE
    await sessionSend('Runtime.evaluate', {
      expression: `
        const viewBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('View on Map'));
        if (viewBtns.length > 1) viewBtns[1].click();
      `,
    });
    await new Promise((r) => setTimeout(r, 800));

    snap = await sessionSend('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('dashboard_trade_selected.png', Buffer.from(snap.data, 'base64'));
    console.log('Saved dashboard_trade_selected.png');

    await send('Browser.close');
    process.exit(0);
  } catch (err) {
    console.error('Screenshot error:', err);
    try { await send('Browser.close'); } catch {}
    process.exit(1);
  }
};
