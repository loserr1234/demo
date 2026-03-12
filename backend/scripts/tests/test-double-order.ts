/**
 * Test: Two simultaneous /create-order calls for same ledger → only 1 Razorpay order
 *
 * Sends two POST /api/payments/create-order requests in parallel for the
 * same UNPAID ledger and asserts both return the same orderId (no double charge).
 */

import 'dotenv/config';
import prisma from '../../src/config/prisma';
import { signToken } from '../../src/utils/jwt';

const BASE_URL = `http://localhost:${process.env.PORT || 5001}`;

let testLedgerId: string | null = null;

async function main() {
  console.log('=== Double Order Prevention Test ===\n');

  // Health check
  try {
    const h = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!h.ok) throw new Error();
  } catch {
    console.error('FAIL — Server not reachable');
    process.exitCode = 1;
    return;
  }

  // Find a parent with a student
  const parent = await prisma.user.findFirst({
    where: { role: 'PARENT' },
    include: { students: true },
  });

  if (!parent || !parent.students.length) {
    console.error('FAIL — No parent with students found');
    process.exitCode = 1;
    return;
  }

  const student = parent.students[0];
  const token = signToken({ userId: parent.id, role: 'PARENT', email: parent.email });

  // Create a fresh UNPAID ledger for testing
  await prisma.ledger.deleteMany({
    where: { studentId: student.id, month: 12, year: 2098 },
  });

  const ledger = await prisma.ledger.create({
    data: {
      studentId: student.id,
      month: 12,
      year: 2098,
      baseAmount: 5000,
      lateFee: 0,
      totalAmount: 5000,
      dueDate: new Date(2098, 11, 10),
      status: 'UNPAID',
    },
  });
  testLedgerId = ledger.id;

  console.log(`Parent:  ${parent.email}`);
  console.log(`Student: ${student.name}`);
  console.log(`Ledger:  ${ledger.id} (₹5000, UNPAID)\n`);

  // Fire 2 simultaneous create-order requests
  console.log('Step 1 — Sending 2 simultaneous POST /api/payments/create-order...');

  const makeRequest = () =>
    fetch(`${BASE_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ledgerId: ledger.id }),
      signal: AbortSignal.timeout(30000),
    });

  const [res1, res2] = await Promise.all([makeRequest(), makeRequest()]);

  const body1 = (await res1.json()) as any;
  const body2 = (await res2.json()) as any;

  console.log(`  Request 1: HTTP ${res1.status} → orderId=${body1?.data?.orderId || 'N/A'}`);
  console.log(`  Request 2: HTTP ${res2.status} → orderId=${body2?.data?.orderId || 'N/A'}`);

  // Both should succeed
  if (res1.status !== 200 || res2.status !== 200) {
    console.error(`\nFAIL — Expected both to return 200, got ${res1.status} and ${res2.status}`);
    process.exitCode = 1;
    return;
  }

  const orderId1 = body1.data.orderId;
  const orderId2 = body2.data.orderId;

  // The key assertion: same orderId
  console.log(`\nStep 2 — Comparing orderIds...`);

  if (orderId1 === orderId2) {
    console.log(`  ✓ Both requests returned the SAME orderId: ${orderId1}`);
    console.log(`  ✓ Only 1 Razorpay order was created`);
  } else {
    console.error(`  ✗ DIFFERENT orderIds returned!`);
    console.error(`    orderId1: ${orderId1}`);
    console.error(`    orderId2: ${orderId2}`);
    console.error(`\nFAIL — Double order created. Race condition not prevented.`);
    process.exitCode = 1;
    return;
  }

  // Verify ledger has pending order stored
  console.log(`\nStep 3 — Verifying ledger has pendingOrderId stored...`);
  const updatedLedger = await prisma.ledger.findUnique({ where: { id: ledger.id } });

  if (updatedLedger?.pendingOrderId === orderId1) {
    console.log(`  ✓ ledger.pendingOrderId = ${updatedLedger?.pendingOrderId}`);
    console.log(`  ✓ ledger.pendingOrderCreatedAt = ${updatedLedger?.pendingOrderCreatedAt}`);
  } else {
    console.error(`  ✗ pendingOrderId mismatch: ${updatedLedger?.pendingOrderId} vs ${orderId1}`);
    process.exitCode = 1;
    return;
  }

  // Fire a 3rd request — should still get the same order (within 10 min window)
  console.log(`\nStep 4 — Third request (should reuse same order)...`);
  const res3 = await makeRequest();
  const body3 = (await res3.json()) as any;
  const orderId3 = body3?.data?.orderId;
  console.log(`  Request 3: HTTP ${res3.status} → orderId=${orderId3}`);

  if (orderId3 === orderId1) {
    console.log(`  ✓ Third request also returned same orderId`);
  } else {
    console.error(`  ✗ Third request got DIFFERENT orderId: ${orderId3}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nPASS — All 3 requests returned the same Razorpay orderId. Double charge prevented.`);
}

main()
  .catch((err) => { console.error('Unexpected error:', err); process.exitCode = 1; })
  .finally(async () => {
    if (testLedgerId) {
      console.log('\n--- Cleanup ---');
      await prisma.payment.deleteMany({ where: { ledgerId: testLedgerId } });
      await prisma.ledger.delete({ where: { id: testLedgerId } }).catch(() => {});
      console.log('Done.');
    }
    await prisma.$disconnect();
  });
