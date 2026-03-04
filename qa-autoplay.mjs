/**
 * Babylon Auto-Player — plays the game for 2 hours via API
 *
 * Keeps a Playwright browser alive for token refresh.
 * Privy auto-refreshes JWT in-browser, we extract it periodically.
 *
 * Usage:
 *   node qa-autoplay.mjs <INITIAL_JWT_TOKEN>
 *
 * Writes running log to: qa-reports/autoplay-log.md
 */

import fs from 'fs';
import { chromium } from 'playwright';

const BASE = 'https://play.babylon.market';
const REPORT_DIR = '/home/deploy/working-dir/elizaOS/babylon/qa-reports';
const LOG_FILE = `${REPORT_DIR}/autoplay-log.md`;
const STORAGE_FILE = '/tmp/babylon-auth-state.json';
const DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const TOKEN_REFRESH_INTERVAL = 45 * 60 * 1000; // refresh token every 45 min
const ACTION_INTERVAL = 15_000; // do something every 15 seconds
const startTime = Date.now();

let token = process.argv[2];
if (!token) {
  console.error('Usage: node qa-autoplay.mjs <JWT_TOKEN>');
  process.exit(1);
}

let browser, page, context;
let actionCount = 0;
let errorCount = 0;
let balance = null;
const tradeLog = [];
const bugLog = [];

