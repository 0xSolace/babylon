/**
 * Get a fresh Privy JWT by using saved browser state or re-authenticating.
 * Outputs the token to stdout and saves to /tmp/babylon-token.txt
 */

import fs from 'fs';
import { chromium } from 'playwright';

const STORAGE_FILE = '/tmp/babylon-auth-state.json';
const TOKEN_FILE = '/tmp/babylon-token.txt';

async function getToken() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let context;
  if (fs.existsSync(STORAGE_FILE)) {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      storageState: STORAGE_FILE,
    });
  } else {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
  }

  const page = await context.newPage();

  // Intercept API calls to capture the auth token
  let capturedToken = null;

  page.on('request', (request) => {
    const authHeader = request.headers()['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ') && !capturedToken) {
      capturedToken = authHeader.replace('Bearer ', '');
    }
  });

  // Navigate to the app - it will auto-authenticate if cookies are valid
  console.error('Loading play.babylon.market...');
  await page.goto('https://play.babylon.market/feed', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Wait for page to load and make API calls
  await page.waitForTimeout(8000);

  // Also try extracting from localStorage/Privy SDK
  if (!capturedToken) {
    capturedToken = await page.evaluate(() => {
      // Try localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        if (key.includes('privy') && val && val.startsWith('eyJ')) {
          return val;
        }
        if (key.includes('token') && val && val.startsWith('eyJ')) {
          return val;
        }
      }

      // Try Privy internal state
      try {
        const privyState = JSON.parse(
          localStorage.getItem('privy:token') || '""'
        );
        if (
          privyState &&
          typeof privyState === 'string' &&
          privyState.startsWith('eyJ')
        ) {
          return privyState;
        }
      } catch {}

      return null;
    });
  }

  if (!capturedToken) {
    // Try making an API call that triggers auth
    console.error('No token captured yet, triggering API call...');
    await page.evaluate(async () => {
      try {
        await fetch('/api/users/me', { credentials: 'include' });
      } catch {}
    });
    await page.waitForTimeout(3000);
  }

  // Check the URL - if redirected to login, session is expired
  const currentUrl = page.url();
  console.error(`Current URL: ${currentUrl}`);

  if (!capturedToken) {
    // Try to get token from cookies
    const cookies = await context.cookies();
    for (const cookie of cookies) {
      if (cookie.value.startsWith('eyJ') && cookie.value.includes('.')) {
        capturedToken = cookie.value;
        break;
      }
    }
  }

  if (capturedToken) {
    // Verify the token works
    const response = await page.evaluate(async (token) => {
      const res = await fetch('https://play.babylon.market/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, ok: res.ok };
    }, capturedToken);

    if (response.ok) {
      console.error(`Token valid! Status: ${response.status}`);
      fs.writeFileSync(TOKEN_FILE, capturedToken);
      console.log(capturedToken); // stdout for piping
    } else {
      console.error(
        `Token invalid (${response.status}), session may be expired`
      );
      console.error(
        'Need fresh login - run: node packages/testing/qa-babylon-login.mjs'
      );
      process.exit(1);
    }
  } else {
    console.error('Could not capture token. Session expired.');
    console.error(
      'Need fresh login - run: node packages/testing/qa-babylon-login.mjs'
    );
    process.exit(1);
  }

  await browser.close();
}

getToken().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
