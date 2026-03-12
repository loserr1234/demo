/**
 * Test: Duplicate webhook protection
 *
 * Calls processWebhookService twice with the same gateway_payment_id,
 * skipping HTTP + HMAC signature verification entirely (direct service call).
 * Confirms that the payments table still has only 1 row for this payment.
 */

import 'dotenv/config';
import { processWebhookService } from '../src/services/payment.service';
import prisma from '../src/config/prisma';

const GATEWAY_PAYMENT_ID = 'pay_SPVgxFASUkf9hz';
const ORDER_ID           = 'order_SPVgeaVHgVVaOM';
const LEDGER_ID          = '1cabc54a-6150-41a7-8b25-9e0937e49266';
const AMOUNT             = 310000; // paise

async function main() {
  console.log('=== Duplicate Webhook Protection Test ===\n');
  console.log(`gateway_payment_id : ${GATEWAY_PAYMENT_ID}`);
  console.log(`order_id           : ${ORDER_ID}`);
  console.log(`ledger_id          : ${LEDGER_ID}`);
  console.log(`amount (paise)     : ${AMOUNT}\n`);

  // --- First webhook call ---
  console.log('→ Sending webhook #1...');
  const result1 = await processWebhookService(GATEWAY_PAYMENT_ID, ORDER_ID, LEDGER_ID, AMOUNT);
  console.log('  Result:', JSON.stringify(result1, null, 4));

  // --- Second (duplicate) webhook call ---
  console.log('\n→ Sending webhook #2 (duplicate)...');
  const result2 = await processWebhookService(GATEWAY_PAYMENT_ID, ORDER_ID, LEDGER_ID, AMOUNT);
  console.log('  Result:', JSON.stringify(result2, null, 4));

  // --- Verify DB ---
  console.log('\n→ Querying payments table...');
  const rows = await prisma.payment.findMany({
    where: { gatewayPaymentId: GATEWAY_PAYMENT_ID },
    select: {
      id: true,
      gatewayPaymentId: true,
      amountPaid: true,
      status: true,
      createdAt: true,
    },
  });

  console.log(`\n  Rows with gateway_payment_id = '${GATEWAY_PAYMENT_ID}': ${rows.length}`);
  rows.forEach((r, i) => console.log(`  [${i + 1}]`, JSON.stringify(r, null, 6)));

  // --- Assert ---
  console.log('\n=== Result ===');
  if (rows.length === 1) {
    console.log('PASS — Only 1 row exists. Duplicate webhook was correctly suppressed.');
  } else {
    console.error(`FAIL — Expected 1 row but found ${rows.length}. Duplicate protection is broken!`);
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Unexpected error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