// ── Logging ─────────────────────────────────────────────────────────────────
function elapsed() {
  const ms = Date.now() - startTime;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m${s}s`;
}

function log(msg) {
  const line = `[${elapsed()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function logBug(severity, endpoint, status, detail) {
  bugLog.push({ severity, endpoint, status, detail, time: elapsed() });
  log(`🐛 BUG [${severity}] ${endpoint} → ${status}: ${detail}`);
}

// ── API helpers ─────────────────────────────────────────────────────────────
async function api(method, path, body = null) {
  const url = `${BASE}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const start = Date.now();
  try {
    const res = await fetch(url, opts);
    const latency = Date.now() - start;
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, ok: res.ok, data, latency };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      data: null,
      latency: Date.now() - start,
      error: err.message,
    };
  }
}

async function apiOk(method, path, body = null) {
  const r = await api(method, path, body);
  if (!r.ok && r.status === 401) {
    log('⚠️  Token expired — attempting browser refresh...');
    await refreshToken();
    return api(method, path, body);
  }
  return r;
}

// ── Token refresh via browser ───────────────────────────────────────────────
async function refreshToken() {
  if (!page) return;
  log('🔄 Refreshing token from browser...');

  // Navigate to trigger Privy auto-refresh
  try {
    await page.goto(`${BASE}/feed`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    await page.waitForTimeout(5000);
  } catch {
    log('⚠️  Browser navigation failed during refresh');
  }

  // Try to capture from network requests (set up listener temporarily)
  let newToken = null;

  // Method 1: Extract from localStorage
  newToken = await page
    .evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        if (
          val &&
          val.startsWith('eyJ') &&
          val.includes('.') &&
          val.length > 100
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

  // Method 2: Extract from cookies
  if (!newToken) {
    const cookies = await context.cookies();
    for (const c of cookies) {
      if (c.name === 'privy-token' && c.value.startsWith('eyJ')) {
        newToken = c.value;
        break;
      }
    }
    if (!newToken) {
      for (const c of cookies) {
        if (c.value.startsWith('eyJ') && c.value.length > 100) {
          newToken = c.value;
          break;
        }
      }
    }
  }

  // Method 3: Make an API call from browser to trigger network request
  if (!newToken) {
    newToken = await page
      .evaluate(async () => {
        try {
          const res = await fetch('/api/users/me', { credentials: 'include' });
          if (res.ok) {
            // Token came from cookie, try to find it
            return null;
          }
        } catch {}
        return null;
      })
      .catch(() => null);
  }

  if (newToken) {
    // Verify the new token works
    const check = await fetch(`${BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    if (check.ok) {
      token = newToken;
      log('✅ Token refreshed successfully!');
      return;
    }
  }

  log('❌ Token refresh failed — will keep trying with current token');
}

// ── Game actions ────────────────────────────────────────────────────────────

async function checkBalance() {
  const r = await apiOk('GET', '/api/users/me');
  if (r.ok) {
    balance = r.data?.user?.virtualBalance ?? r.data?.virtualBalance;
    log(`💰 Balance: ${balance} pts`);
  }
  return r;
}

async function sendHeartbeat() {
  const r = await apiOk('POST', '/api/activity/heartbeat');
  if (r.ok) log(`💓 Heartbeat OK`);
  else
    logBug(
      'low',
      'POST /api/activity/heartbeat',
      r.status,
      JSON.stringify(r.data)
    );
}

async function browseFeed() {
  const r = await apiOk('GET', '/api/posts?limit=5');
  if (r.ok) {
    const posts = r.data?.posts ?? r.data ?? [];
    const count = Array.isArray(posts) ? posts.length : 0;
    log(`📰 Feed: ${count} posts loaded`);
    return posts;
  }
  logBug('low', 'GET /api/posts', r.status, JSON.stringify(r.data));
  return [];
}

async function browseHotFeed() {
  const r = await apiOk('GET', '/api/feed/hot');
  if (r.ok) log(`🔥 Hot feed loaded`);
  return r;
}

async function viewPost(postId) {
  const r = await apiOk('GET', `/api/posts/${postId}`);
  if (r.ok) log(`👁️  Viewed post ${postId}`);
  return r;
}

async function likePost(postId) {
  // Try multiple methods to find the right one
  for (const [method, path, body] of [
    ['POST', `/api/posts/${postId}/like`, {}],
    ['POST', `/api/posts/${postId}/reaction`, { type: 'like' }],
    ['POST', `/api/posts/${postId}`, { action: 'like' }],
    ['PUT', `/api/posts/${postId}/like`, {}],
  ]) {
    const r = await api(method, path, body);
    if (r.ok) {
      log(`❤️  Liked post ${postId} via ${method} ${path}`);
      return r;
    }
    if (r.status === 401) {
      await refreshToken();
      return;
    }
  }
  log(`⚠️  Could not like post ${postId} (tried 4 methods)`);
}

async function replyToPost(postId) {
  const replies = [
    'Interesting take! 🤔',
    'Based analysis right here',
    'This market is wild today',
    'Great call on this one',
    'The data speaks for itself',
  ];
  const text = replies[Math.floor(Math.random() * replies.length)];

  for (const body of [{ content: text }, { text }, { body: text }]) {
    const r = await api('POST', `/api/posts/${postId}/reply`, body);
    if (r.ok) {
      log(`💬 Replied to ${postId}: "${text}"`);
      return r;
    }
    if (r.status === 401) {
      await refreshToken();
      return;
    }
  }
  log(`⚠️  Could not reply to ${postId}`);
}

async function createPost() {
  const posts = [
    'Market analysis: seeing interesting patterns in the perps today 📊',
    'Just adjusted my positions — hedging against volatility 🎯',
    'The NPC predictions are getting wild. Who else is tracking these? 👀',
    "Playing the long game on TSLAI. Let's see how this plays out 🚀",
    'Risk management is key. Never go all-in on a single prediction 💡',
    'Babylon Day ' +
      Math.floor((Date.now() - new Date('2025-11-30').getTime()) / 86400000) +
      ' - still bullish!',
  ];
  const text = posts[Math.floor(Math.random() * posts.length)];
  const r = await apiOk('POST', '/api/posts', { content: text });
  if (r.ok) log(`📝 Created post: "${text}"`);
  else log(`⚠️  Post creation: ${r.status} ${JSON.stringify(r.data)}`);
  return r;
}

async function listPredictionMarkets() {
  const r = await apiOk(
    'GET',
    '/api/markets/predictions?status=active&limit=20'
  );
  if (r.ok) {
    const markets = r.data?.questions ?? r.data?.markets ?? [];
    log(`📈 ${markets.length} active prediction markets`);
    return markets;
  }
  return [];
}

async function buyPrediction(marketId, outcome = 'yes', amount = 5) {
  const r = await apiOk('POST', `/api/markets/predictions/${marketId}/buy`, {
    outcome,
    amount,
  });
  if (r.ok) {
    const detail = `Bought ${outcome.toUpperCase()} on ${marketId} for ${amount} pts`;
    log(`🎰 ${detail}`);
    tradeLog.push({
      type: 'prediction_buy',
      marketId,
      outcome,
      amount,
      time: elapsed(),
      result: r.data,
    });
  } else {
    log(`⚠️  Prediction buy failed: ${r.status} ${JSON.stringify(r.data)}`);
    if (r.status >= 500)
      logBug(
        'medium',
        `POST /api/markets/predictions/${marketId}/buy`,
        r.status,
        JSON.stringify(r.data)
      );
  }
  return r;
}

async function sellPrediction(marketId, outcome = 'yes', shares = 2) {
  const r = await apiOk('POST', `/api/markets/predictions/${marketId}/sell`, {
    outcome,
    shares,
  });
  if (r.ok) {
    log(`💸 Sold ${shares} ${outcome.toUpperCase()} shares on ${marketId}`);
    tradeLog.push({
      type: 'prediction_sell',
      marketId,
      outcome,
      shares,
      time: elapsed(),
      result: r.data,
    });
  } else {
    log(`⚠️  Prediction sell: ${r.status} ${JSON.stringify(r.data)}`);
  }
  return r;
}

async function listPerps() {
  const r = await apiOk('GET', '/api/markets/perps');
  if (r.ok) {
    const markets = r.data?.markets ?? [];
    log(`📊 ${markets.length} perp markets`);
    return markets;
  }
  return [];
}

async function openPerp(ticker, side = 'long', size = 10, leverage = 2) {
  const r = await apiOk('POST', `/api/markets/perps/${ticker}/open`, {
    side,
    size,
    leverage,
  });
  if (r.ok) {
    log(`📈 Opened ${side} ${ticker}: size=${size}, lev=${leverage}x`);
    tradeLog.push({
      type: 'perp_open',
      ticker,
      side,
      size,
      leverage,
      time: elapsed(),
      result: r.data,
    });
  } else {
    log(`⚠️  Perp open failed: ${r.status} ${JSON.stringify(r.data)}`);
    if (r.status >= 500)
      logBug(
        'medium',
        `POST /api/markets/perps/${ticker}/open`,
        r.status,
        JSON.stringify(r.data)
      );
  }
  return r;
}

async function closePerp(ticker) {
  const r = await apiOk('POST', `/api/markets/perps/${ticker}/close`, {});
  if (r.ok) {
    log(`📉 Closed ${ticker} position`);
    tradeLog.push({
      type: 'perp_close',
      ticker,
      time: elapsed(),
      result: r.data,
    });
  } else {
    log(`⚠️  Perp close: ${r.status} ${JSON.stringify(r.data)}`);
  }
  return r;
}

async function checkLeaderboard() {
  const r = await apiOk('GET', '/api/leaderboard?limit=5');
  if (r.ok) {
    const users = r.data?.users ?? r.data?.leaderboard ?? [];
    const top = users[0];
    log(`🏆 Leaderboard top: ${top?.username ?? '?'} — ${users.length} shown`);
  }
  return r;
}

async function checkActors() {
  const r = await apiOk('GET', '/api/actors?limit=5');
  if (r.ok) {
    const actors = r.data?.actors ?? r.data ?? [];
    log(`🤖 ${actors.length} actors loaded`);
  }
  return r;
}

async function checkAgents() {
  const r = await apiOk('GET', '/api/agents');
  if (r.ok) log(`🤖 Agents endpoint: OK`);
  else logBug('critical', 'GET /api/agents', r.status, JSON.stringify(r.data));
  return r;
}

async function checkChats() {
  const r = await apiOk('GET', '/api/chats');
  if (r.ok) log(`💬 Chats: ${JSON.stringify(r.data).substring(0, 100)}`);
  return r;
}

async function checkNotifications() {
  const r = await apiOk('GET', '/api/notifications');
  if (r.ok) log(`🔔 Notifications loaded`);
  return r;
}

async function checkStats() {
  const r = await apiOk('GET', '/api/stats');
  if (r.ok) log(`📊 Game stats: ${JSON.stringify(r.data).substring(0, 150)}`);
  return r;
}

async function checkTrades() {
  const r = await apiOk('GET', '/api/trades');
  if (r.ok) {
    const trades = r.data?.trades ?? r.data ?? [];
    log(
      `📋 Trade history: ${Array.isArray(trades) ? trades.length : '?'} trades`
    );
  }
  return r;
}

async function exploreEndpoint(path) {
  const r = await api('GET', path);
  log(`🔍 ${path} → ${r.status} (${r.latency}ms)`);
  if (r.status >= 500)
    logBug('medium', `GET ${path}`, r.status, JSON.stringify(r.data));
  return r;
}

// ── Action scheduler ────────────────────────────────────────────────────────
const actionWeights = [
  {
    name: 'browseFeed',
    weight: 15,
    fn: async () => {
      const posts = await browseFeed();
      if (posts.length > 0) await viewPost(posts[0]?.id ?? posts[0]);
    },
  },
  { name: 'browseHotFeed', weight: 8, fn: browseHotFeed },
  { name: 'heartbeat', weight: 10, fn: sendHeartbeat },
  { name: 'createPost', weight: 5, fn: createPost },
  {
    name: 'likePost',
    weight: 8,
    fn: async () => {
      const posts = await browseFeed();
      if (posts[0]) await likePost(posts[0].id ?? posts[0]);
    },
  },
  {
    name: 'replyToPost',
    weight: 4,
    fn: async () => {
      const posts = await browseFeed();
      if (posts[0]) await replyToPost(posts[0].id ?? posts[0]);
    },
  },
  {
    name: 'buyPrediction',
    weight: 8,
    fn: async () => {
      const markets = await listPredictionMarkets();
      if (markets.length === 0) return;
      const m =
        markets[Math.floor(Math.random() * Math.min(5, markets.length))];
      const outcome = Math.random() > 0.5 ? 'yes' : 'no';
      await buyPrediction(m.id, outcome, 5);
    },
  },
  {
    name: 'sellPrediction',
    weight: 3,
    fn: async () => {
      const markets = await listPredictionMarkets();
      if (markets.length === 0) return;
      const m = markets[0];
      await sellPrediction(m.id, 'yes', 1);
    },
  },
  {
    name: 'openPerp',
    weight: 6,
    fn: async () => {
      const perps = await listPerps();
      if (perps.length === 0) return;
      const ticker =
        perps[Math.floor(Math.random() * Math.min(3, perps.length))].ticker;
      const side = Math.random() > 0.5 ? 'long' : 'short';
      await openPerp(ticker, side, 10, 2);
    },
  },
  {
    name: 'closePerp',
    weight: 4,
    fn: async () => {
      const tickers = ['TSLAI', 'OPENAGI', 'CRFT'];
      const ticker = tickers[Math.floor(Math.random() * tickers.length)];
      await closePerp(ticker);
    },
  },
  { name: 'checkBalance', weight: 8, fn: checkBalance },
  { name: 'leaderboard', weight: 5, fn: checkLeaderboard },
  { name: 'actors', weight: 4, fn: checkActors },
  { name: 'agents', weight: 3, fn: checkAgents },
  { name: 'chats', weight: 3, fn: checkChats },
  { name: 'notifications', weight: 4, fn: checkNotifications },
  { name: 'stats', weight: 3, fn: checkStats },
  { name: 'trades', weight: 4, fn: checkTrades },
  {
    name: 'explore',
    weight: 2,
    fn: async () => {
      const paths = [
        '/api/organizations',
        '/api/portfolio',
        '/api/rewards',
        '/api/referrals',
        '/api/quests',
        '/api/achievements',
        '/api/events',
        '/api/feed/following',
        '/api/feed/latest',
        '/api/daily-rewards',
        '/api/search?q=ai',
        '/api/config',
        '/api/economy',
      ];
      await exploreEndpoint(paths[Math.floor(Math.random() * paths.length)]);
    },
  },
];

function pickAction() {
  const totalWeight = actionWeights.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * totalWeight;
  for (const action of actionWeights) {
    r -= action.weight;
    if (r <= 0) return action;
  }
  return actionWeights[0];
}

// ── Report writer ───────────────────────────────────────────────────────────
function writeReport() {
  const report = `# Babylon Auto-Play Report

**Duration:** ${elapsed()}
**Actions performed:** ${actionCount}
**Errors encountered:** ${errorCount}
**Starting balance:** ~1,874 pts
**Ending balance:** ${balance ?? 'unknown'} pts

---

## Bugs Found

| Severity | Endpoint | Status | Detail | Time |
|----------|----------|--------|--------|------|
${bugLog.length === 0 ? '| - | No bugs found | - | - | - |' : bugLog.map((b) => `| ${b.severity} | ${b.endpoint} | ${b.status} | ${b.detail.substring(0, 80)} | ${b.time} |`).join('\n')}

---

## Trade Log

| Time | Type | Detail |
|------|------|--------|
${tradeLog.map((t) => `| ${t.time} | ${t.type} | ${t.ticker ?? t.marketId ?? ''} ${t.side ?? t.outcome ?? ''} ${t.size ?? t.amount ?? t.shares ?? ''} |`).join('\n')}

---

## Session Stats
- Total API calls: ~${actionCount * 2} (actions + supporting calls)
- Bug count: ${bugLog.length}
- Trade count: ${tradeLog.length}
- Token refreshes attempted: tracked in log

---

## Full Log
See: autoplay-log.md
`;

  fs.writeFileSync(`${REPORT_DIR}/autoplay-report.md`, report);
  log('📄 Report written to autoplay-report.md');
}

// ── Main loop ───────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    LOG_FILE,
    `# Babylon Auto-Play Log\nStarted: ${new Date().toISOString()}\n\n`
  );

  log('🚀 Starting Babylon auto-player (2 hour session)');

  // Verify initial token
  const me = await api('GET', '/api/users/me');
  if (!me.ok) {
    log(`❌ Initial token invalid: ${me.status}`);
    process.exit(1);
  }
  balance = me.data?.user?.virtualBalance ?? me.data?.virtualBalance;
  log(
    `✅ Authenticated as ${me.data?.user?.username ?? me.data?.username} (balance: ${balance})`
  );

  // Launch browser for token refresh
  log('🌐 Launching browser for token auto-refresh...');
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const contextOpts = { viewport: { width: 1440, height: 900 } };
  if (fs.existsSync(STORAGE_FILE)) {
    contextOpts.storageState = STORAGE_FILE;
  }
  context = await browser.newContext(contextOpts);
  page = await context.newPage();

  // Capture tokens from network traffic
  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer eyJ')) {
      const newTok = auth.replace('Bearer ', '');
      if (newTok !== token) {
        token = newTok;
        log('🔑 Captured fresh token from browser network!');
      }
    }
  });

  // Load the app in browser to establish Privy session
  try {
    await page.goto(`${BASE}/feed`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(5000);
    await context.storageState({ path: STORAGE_FILE });
    log('🌐 Browser session established');
  } catch (e) {
    log(`⚠️  Browser load issue: ${e.message} — continuing with API only`);
  }

  // Schedule token refresh
  const refreshInterval = setInterval(async () => {
    try {
      await refreshToken();
    } catch (e) {
      log(`⚠️  Refresh error: ${e.message}`);
    }
  }, TOKEN_REFRESH_INTERVAL);

  // Schedule report writing every 10 minutes
  const reportInterval = setInterval(writeReport, 10 * 60 * 1000);

  // ── Game loop ───────────────────────────────────────────────────────────
  log('🎮 Starting game loop...\n');

  while (Date.now() - startTime < DURATION_MS) {
    try {
      const action = pickAction();
      actionCount++;
      log(`\n── Action #${actionCount}: ${action.name} ──`);
      await action.fn();
    } catch (err) {
      errorCount++;
      log(`❌ Error: ${err.message}`);
      if (err.message.includes('401') || err.message.includes('expired')) {
        await refreshToken();
      }
    }

    // Wait between actions (randomize 10-20s)
    const wait = ACTION_INTERVAL + Math.random() * 5000;
    await new Promise((r) => setTimeout(r, wait));
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  log('\n🏁 2-hour session complete!');
  clearInterval(refreshInterval);
  clearInterval(reportInterval);

  await checkBalance();
  writeReport();

  await context.storageState({ path: STORAGE_FILE });
  await browser.close();
  log('👋 Done. Reports in qa-reports/');
}

main().catch((e) => {
  console.error('FATAL:', e);
  writeReport();
  process.exit(1);
});
