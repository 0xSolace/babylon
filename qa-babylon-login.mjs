import * as path from 'path';
import { chromium } from 'playwright';

const BASE_URL = 'https://babylon.market';
const SCREENSHOT_DIR =
  '/home/deploy/working-dir/elizaOS/babylon/qa-screenshots';

async function screenshot(page, name) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: false,
  });
  console.log(`screenshot: ${name}`);
}

async function main() {
  const OTP_CODE = process.argv[2] || null;

  console.log(
    OTP_CODE
      ? `=== Completing login with OTP: ${OTP_CODE} ===`
      : '=== Triggering OTP send ==='
  );

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Use persistent context to preserve cookies across runs
  const storageFile = '/tmp/babylon-auth-state.json';
  let context;
  try {
    const fs = await import('fs');
    if (fs.existsSync(storageFile)) {
      context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        storageState: storageFile,
      });
      console.log('Loaded saved auth state');
    } else {
      throw new Error('no saved state');
    }
  } catch {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
  }

  const page = await context.newPage();

  // Go to home and click Play
  console.log('Loading babylon.market...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Check if already logged in
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);

  // Click Play button
  const playBtn = await page.$('button:has-text("Play")');
  if (playBtn && (await playBtn.isVisible())) {
    console.log('Clicking Play...');
    await playBtn.click();
    await page.waitForTimeout(3000);
  }

  await screenshot(page, 'login-01-modal');

  // Find Privy iframe
  const privyIframe = await page.$(
    'iframe[title*="privy"], iframe[src*="privy"]'
  );
  if (!privyIframe) {
    console.log('No Privy iframe found. Checking if already logged in...');
    await screenshot(page, 'login-01-no-privy');

    // Try navigating to an auth-gated page to check
    await page.goto('https://play.babylon.market/feed', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.waitForTimeout(3000);
    const feedUrl = page.url();
    console.log(`Feed URL: ${feedUrl}`);
    if (!feedUrl.includes('?next=')) {
      console.log('ALREADY LOGGED IN! Saving state...');
      await context.storageState({ path: storageFile });
      await screenshot(page, 'login-success-feed');
    }
    await browser.close();
    return;
  }

  const frame = page.frameLocator(
    'iframe[title*="privy"], iframe[src*="privy"]'
  );

  if (!OTP_CODE) {
    // Step 1: Enter email and trigger OTP
    console.log('Looking for email input...');
    const emailInput = frame.locator(
      'input[type="email"], input[placeholder*="email"], input[name="email"]'
    );

    if ((await emailInput.count()) > 0) {
      await emailInput.fill('ben.b@elizalabs.ai');
      console.log('Email entered: ben.b@elizalabs.ai');
      await page.waitForTimeout(500);
      await screenshot(page, 'login-02-email-entered');

      // Click submit
      const submitBtn = frame.locator(
        'button[type="submit"], button:has-text("Submit"), button:has-text("Continue"), button:has-text("Log in"), button:has-text("Send code")'
      );
      if ((await submitBtn.count()) > 0) {
        await submitBtn.first().click();
        console.log('Submit clicked - OTP should be sent to email');
        await page.waitForTimeout(5000);
        await screenshot(page, 'login-03-otp-waiting');
        console.log('\n============================================');
        console.log('CHECK YOUR EMAIL for the 6-digit OTP code');
        console.log('Then run: node /tmp/qa-babylon-login.mjs <OTP_CODE>');
        console.log('============================================\n');
      } else {
        console.log('No submit button found');
        await screenshot(page, 'login-02-no-submit');
      }
    } else {
      console.log('No email input found');
      await screenshot(page, 'login-02-no-email');
    }
  } else {
    // Step 2: Enter OTP code
    console.log('Looking for OTP input...');

    // First enter email again (new session)
    const emailInput = frame.locator(
      'input[type="email"], input[placeholder*="email"], input[name="email"]'
    );
    if ((await emailInput.count()) > 0) {
      await emailInput.fill('ben.b@elizalabs.ai');
      await page.waitForTimeout(500);
      const submitBtn = frame.locator(
        'button[type="submit"], button:has-text("Submit"), button:has-text("Continue"), button:has-text("Log in"), button:has-text("Send code")'
      );
      if ((await submitBtn.count()) > 0) {
        await submitBtn.first().click();
        console.log('Re-submitted email, waiting for OTP screen...');
        await page.waitForTimeout(5000);
      }
    }

    await screenshot(page, 'login-04-before-otp');

    // Look for OTP inputs (usually 6 separate inputs or one text input)
    const otpInputs = frame.locator(
      'input[type="text"], input[type="number"], input[type="tel"], input[aria-label*="code"], input[aria-label*="digit"], input[autocomplete="one-time-code"]'
    );
    const otpCount = await otpInputs.count();
    console.log(`Found ${otpCount} potential OTP inputs`);

    if (otpCount >= 6) {
      // 6 separate digit inputs
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(OTP_CODE[i]);
        await page.waitForTimeout(100);
      }
      console.log('OTP digits entered individually');
    } else if (otpCount >= 1) {
      // Try typing into the first input
      await otpInputs.first().click();
      await otpInputs.first().fill(OTP_CODE);
      console.log('OTP entered into single input');
    } else {
      // Try keyboard typing as last resort
      console.log('No OTP inputs found, trying keyboard input...');
      await page.keyboard.type(OTP_CODE, { delay: 100 });
    }

    await page.waitForTimeout(2000);
    await screenshot(page, 'login-05-otp-entered');

    // Look for verify/submit button
    const verifyBtn = frame.locator(
      'button:has-text("Verify"), button:has-text("Submit"), button:has-text("Continue"), button:has-text("Confirm"), button[type="submit"]'
    );
    if ((await verifyBtn.count()) > 0) {
      await verifyBtn.first().click();
      console.log('Verify clicked');
    }

    // Wait for login to complete
    console.log('Waiting for login to complete...');
    await page.waitForTimeout(10000);
    await screenshot(page, 'login-06-after-verify');

    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);

    // Check if we're logged in by trying to access feed
    await page.goto('https://play.babylon.market/feed', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.waitForTimeout(5000);
    const feedUrl = page.url();
    console.log(`Feed URL after login: ${feedUrl}`);

    if (!feedUrl.includes('?next=')) {
      console.log('\n=== LOGIN SUCCESSFUL ===');
      await context.storageState({ path: storageFile });
      console.log('Auth state saved to /tmp/babylon-auth-state.json');
      await screenshot(page, 'login-07-feed-logged-in');
    } else {
      console.log('\n=== LOGIN MAY HAVE FAILED - still redirecting ===');
      await screenshot(page, 'login-07-still-redirected');

      // Check cookies
      const cookies = await context.cookies();
      const authCookies = cookies.filter(
        (c) => c.name.includes('privy') || c.name.includes('ba_')
      );
      console.log(
        `Auth cookies: ${authCookies.map((c) => `${c.name}=${c.value.substring(0, 20)}...`).join(', ')}`
      );
    }
  }

  await browser.close();
  console.log('Done');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
