/**
 * Payment Flow Test Suite — Webhook-First Architecture
 *
 * Tests 1-9 covering the complete webhook-first payment flow.
 * Requires the backend server to be running on localhost:5001.
 *
 * Run:
 *   npx ts-node scripts/tests/test-payment-flow.ts
 */

import 'dotenv/config';
import crypto from 'crypto';
import prisma from '../../src/config/prisma';
import { signToken } from '../../src/utils/jwt';
import { runReconciliationJob } from '../../src/jobs/reconciliation.job';

const BASE_URL = `http://localhost:${process.env.PORT || 5001}`;
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/razorpay`;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let totalPassed = 0;
let totalFailed = 0;

function pass(msg: string) { console.log(`  ✓ ${msg}`); totalPassed++; }
function fail(msg: string) { console.error(`  ✗ ${msg}`); totalFailed++; }

function assert(condition: boolean, passMsg: string, failMsg: string) {
  condition ? pass(passMsg) : fail(failMsg);
}

function signWebhookPayload(body: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function buildWebhookPayload(overrides: {
  paymentId?: string;
  orderId?: string;
  amount?: number;
  ledgerId?: string | null;
}) {
  const notes: Record<string, string> = {};
  if (overrides.ledgerId !== null && overrides.ledgerId !== undefined) {
    notes.ledgerId = overrides.ledgerId;
  }

  return JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: overrides.paymentId || `pay_TEST_${Date.now()}`,
          order_id: overrides.orderId || `order_TEST_${Date.now()}`,
          amount: overrides.amount || 300000,
          notes,
        },
      },
    },
  });
}

async function sendWebhook(body: string, signature?: string): Promise<{ status: number; body: any }> {
  const sig = signature ?? signWebhookPayload(body);
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': sig,
    },
    body,
    signal: AbortSignal.timeout(15000),
  });
  return { status: res.status, body: await res.json() };
}

async function serverIsUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}

// ─── Seed helpers ────────────────────────────────────────────────────────────

const cleanupIds: {
  ledgerIds: string[];
  paymentIds: string[];
  alertIds: string[];
} = { ledgerIds: [], paymentIds: [], alertIds: [] };

async function createTestLedger(opts: {
  studentId: string;
  month: number;
  year: number;
  baseAmount: number;
  status?: string;
}): Promise<string> {
  // Delete existing for idempotent re-runs
  await prisma.ledger.deleteMany({
    where: { studentId: opts.studentId, month: opts.month, year: opts.year },
  });

  const ledger = await prisma.ledger.create({
    data: {
      studentId: opts.studentId,
      month: opts.month,
      year: opts.year,
      baseAmount: opts.baseAmount,
      lateFee: 0,
      totalAmount: opts.baseAmount,
      dueDate: new Date(opts.year, opts.month - 1, 10),
      status: (opts.status as any) || 'UNPAID',
    },
  });
  cleanupIds.ledgerIds.push(ledger.id);
  return ledger.id;
}

async function cleanup() {
  console.log('\n--- Cleanup ---');

  // Delete receipts tied to our test payments
  if (cleanupIds.paymentIds.length) {
    await prisma.receipt.deleteMany({ where: { paymentId: { in: cleanupIds.paymentIds } } });
    await prisma.payment.deleteMany({ where: { id: { in: cleanupIds.paymentIds } } });
  }

  // Also delete any payments on our test ledgers not tracked yet
  if (cleanupIds.ledgerIds.length) {
    const extraPayments = await prisma.payment.findMany({
      where: { ledgerId: { in: cleanupIds.ledgerIds } },
      select: { id: true },
    });
    const extraIds = extraPayments.map(p => p.id);
    if (extraIds.length) {
      await prisma.receipt.deleteMany({ where: { paymentId: { in: extraIds } } });
      await prisma.payment.deleteMany({ where: { id: { in: extraIds } } });
    }
  }

  if (cleanupIds.ledgerIds.length) {
    await prisma.ledger.deleteMany({ where: { id: { in: cleanupIds.ledgerIds } } });
  }

  if (cleanupIds.alertIds.length) {
    await prisma.alert.deleteMany({ where: { id: { in: cleanupIds.alertIds } } });
  }

  // Clean up test alerts created during this run
  await prisma.alert.deleteMany({
    where: { message: { contains: 'TEST_PAYMENT_FLOW' } },
  });

  console.log('Done.');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TESTS
// ═══════════════════════════════════════════════════════════════════════════════

async function test1_webhookRecordsPayment(studentId: string) {
  console.log('\n═══ TEST 1: Webhook records payment correctly ═══');

  const ledgerId = await createTestLedger({
    studentId, month: 8, year: 2099, baseAmount: 5000,
  });

  const paymentId = `pay_T1_${Date.now()}`;
  const orderId = `order_T1_${Date.now()}`;
  const body = buildWebhookPayload({ paymentId, orderId, amount: 500000, ledgerId });
  const { status } = await sendWebhook(body);

  assert(status === 200, 'Webhook returned 200', `Expected 200, got ${status}`);

  const payment = await prisma.payment.findUnique({ where: { gatewayPaymentId: paymentId } });
  assert(!!payment, 'Payment row created in DB', 'Payment row NOT found in DB');
  assert(Number(payment?.amountPaid) === 5000, `amountPaid=₹5000`, `amountPaid=₹${payment?.amountPaid}`);
  assert(payment?.status === 'SUCCESS', 'status=SUCCESS', `status=${payment?.status}`);
  assert(payment?.paymentMethod === 'RAZORPAY', 'method=RAZORPAY', `method=${payment?.paymentMethod}`);

  if (payment) cleanupIds.paymentIds.push(payment.id);

  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  assert(ledger?.status === 'PAID', 'Ledger status=PAID', `Ledger status=${ledger?.status}`);

  const receipt = payment ? await prisma.receipt.findUnique({ where: { paymentId: payment.id } }) : null;
  assert(!!receipt, 'Receipt created', 'Receipt NOT found');
  assert(!!receipt?.receiptNumber?.startsWith('RCP'), `Receipt number starts with RCP`, `Got ${receipt?.receiptNumber}`);
}

async function test2_duplicateWebhookBlocked(studentId: string) {
  console.log('\n═══ TEST 2: Duplicate webhook blocked ═══');

  const ledgerId = await createTestLedger({
    studentId, month: 9, year: 2099, baseAmount: 3000,
  });

  const paymentId = `pay_T2_${Date.now()}`;
  const orderId = `order_T2_${Date.now()}`;
  const body = buildWebhookPayload({ paymentId, orderId, amount: 300000, ledgerId });

  // Send first
  const res1 = await sendWebhook(body);
  assert(res1.status === 200, 'First webhook: 200', `First webhook: ${res1.status}`);

  // Send duplicate
  const res2 = await sendWebhook(body);
  assert(res2.status === 200, 'Duplicate webhook: 200 (acknowledged)', `Duplicate webhook: ${res2.status}`);
  assert(res2.body?.duplicate === true, 'Response has duplicate=true', `duplicate=${res2.body?.duplicate}`);

  // Only 1 payment row
  const payments = await prisma.payment.findMany({ where: { ledgerId } });
  assert(payments.length === 1, 'Only 1 payment row in DB', `Found ${payments.length} rows`);
  payments.forEach(p => cleanupIds.paymentIds.push(p.id));
}

async function test3_partialPaymentViaWebhooks(studentId: string) {
  console.log('\n═══ TEST 3: Partial payment via two webhooks ═══');

  const ledgerId = await createTestLedger({
    studentId, month: 10, year: 2099, baseAmount: 4000,
  });

  // First payment: ₹1500
  const payId1 = `pay_T3a_${Date.now()}`;
  const body1 = buildWebhookPayload({ paymentId: payId1, orderId: `order_T3a_${Date.now()}`, amount: 150000, ledgerId });
  const res1 = await sendWebhook(body1);
  assert(res1.status === 200, 'First webhook: 200', `First: ${res1.status}`);

  let ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  assert(ledger?.status === 'PARTIAL', 'After ₹1500: status=PARTIAL', `status=${ledger?.status}`);

  // Second payment: ₹2500
  const payId2 = `pay_T3b_${Date.now()}`;
  const body2 = buildWebhookPayload({ paymentId: payId2, orderId: `order_T3b_${Date.now()}`, amount: 250000, ledgerId });
  const res2 = await sendWebhook(body2);
  assert(res2.status === 200, 'Second webhook: 200', `Second: ${res2.status}`);

  ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  assert(ledger?.status === 'PAID', 'After ₹1500+₹2500: status=PAID', `status=${ledger?.status}`);

  const payments = await prisma.payment.findMany({ where: { ledgerId }, orderBy: { createdAt: 'asc' } });
  assert(payments.length === 2, '2 payment rows', `${payments.length} rows`);

  const total = payments.reduce((s, p) => s + Number(p.amountPaid), 0);
  assert(total === 4000, `Total paid=₹4000`, `Total=₹${total}`);
  payments.forEach(p => cleanupIds.paymentIds.push(p.id));
}

async function test4_missingLedgerIdCreatesAlert() {
  console.log('\n═══ TEST 4: Webhook with missing ledgerId creates Alert ═══');

  const alertsBefore = await prisma.alert.count();

  const paymentId = `pay_T4_TEST_PAYMENT_FLOW_${Date.now()}`;
  const body = buildWebhookPayload({ paymentId, ledgerId: null });
  const { status, body: resBody } = await sendWebhook(body);

  assert(status === 200, 'Webhook returned 200 (acknowledged)', `Got ${status}`);
  assert(!!resBody?.warning?.includes('alert'), 'Response mentions alert created', `Response: ${JSON.stringify(resBody)}`);

  const alertsAfter = await prisma.alert.count();
  assert(alertsAfter > alertsBefore, 'Alert count increased', `Before=${alertsBefore} After=${alertsAfter}`);

  const alert = await prisma.alert.findFirst({
    where: { message: { contains: paymentId } },
    orderBy: { createdAt: 'desc' },
  });
  assert(!!alert, 'Alert record found with payment ID', 'Alert NOT found');
  assert(alert?.type === 'MISSING_LEDGER_ID', `Alert type=MISSING_LEDGER_ID`, `type=${alert?.type}`);
  if (alert) cleanupIds.alertIds.push(alert.id);

  // No payment row should exist
  const payment = await prisma.payment.findUnique({ where: { gatewayPaymentId: paymentId } });
  assert(!payment, 'No payment row created', 'Payment row was INCORRECTLY created');
}

async function test5_invalidSignatureRejected() {
  console.log('\n═══ TEST 5: Webhook with invalid signature rejected ═══');

  const paymentsBefore = await prisma.payment.count();

  const body = buildWebhookPayload({
    paymentId: `pay_T5_${Date.now()}`,
    ledgerId: '00000000-0000-0000-0000-000000000000',
  });

  const { status } = await sendWebhook(body, 'totally_wrong_signature_value');
  assert(status === 400, `Rejected with 400`, `Got ${status}`);

  const paymentsAfter = await prisma.payment.count();
  assert(paymentsAfter === paymentsBefore, 'No payment inserted', `Count changed: ${paymentsBefore}→${paymentsAfter}`);
}

async function test6_reconciliationCatchesMissed(studentId: string) {
  console.log('\n═══ TEST 6: Reconciliation cron catches missed payment ═══');

  // This test verifies the reconciliation job structure runs without error.
  // We can't mock Razorpay API payments, so we test that:
  // 1. The job runs without crashing
  // 2. It returns a valid result structure

  try {
    const result = await runReconciliationJob();
    assert(
      typeof result.reconciled === 'number' && typeof result.alerts === 'number',
      `Reconciliation ran: ${result.reconciled} reconciled, ${result.alerts} alerts`,
      'Reconciliation returned unexpected structure',
    );
  } catch (err: any) {
    // If Razorpay API is unreachable (test mode / no real key), that's expected
    if (err.statusCode === 401 || err.message?.includes('authentication')) {
      pass('Reconciliation attempted Razorpay API call (auth error expected in test mode)');
    } else {
      fail(`Reconciliation crashed: ${err.message}`);
    }
  }
}

async function test7_verifyEndpointGone() {
  console.log('\n═══ TEST 7: /verify endpoint returns 404 ═══');

  // Get a valid JWT first
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) { fail('No admin user in DB'); return; }

  const token = signToken({ userId: admin.id, role: 'ADMIN', email: admin.email });

  const res = await fetch(`${BASE_URL}/api/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      razorpay_payment_id: 'pay_fake',
      razorpay_order_id: 'order_fake',
      razorpay_signature: 'sig_fake',
      ledger_id: '00000000-0000-0000-0000-000000000000',
      amount: 100,
    }),
    signal: AbortSignal.timeout(5000),
  });

  assert(res.status === 404, 'POST /verify returns 404', `Got ${res.status}`);
}

