/**
 * Login to Babylon via Privy, capture JWT token
 * Usage:
 *   node qa-login.mjs           # Step 1: send OTP
 *   node qa-login.mjs <OTP>     # Step 2: complete with OTP
 */

import fs from 'fs';
import { chromium } from 'playwright';

const STORAGE_FILE = '/tmp/babylon-auth-state.json';
const TOKEN_FILE = '/tmp/babylon-token.txt';
const SDIR = '/home/deploy/working-dir/elizaOS/babylon/qa-screenshots';
const EMAIL = 'ben.b@elizalabs.ai';
const OTP_CODE = process.argv[2] || null;

async function ss(page, name) {
  await page.screenshot({ path: `${SDIR}/${name}.png`, fullPage: false });
  console.log(`  ss: ${name}`);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Capture JWT from network
  let capturedToken = null;
  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer eyJ') && !capturedToken) {
      capturedToken = auth.replace('Bearer ', '');
      console.log('  TOKEN CAPTURED!');
    }
  });

  console.log('1. Loading babylon.market...');
  await page.goto('https://babylon.market', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  await ss(page, 'step1-landing');

  // Click Play button
  console.log('2. Clicking Play...');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(4000);
  await ss(page, 'step2-modal');

  // Debug: dump all frames and their inputs
  console.log('  Page frames:', page.frames().length);
  for (const frame of page.frames()) {
    const url = frame.url();
    const inputs = await frame
      .locator('input')
      .count()
      .catch(() => 0);
    if (inputs > 0)
      console.log(`  Frame ${url.substring(0, 80)}: ${inputs} inputs`);
  }

  // Also check shadow DOM and iframes
  const inputInfo = await page.evaluate(() => {
    const allInputs = document.querySelectorAll('input');
    const iframes = document.querySelectorAll('iframe');
    return {
      pageInputs: Array.from(allInputs).map((i) => ({
        type: i.type,
        placeholder: i.placeholder,
        name: i.name,
      })),
      iframeCount: iframes.length,
      iframeSrcs: Array.from(iframes).map((f) => f.src.substring(0, 100)),
    };
  });
  console.log('  Page inputs:', JSON.stringify(inputInfo.pageInputs));
  console.log('  Iframes:', inputInfo.iframeCount, inputInfo.iframeSrcs);

  // Try to find email input in main page
  let emailInput = null;

  // Check main page
  const pageEmail = page.locator(
    'input[placeholder*="email"], input[type="email"], input[placeholder*="@"]'
  );
  if ((await pageEmail.count()) > 0) {
    emailInput = pageEmail.first();
    console.log('  Found email in page');
  }

  // Check all iframes
  if (!emailInput) {
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      const fi = frame.locator(
        'input[placeholder*="email"], input[type="email"], input[placeholder*="@"]'
      );
      const cnt = await fi.count().catch(() => 0);
      if (cnt > 0) {
        emailInput = fi.first();
        emailContext = frame;
        console.log(`  Found email in iframe: ${frame.url().substring(0, 80)}`);
        break;
      }
    }
  }

  // Also try frameLocator for privy
  if (!emailInput) {
    const privyFrame = page.frameLocator(
      'iframe[title*="privy"], iframe[src*="privy"]'
    );
    const pEmail = privyFrame.locator(
      'input[placeholder*="email"], input[type="email"], input'
    );
    if ((await pEmail.count().catch(() => 0)) > 0) {
      emailInput = pEmail.first();
      console.log('  Found email via frameLocator(privy)');
    }
  }

  // Brute force: try all iframes
  if (!emailInput) {
    for (let i = 0; i < inputInfo.iframeCount; i++) {
      const fl = page.frameLocator(`iframe >> nth=${i}`);
      const inp = fl.locator('input');
      const cnt = await inp.count().catch(() => 0);
      if (cnt > 0) {
        emailInput = inp.first();
        console.log(`  Found input in iframe #${i}`);
        break;
      }
    }
  }

  if (!emailInput) {
    console.log('ERROR: Cannot find email input anywhere');
    await browser.close();
    process.exit(1);
  }

  // Enter email
  console.log(`3. Entering email: ${EMAIL}`);
  await emailInput.fill(EMAIL);
  await page.waitForTimeout(500);
  await ss(page, 'step3-email');

  // Find and click Submit near the email input
  // Try in the same context (page or iframe)
  const submitSelectors =
    'button:has-text("Submit"), button:has-text("Continue"), button:has-text("Log in"), button:has-text("Send")';

  // If email was in a frameLocator, we need to find submit there too
  let submitClicked = false;

  // Try clicking Submit in the page
  const pageSubmit = page.locator(submitSelectors);
  if ((await pageSubmit.count()) > 0) {
    await pageSubmit.first().click();
    submitClicked = true;
    console.log('  Clicked Submit (page)');
  }

  if (!submitClicked) {
    // Try in iframes
    for (const frame of page.frames()) {
      const fs = frame.locator(submitSelectors);
      if ((await fs.count().catch(() => 0)) > 0) {
        await fs.first().click();
        submitClicked = true;
        console.log('  Clicked Submit (iframe)');
        break;
      }
    }
  }

  if (!submitClicked) {
    // Press Enter
    await emailInput.press('Enter');
    console.log('  Pressed Enter');
  }

  await page.waitForTimeout(5000);
  await ss(page, 'step4-otp-sent');

  if (!OTP_CODE) {
    console.log('\n============================================');
    console.log('OTP sent to ben.b@elizalabs.ai');
    console.log('Run: node qa-login.mjs <6-DIGIT-OTP>');
    console.log('============================================\n');
    await context.storageState({ path: STORAGE_FILE });
    await browser.close();
    return;
  }

  // Enter OTP
  console.log(`5. Entering OTP: ${OTP_CODE}`);
  await ss(page, 'step5-before-otp');

  // Find OTP inputs - check page and iframes
  // Method 1: keyboard type (most reliable for Privy OTP)
  await page.keyboard.type(OTP_CODE, { delay: 150 });
  console.log('  Typed OTP via keyboard');

  await page.waitForTimeout(3000);
  await ss(page, 'step6-otp-typed');

  // Click verify if visible
  const verifyBtns =
    'button:has-text("Verify"), button:has-text("Submit"), button:has-text("Confirm")';
  for (const frame of [page, ...page.frames()]) {
    const vb = frame.locator(verifyBtns);
    if ((await vb.count().catch(() => 0)) > 0) {
      await vb
        .first()
        .click()
        .catch(() => {});
      console.log('  Clicked Verify');
      break;
    }
  }

  // Wait for auth to complete
  console.log('6. Waiting for authentication...');
  await page.waitForTimeout(10000);
  await ss(page, 'step7-post-auth');

  // Navigate to feed
  console.log('7. Going to feed...');
  await page.goto('https://play.babylon.market/feed', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(8000);
  await ss(page, 'step8-feed');
  console.log(`  URL: ${page.url()}`);

  // Extract token from localStorage
  if (!capturedToken) {
    capturedToken = await page
      .evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const val = localStorage.getItem(key);
          if (
            val &&
            val.startsWith('eyJ') &&
            val.includes('.') &&
            val.length > 50
          )
            return val;
          try {
            const p = JSON.parse(val);
            if (typeof p === 'string' && p.startsWith('eyJ')) return p;
            if (p?.token?.startsWith('eyJ')) return p.token;
            if (p?.accessToken?.startsWith('eyJ')) return p.accessToken;
          } catch {}
        }
        return null;
      })
      .catch(() => null);
  }

  // Try cookies
  if (!capturedToken) {
    const cookies = await context.cookies();
    for (const c of cookies) {
      if (c.value.startsWith('eyJ') && c.value.length > 100) {
        capturedToken = c.value;
        break;
      }
    }
  }

  if (capturedToken) {
    const resp = await page.evaluate(async (token) => {
      const res = await fetch('https://play.babylon.market/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status;
    }, capturedToken);

    if (resp === 200) {
      console.log(`\nSUCCESS! Token saved to ${TOKEN_FILE}`);
      fs.writeFileSync(TOKEN_FILE, capturedToken);
      await context.storageState({ path: STORAGE_FILE });
    } else {
      console.log(`Token status: ${resp}`);
    }
  } else {
    console.log('\nNo token captured. Check screenshots for login status.');
  }

  await browser.close();
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
