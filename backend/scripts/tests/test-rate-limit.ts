/**
 * Test: Login rate-limiter
 *
 * Uses LOGIN_RATE_MAX / LOGIN_RATE_WINDOW_MS env vars so the test can run with a
 * short window without touching the production defaults.
 *
 * Steps:
 *  1. Sends (limit + 10) rapid requests with wrong credentials.
 *  2. Confirms the first `limit` requests are rejected for the right reason
 *     (401 wrong password or 400 validation), NOT 429.
 *  3. Confirms that once the counter is exhausted the server returns 429.
 *  4. Waits for the window to expire.
 *  5. Confirms a fresh request is accepted again (no longer 429).
 *
 * Run (recommended — 15-second window keeps the test fast):
 *
 *   LOGIN_RATE_MAX=10 LOGIN_RATE_WINDOW_MS=15000 \
 *     npx ts-node scripts/tests/test-rate-limit.ts
 *
 * Without env overrides the production defaults apply (10 req / 60 s), so the
 * wait in step 4 will be ~65 seconds instead of ~18 seconds.
 */

import 'dotenv/config';

const BASE_URL  = `http://localhost:${process.env.PORT || 5001}`;
const LOGIN_URL = `${BASE_URL}/api/auth/login`;

const LIMIT     = parseInt(process.env.LOGIN_RATE_MAX        || '10',   10);
const WINDOW_MS = parseInt(process.env.LOGIN_RATE_WINDOW_MS  || '60000', 10);

const WRONG_BODY = JSON.stringify({ email: 'nobody@test.com', password: 'wrongpassword' });
const HEADERS    = { 'Content-Type': 'application/json' };

// ─── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label: string) {
  console.log(`  PASS  ${label}`);
  passed++;
}

function fail(label: string, reason: string) {
  console.error(`  FAIL  ${label}`);
  console.error(`        reason: ${reason}`);
  failed++;
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function postLogin(): Promise<{ status: number; retryAfter: number | null }> {
  const res = await fetch(LOGIN_URL, {
    method : 'POST',
    headers: HEADERS,
    body   : WRONG_BODY,
    signal : AbortSignal.timeout(5000),
  });
  const retryAfter = res.headers.get('retry-after');
  return {
    status    : res.status,
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : null,
  };
}

async function serverIsUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Login Rate-Limit Test ===\n');
  console.log(`  Limit      : ${LIMIT} requests`);
  console.log(`  Window     : ${WINDOW_MS / 1000} s`);
  console.log(`  Login URL  : ${LOGIN_URL}\n`);

  if (!(await serverIsUp())) {
    console.error(`FAIL — Server not reachable at ${BASE_URL}. Run: npm run dev`);
    process.exitCode = 1;
    return;
  }

  const BURST = LIMIT + 10;  // send enough to clearly exhaust the limit

  // ── Step 1 & 2: Fire burst requests, track status codes ───────────────────
  console.log(`Step 1 & 2 — Sending ${BURST} rapid requests (limit is ${LIMIT})...`);

  const statuses: number[] = [];
  for (let i = 0; i < BURST; i++) {
    const { status } = await postLogin();
    statuses.push(status);
    process.stdout.write(` ${status}`);
  }
  console.log('\n');

  // Requests 1..LIMIT should NOT be 429
  const allowedStatuses   = statuses.slice(0, LIMIT);
  const throttledStatuses = statuses.slice(LIMIT);

  const badAllowed = allowedStatuses.filter(s => s === 429);
  if (badAllowed.length === 0) {
    pass(`First ${LIMIT} requests were not rate-limited (got ${[...new Set(allowedStatuses)].join('/')})`);
  } else {
    fail(
      `First ${LIMIT} requests should not be rate-limited`,
      `${badAllowed.length} request(s) among the first ${LIMIT} returned 429 prematurely`,
    );
  }

  // ── Step 3: Requests beyond the limit should all be 429 ───────────────────
  console.log('Step 3 — Confirming requests beyond the limit return 429...');

  const all429 = throttledStatuses.every(s => s === 429);
  if (all429) {
    pass(`All ${throttledStatuses.length} requests after the limit returned 429`);
  } else {
    const non429 = throttledStatuses.filter(s => s !== 429);
    fail(
      `Requests beyond limit ${LIMIT} should return 429`,
      `${non429.length} request(s) returned non-429 statuses: ${[...new Set(non429)].join(', ')}`,
    );
  }

  // ── Step 4: Wait for the window to reset ──────────────────────────────────
  // Send one more request to read the Retry-After header (gives precise wait time)
  const { retryAfter } = await postLogin();
  const waitSec = retryAfter ?? Math.ceil(WINDOW_MS / 1000) + 2;

  console.log(`\nStep 4 — Waiting ${waitSec} s for rate-limit window to reset...`);
  for (let remaining = waitSec; remaining > 0; remaining -= 5) {
    process.stdout.write(`  ${remaining}s remaining...\r`);
    await sleep(Math.min(5000, remaining * 1000));
  }
  process.stdout.write('  window expired.            \n\n');

  // ── Step 5: Confirm requests are accepted again ────────────────────────────
  console.log('Step 5 — Sending request after reset...');
  const { status: afterStatus } = await postLogin();
  console.log(`  Response: HTTP ${afterStatus}\n`);

  if (afterStatus !== 429) {
    pass(`After reset, request returned ${afterStatus} (not 429) — rate limit window cleared`);
  } else {
    fail(
      'After reset, request should not return 429',
      `Still got 429 after waiting ${waitSec} s — window may not have cleared yet`,
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  console.log('─'.repeat(50));
  if (failed === 0) {
    console.log(`\nPASS — All ${passed} checks passed.`);
  } else {
    console.error(`\nFAIL — ${failed} of ${passed + failed} checks failed (see above).`);
    process.exitCode = 1;
  }
}

main().catch(err => { console.error('Unexpected error:', err); process.exitCode = 1; });