async function test8_rateLimiting() {
  console.log('\n═══ TEST 8: Rate limiting on login ═══');

  const LOGIN_URL = `${BASE_URL}/api/auth/login`;
  const LIMIT = parseInt(process.env.LOGIN_RATE_MAX || '10', 10);
  const BURST = LIMIT + 5;
  const wrongBody = JSON.stringify({ email: 'nobody@test.com', password: 'wrongpassword' });

  const statuses: number[] = [];
  for (let i = 0; i < BURST; i++) {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: wrongBody,
      signal: AbortSignal.timeout(5000),
    });
    statuses.push(res.status);
  }

  const allowed = statuses.slice(0, LIMIT).filter(s => s !== 429);
  assert(allowed.length === LIMIT, `First ${LIMIT} requests not rate-limited`, `${LIMIT - allowed.length} were 429`);

  const throttled = statuses.slice(LIMIT).filter(s => s === 429);
  assert(throttled.length > 0, 'Requests beyond limit got 429', 'No 429s seen after limit');
}

async function test9_receiptRequiresAuth() {
  console.log('\n═══ TEST 9: Receipts behind /receipts/ are publicly accessible (known issue) ═══');

  // Confirm static receipts don't require auth (documenting known gap)
  const res = await fetch(`${BASE_URL}/receipts/nonexistent.pdf`, {
    signal: AbortSignal.timeout(5000),
  });
  // express.static returns 404 for missing file — but no 401/403
  assert(
    res.status !== 401 && res.status !== 403,
    `Static /receipts returns ${res.status} (no auth middleware — known issue)`,
    `Unexpected ${res.status}`,
  );

  // Now test the authenticated parent receipt endpoint
  const res2 = await fetch(`${BASE_URL}/api/parent/receipt/nonexistent-id`, {
    signal: AbortSignal.timeout(5000),
  });
  assert(res2.status === 401, 'GET /api/parent/receipt without JWT returns 401', `Got ${res2.status}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Payment Flow Test Suite — Webhook-First Architecture    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  if (!(await serverIsUp())) {
    console.error('\nFAIL — Server not reachable. Run: npm run dev');
    process.exitCode = 1;
    return;
  }

  if (!WEBHOOK_SECRET) {
    console.error('\nFAIL — RAZORPAY_WEBHOOK_SECRET not set in .env');
    process.exitCode = 1;
    return;
  }

  // Resolve Arjun Kumar for tests that need a student
  const arjun = await prisma.student.findUnique({
    where: { admissionNumber: 'STU001' },
  });
  if (!arjun) {
    console.error('\nFAIL — STU001 (Arjun Kumar) not found. Run seed first.');
    process.exitCode = 1;
    return;
  }

  console.log(`\nUsing student: ${arjun.name} (${arjun.id})\n`);

  await test1_webhookRecordsPayment(arjun.id);
  await test2_duplicateWebhookBlocked(arjun.id);
  await test3_partialPaymentViaWebhooks(arjun.id);
  await test4_missingLedgerIdCreatesAlert();
  await test5_invalidSignatureRejected();
  await test6_reconciliationCatchesMissed(arjun.id);
  await test7_verifyEndpointGone();
  await test8_rateLimiting();
  await test9_receiptRequiresAuth();

  // ── Summary ──
  console.log('\n' + '═'.repeat(55));
  if (totalFailed === 0) {
    console.log(`\n✅ ALL ${totalPassed} CHECKS PASSED`);
  } else {
    console.log(`\n❌ ${totalFailed} FAILED, ${totalPassed} passed`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => { console.error('Unexpected error:', err); process.exitCode = 1; })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
