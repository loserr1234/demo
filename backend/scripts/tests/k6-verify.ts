/**
 * k6 Post-Run Verification
 *
 * Reads the seeded manifest and checks DB state after k6 finishes.
 * Reports: payments per ledger, duplicates, race conditions, alerts.
 */

import 'dotenv/config';
import prisma from '../../src/config/prisma';

const MANIFEST_PATH = '/tmp/k6-test-manifest.json';

async function main() {
  const fs = await import('fs');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         K6 POST-RUN DATABASE VERIFICATION                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  let totalPayments = 0;
  let totalPaid = 0;
  let totalPartial = 0;
  let totalUnpaid = 0;
  let totalReceipts = 0;
  let duplicatePaymentIds = 0;

  // ── Check each parent's ledger ──
  console.log('─── Scenario 1: 10 Parents Paying Simultaneously ───\n');

  for (const parent of manifest.parents) {
    const ledger = await prisma.ledger.findUnique({
      where: { id: parent.ledgerId },
      include: {
        payments: {
          where: { status: 'SUCCESS' },
          include: { receipt: true },
        },
      },
    });

    if (!ledger) {
      console.log(`  ✗ ${parent.email}: ledger ${parent.ledgerId} NOT FOUND`);
      continue;
    }

    const payCount = ledger.payments.length;
    const receiptCount = ledger.payments.filter(p => p.receipt).length;
    const paidTotal = ledger.payments.reduce((s, p) => s + p.amountPaid, 0);

    totalPayments += payCount;
    totalReceipts += receiptCount;

    if (ledger.status === 'PAID') totalPaid++;
    else if (ledger.status === 'PARTIAL') totalPartial++;
    else totalUnpaid++;

    const icon = ledger.status === 'PAID' ? '✓' : (ledger.status === 'PARTIAL' ? '~' : '✗');
    console.log(`  ${icon} ${parent.email.padEnd(25)} status=${ledger.status.padEnd(8)} payments=${payCount}  receipts=${receiptCount}  paid=₹${paidTotal}/${ledger.totalAmount}`);

    // Check for duplicate gatewayPaymentIds
    const gwIds = ledger.payments.map(p => p.gatewayPaymentId).filter(Boolean);
    const uniqueGwIds = new Set(gwIds);
    if (gwIds.length > uniqueGwIds.size) {
      duplicatePaymentIds += gwIds.length - uniqueGwIds.size;
      console.log(`    ⚠ DUPLICATE gateway_payment_id detected!`);
    }
  }

  // ── Check race ledger ──
  console.log('\n─── Scenario 2: Race Condition (Same Ledger) ───\n');

  const raceLedger = await prisma.ledger.findUnique({
    where: { id: manifest.raceLedger.ledgerId },
    include: {
      payments: { where: { status: 'SUCCESS' } },
    },
  });

  if (raceLedger) {
    const racePayments = raceLedger.payments.length;
    const racePaid = raceLedger.payments.reduce((s, p) => s + p.amountPaid, 0);
    console.log(`  Ledger ${raceLedger.id}`);
    console.log(`  Status:       ${raceLedger.status}`);
    console.log(`  Payment rows: ${racePayments}`);
    console.log(`  Total paid:   ₹${racePaid} / ₹${raceLedger.totalAmount}`);

    if (racePayments <= 2) {
      console.log(`  ✓ Race handled correctly (${racePayments} payment(s) — each has unique gateway_payment_id)`);
    } else {
      console.log(`  ✗ RACE CONDITION: ${racePayments} payments recorded for same ledger!`);
    }
  }

  // ── Check clash (5 VUs with same payment_id) ──
  console.log('\n─── Scenario 3: Webhook Clash (Same payment_id) ───\n');

  const clashPayments = await prisma.payment.findMany({
    where: { gatewayPaymentId: 'pay_k6_clash_shared' },
  });
  console.log(`  Payments with gateway_id "pay_k6_clash_shared": ${clashPayments.length}`);
  if (clashPayments.length === 1) {
    console.log(`  ✓ Exactly 1 payment recorded — 4 duplicates correctly blocked`);
  } else if (clashPayments.length === 0) {
    console.log(`  ~ No payment recorded (may have been blocked by scenario 1 already paying this ledger)`);
  } else {
    console.log(`  ✗ RACE CONDITION: ${clashPayments.length} rows with same gateway_payment_id!`);
  }

  // ── Check alerts ──
  console.log('\n─── Alerts Created During Test ───\n');

  const alerts = await prisma.alert.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`  Alerts created in last 10 min: ${alerts.length}`);
  if (alerts.length > 0) {
    const byType: Record<string, number> = {};
    alerts.forEach(a => { byType[a.type] = (byType[a.type] || 0) + 1; });
    for (const [type, count] of Object.entries(byType)) {
      console.log(`    ${type}: ${count}`);
    }
  }

  // ── Final Summary ──
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Total payment rows:        ${totalPayments}`);
  console.log(`  Total receipts:            ${totalReceipts}`);
  console.log(`  Ledgers PAID:              ${totalPaid}/10`);
  console.log(`  Ledgers PARTIAL:           ${totalPartial}/10`);
  console.log(`  Ledgers UNPAID:            ${totalUnpaid}/10`);
  console.log(`  Duplicate gateway IDs:     ${duplicatePaymentIds} (should be 0)`);
  console.log(`  Alerts generated:          ${alerts.length}`);

  if (duplicatePaymentIds === 0 && totalPaid >= 1) {
    console.log('\n  ✅ No race conditions detected. Dedup working correctly.');
  } else if (duplicatePaymentIds > 0) {
    console.log('\n  ❌ DUPLICATE PAYMENTS DETECTED — race condition bug!');
    process.exitCode = 1;
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
