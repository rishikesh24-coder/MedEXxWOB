import { spawn } from 'child_process';
import http from 'http';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\rishi\\AppData\\Local\\Temp\\chrome_test_profile_' + Date.now();

const chrome = spawn(chromePath, [
  '--headless=new',
  `--user-data-dir=${userDataDir}`,
  '--remote-debugging-port=9222',
  '--window-size=1280,1000',
  'about:blank',
]);

await new Promise((r) => setTimeout(r, 1500));

// Get websocket debugger URL
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

    // Wait for page to initialize storage
    await new Promise((r) => setTimeout(r, 1000));

    // Inject auth session
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

    // Navigate to dashboard
    await sessionSend('Page.navigate', { url: 'http://localhost:5173/hospital/dashboard' });
    await new Promise((r) => setTimeout(r, 3000));

    // Take screenshot
    const { data } = await sessionSend('Page.captureScreenshot', { format: 'png' });
    const fs = await import('fs');
    fs.writeFileSync('dashboard_logged_in.png', Buffer.from(data, 'base64'));
    console.log('Saved dashboard_logged_in.png');

    await send('Browser.close');
    process.exit(0);
  } catch (err) {
    console.error('CDP Error:', err);
    try { await send('Browser.close'); } catch {}
    process.exit(1);
  }
};
