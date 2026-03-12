/**
 * k6 Load & Chaos Test Suite
 *
 * Scenarios:
 *   1. ten_parents     — 10 VUs each paying a different ledger via webhook
 *   2. race_same       — 2 VUs trying to pay the same ledger simultaneously
 *   3. webhook_clash   — webhook + duplicate webhook for same payment at same instant
 *   4. login_hammer    — 20 VUs hammering login to trigger rate limiter
 *
 * Run:
 *   k6 run scripts/tests/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
// ─── Custom metrics ──────────────────────────────────────────────────────────

const webhookSuccess  = new Counter('webhook_success');
const webhookDupes    = new Counter('webhook_duplicates');
const webhookRejects  = new Counter('webhook_rejects');
const orderCreated    = new Counter('orders_created');
const orderFailed     = new Counter('orders_failed');
const loginBlocked    = new Counter('login_rate_limited');
const loginAllowed    = new Counter('login_allowed');
const raceWins        = new Counter('race_wins');
const raceDupes       = new Counter('race_duplicates');
const webhookLatency  = new Trend('webhook_latency_ms');

// ─── Load manifest ──────────────────────────────────────────────────────────

const manifest = JSON.parse(open('/tmp/k6-test-manifest.json'));
const BASE_URL = manifest.baseUrl;
const WEBHOOK_SECRET = manifest.webhookSecret;

// ─── HMAC-SHA256 for webhook signing ─────────────────────────────────────────

function hmacSha256Hex(secret, message) {
  // k6's webcrypto is async, but we need sync for http calls.
  // Use the k6 built-in hmac from k6/crypto instead.
  // Fallback: we'll pre-sign in the default function.
  // Actually, k6 has k6/crypto with hmac.
  return null; // placeholder, we'll use the other approach
}

// k6 doesn't have sync crypto.createHmac, so we'll use a workaround:
// Import from k6/crypto which has hmac()
import { hmac } from 'k6/crypto';

function signPayload(body) {
  return hmac('sha256', WEBHOOK_SECRET, body, 'hex');
}

// ─── Scenarios ──────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Scenario 1: 10 parents paying simultaneously
    ten_parents: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      exec: 'scenarioTenParents',
      startTime: '0s',
      maxDuration: '60s',
    },
    // Scenario 2: 2 VUs racing on same ledger
    race_same: {
      executor: 'per-vu-iterations',
      vus: 2,
      iterations: 1,
      exec: 'scenarioRaceSame',
      startTime: '0s',
      maxDuration: '60s',
    },
    // Scenario 3: duplicate webhook clash
    webhook_clash: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 1,
      exec: 'scenarioWebhookClash',
      startTime: '0s',
      maxDuration: '60s',
    },
    // Scenario 4: hammer login endpoint
    login_hammer: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 3,
      exec: 'scenarioLoginHammer',
      startTime: '0s',
      maxDuration: '60s',
    },
  },
  thresholds: {
    webhook_success:    ['count>=10'],  // at least 10 successful webhooks
    webhook_duplicates: ['count>=1'],   // at least 1 dedup caught
    webhook_rejects:    ['count==0'],   // no false rejections
    login_rate_limited: ['count>=1'],   // rate limiter must fire
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 1: 10 parents pay simultaneously
// ═══════════════════════════════════════════════════════════════════════════════

export function scenarioTenParents() {
  const idx = __VU - 1; // VU 1-10 → index 0-9
  const parent = manifest.parents[idx];
  if (!parent) return;

  group(`Parent ${idx + 1}: create order + webhook`, () => {
    // Step 1: Create order
    const orderRes = http.post(
      `${BASE_URL}/api/payments/create-order`,
      JSON.stringify({ ledgerId: parent.ledgerId }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${parent.token}`,
        },
        timeout: '30s',
      },
    );

    const orderOk = check(orderRes, {
      'create-order: status 200': (r) => r.status === 200,
    });

    if (!orderOk) {
      orderFailed.add(1);
      console.log(`VU ${__VU}: create-order failed: ${orderRes.status} ${orderRes.body}`);
      return;
    }
    orderCreated.add(1);

    const orderData = orderRes.json('data');
    const orderId = orderData.orderId;

    // Step 2: Simulate webhook (as if Razorpay captured payment)
    const paymentId = `pay_k6_vu${__VU}_${Date.now()}`;
    const webhookBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: Math.round(parent.ledgerAmount * 100),
            notes: { ledgerId: parent.ledgerId },
          },
        },
      },
    });

    const sig = signPayload(webhookBody);
    const start = Date.now();
    const whRes = http.post(`${BASE_URL}/api/webhooks/razorpay`, webhookBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': sig,
      },
      timeout: '30s',
    });
    webhookLatency.add(Date.now() - start);

    const whOk = check(whRes, {
      'webhook: status 200': (r) => r.status === 200,
    });

    if (whOk) {
      const body = whRes.json();
      if (body.duplicate) {
        webhookDupes.add(1);
      } else {
        webhookSuccess.add(1);
      }
    } else {
      webhookRejects.add(1);
      console.log(`VU ${__VU}: webhook failed: ${whRes.status} ${whRes.body}`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 2: 2 VUs race on the same ledger
// ═══════════════════════════════════════════════════════════════════════════════

export function scenarioRaceSame() {
  const race = manifest.raceLedger;
  // Both VUs use parent1's token (owner of the race ledger)
  const token = race.tokens[0];

  group('Race: same ledger', () => {
    // Each VU creates its own order (simulating 2 browser tabs)
    const orderRes = http.post(
      `${BASE_URL}/api/payments/create-order`,
      JSON.stringify({ ledgerId: race.ledgerId }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: '30s',
      },
    );

    if (orderRes.status !== 200) {
      // Second VU might get "already fully paid" if first webhook already fired
      const body = orderRes.json();
      if (body && body.message && body.message.includes('already fully paid')) {
        raceDupes.add(1);
        console.log(`VU ${__VU}: Race ledger already paid (order creation blocked)`);
        return;
      }
      console.log(`VU ${__VU}: race create-order failed: ${orderRes.status} ${orderRes.body}`);
      return;
    }

    const orderData = orderRes.json('data');
    const orderId = orderData.orderId;

    // Fire webhook
    const paymentId = `pay_k6_race_vu${__VU}_${Date.now()}`;
    const webhookBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: Math.round(race.amount * 100),
            notes: { ledgerId: race.ledgerId },
          },
        },
      },
    });

    const sig = signPayload(webhookBody);
    const whRes = http.post(`${BASE_URL}/api/webhooks/razorpay`, webhookBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': sig,
      },
      timeout: '30s',
    });

    const body = whRes.json();
    if (whRes.status === 200 && !body.duplicate) {
      raceWins.add(1);
      console.log(`VU ${__VU}: Race WIN — payment recorded`);
    } else if (body.duplicate) {
      raceDupes.add(1);
      console.log(`VU ${__VU}: Race DEDUP — duplicate caught`);
    } else {
      console.log(`VU ${__VU}: Race unexpected: ${whRes.status} ${whRes.body}`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 3: 5 duplicate webhooks for the same payment ID simultaneously
// ═══════════════════════════════════════════════════════════════════════════════

export function scenarioWebhookClash() {
  // All 5 VUs fire the exact same webhook payload (same payment_id)
  const parent = manifest.parents[0];
  const paymentId = 'pay_k6_clash_shared';
  const orderId = 'order_k6_clash_shared';

  const webhookBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount: Math.round(parent.ledgerAmount * 100),
          notes: { ledgerId: parent.ledgerId },
        },
      },
    },
  });

  const sig = signPayload(webhookBody);

  group('Webhook clash: 5 VUs same payment_id', () => {
    const whRes = http.post(`${BASE_URL}/api/webhooks/razorpay`, webhookBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': sig,
      },
      timeout: '30s',
    });

    check(whRes, { 'clash webhook: 200': (r) => r.status === 200 });

    const body = whRes.json();
    if (body.duplicate) {
      webhookDupes.add(1);
      console.log(`VU ${__VU}: Clash → duplicate`);
    } else {
      webhookSuccess.add(1);
      console.log(`VU ${__VU}: Clash → WIN (first writer)`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCENARIO 4: Hammer login endpoint
// ═══════════════════════════════════════════════════════════════════════════════

export function scenarioLoginHammer() {
  group('Login hammer', () => {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: 'nobody@test.com', password: 'wrongpassword' }),
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: '10s',
      },
    );

    if (res.status === 429) {
      loginBlocked.add(1);
    } else {
      loginAllowed.add(1);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════════════

export function handleSummary(data) {
  const get = (name) => {
    const m = data.metrics[name];
    return m ? (m.values.count ?? m.values.value ?? 0) : 0;
  };

  const summary = {
    '═══ K6 LOAD TEST RESULTS ═══': '',
    'Orders created':        get('orders_created'),
    'Orders failed':         get('orders_failed'),
    'Webhooks succeeded':    get('webhook_success'),
    'Webhooks duplicates':   get('webhook_duplicates'),
    'Webhooks rejected':     get('webhook_rejects'),
    'Race wins':             get('race_wins'),
    'Race duplicates':       get('race_duplicates'),
    'Login allowed':         get('login_allowed'),
    'Login rate-limited':    get('login_rate_limited'),
    'Webhook latency p95':   data.metrics.webhook_latency_ms
      ? `${Math.round(data.metrics.webhook_latency_ms.values['p(95)'])}ms`
      : 'N/A',
  };

  let text = '\n╔═══════════════════════════════════════════════════╗\n';
  text += '║           K6 LOAD & CHAOS TEST REPORT             ║\n';
  text += '╠═══════════════════════════════════════════════════╣\n';

  for (const [key, val] of Object.entries(summary)) {
    if (val === '') {
      // section header
      continue;
    }
    text += `║  ${key.padEnd(25)} ${String(val).padStart(20)} ║\n`;
  }
  text += '╚═══════════════════════════════════════════════════╝\n';

  return {
    stdout: text,
    '/tmp/k6-results.json': JSON.stringify(summary, null, 2),
  };
}
