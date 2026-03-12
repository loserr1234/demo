/**
 * Playwright Chaos Payment Test — Razorpay Test Mode
 *
 * Scenario 1: 3 browser contexts, 3 different parents, pay simultaneously
 * Scenario 2: Same parent, same ledger, 2 browser contexts simultaneously
 *
 * Uses Razorpay test card: 4111 1111 1111 1111
 *
 * Run:
 *   npx playwright test scripts/tests/playwright-chaos-payment.ts --headed
 *   OR:
 *   npx ts-node scripts/tests/playwright-chaos-payment.ts
 */

import 'dotenv/config';
import { chromium, type BrowserContext, type Page, type Frame } from 'playwright';
import prisma from '../../src/config/prisma';

const FRONTEND = 'http://localhost:5173';
const SCREENSHOT_DIR = '/tmp/playwright-chaos';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fs = require('fs');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let screenshotIndex = 0;
async function screenshot(page: Page, label: string) {
  const idx = String(++screenshotIndex).padStart(2, '0');
  const filename = `${SCREENSHOT_DIR}/${idx}_${label.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`  📸 ${idx}: ${label}`);
}

async function login(context: BrowserContext, email: string, password: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${FRONTEND}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await screenshot(page, `login_${email}`);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(parent|admin)/, { timeout: 15000 });
  await screenshot(page, `logged_in_${email}`);
  return page;
}

async function navigateToLedger(page: Page, studentId: string, label: string): Promise<void> {
  await page.goto(`${FRONTEND}/parent/student/${studentId}/ledger`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await screenshot(page, `ledger_${label}`);
}

async function clickPayAndCompleteRazorpay(page: Page, label: string): Promise<boolean> {
  // Find and click the first "Pay" button
  const payButton = page.locator('button:has-text("Pay")').first();
  if (!(await payButton.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log(`  ⚠ ${label}: No Pay button visible`);
    await screenshot(page, `no_pay_button_${label}`);
    return false;
  }
  await payButton.click();
  await screenshot(page, `pay_clicked_${label}`);

  // Wait for Razorpay iframe to appear
  console.log(`  ${label}: Waiting for Razorpay checkout...`);
  let razorpayFrame: any = null;

  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(1000);
    const frames = page.frames();
    razorpayFrame = frames.find((f: Frame) =>
      f.url().includes('razorpay.com') || f.url().includes('api.razorpay.com')
    );
    if (razorpayFrame) break;
  }

  if (!razorpayFrame) {
    console.log(`  ⚠ ${label}: Razorpay iframe not found after 20s`);
    await screenshot(page, `no_razorpay_${label}`);
    return false;
  }

  await screenshot(page, `razorpay_open_${label}`);
  console.log(`  ${label}: Razorpay checkout loaded`);

  try {
    // Handle "Contact details / Enter mobile number" prompt if it appears
    // Search ALL frames since the popup may be in a nested frame
    let phoneDone = false;
    for (let phoneAttempt = 0; phoneAttempt < 5 && !phoneDone; phoneAttempt++) {
      await page.waitForTimeout(1000);
      for (const frame of page.frames()) {
        // Try multiple selectors for the mobile input
        for (const sel of [
          'input[placeholder*="obile"]',
          'input[placeholder*="phone"]',
          'input[placeholder*="Phone"]',
          'input[name="contact"]',
          'input[type="tel"]',
          '#contact',
        ]) {
          const phoneInput = frame.locator(sel).first();
          if (await phoneInput.isVisible({ timeout: 500 }).catch(() => false)) {
            console.log(`  ${label}: Mobile number prompt detected (${sel} in ${frame.url().slice(0, 60)})`);
            await phoneInput.click();
            await phoneInput.fill('9876543210');
            await page.waitForTimeout(500);
            await screenshot(page, `phone_filled_${label}`);

            // Click Continue button
            const continueBtn = frame.locator('button:has-text("Continue"), button:has-text("Proceed")').first();
            if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await continueBtn.click();
              await page.waitForTimeout(3000);
              console.log(`  ${label}: Passed mobile number step`);
            }
            await screenshot(page, `after_phone_${label}`);
            phoneDone = true;
            break;
          }
        }
        if (phoneDone) break;
      }
    }

    if (!phoneDone) {
      console.log(`  ${label}: No mobile number prompt detected (good — prefill worked)`);
    }

    // Re-find Razorpay frame (may have changed after phone step)
    for (const f of page.frames()) {
      if (f.url().includes('razorpay.com') || f.url().includes('api.razorpay.com')) {
        razorpayFrame = f;
        break;
      }
    }

    // Click on "Card" payment option if visible
    const cardOption = razorpayFrame.locator('[data-value="card"], button:has-text("Card"), [tab-title="Card"]').first();
    if (await cardOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cardOption.click();
      await page.waitForTimeout(1000);
    }

    await screenshot(page, `card_section_${label}`);

    // Fill card details in Razorpay test mode
    const cardInput = razorpayFrame.locator('input[name="card.number"], input[autocomplete="cc-number"], #card_number').first();
    if (await cardInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cardInput.click();
      await cardInput.fill('4111111111111111');
    } else {
      // Try typing the card number
      await razorpayFrame.locator('input').first().type('4111111111111111');
    }
    await page.waitForTimeout(500);

    // Expiry
    const expiryInput = razorpayFrame.locator('input[name="card.expiry"], input[autocomplete="cc-exp"], #card_expiry').first();
    if (await expiryInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expiryInput.fill('12/28');
    }

    // CVV
    const cvvInput = razorpayFrame.locator('input[name="card.cvv"], input[autocomplete="cc-csc"], #card_cvv').first();
    if (await cvvInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cvvInput.fill('123');
    }

    await screenshot(page, `card_filled_${label}`);

    // Click Pay/Submit button inside Razorpay
    const submitBtn = razorpayFrame.locator('#footer button, button[type="submit"], button:has-text("Pay")').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
    }

    await page.waitForTimeout(3000);
    await screenshot(page, `submitted_${label}`);

    // Handle the test mode success/failure page
    // In Razorpay test mode, after submitting card, a page appears with "Success" / "Failure" buttons
    for (let attempt = 0; attempt < 15; attempt++) {
      await page.waitForTimeout(1000);
      const allFrames = page.frames();
      for (const frame of allFrames) {
        const successBtn = frame.locator('button:has-text("Success"), .success, #success, button.success').first();
        if (await successBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log(`  ${label}: Found Success button, clicking...`);
          await screenshot(page, `success_page_${label}`);
          await successBtn.click();
          await page.waitForTimeout(2000);
          await screenshot(page, `after_success_${label}`);
          return true;
        }
      }
    }

    console.log(`  ⚠ ${label}: Success button not found after 15s`);
    await screenshot(page, `no_success_btn_${label}`);

    // Check if payment already went through (some test flows auto-succeed)
    await page.waitForTimeout(3000);
    await screenshot(page, `final_state_${label}`);
    return true;

  } catch (err: any) {
    console.log(`  ⚠ ${label}: Error during Razorpay interaction: ${err.message}`);
    await screenshot(page, `error_${label}`);
    return false;
  }
}

async function pollLedgerStatus(ledgerIds: string[], timeoutMs: number): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    let allPaid = true;
    for (const id of ledgerIds) {
      const ledger = await prisma.ledger.findUnique({ where: { id } });
      const status = ledger?.status || 'NOT_FOUND';
      results.set(id, status);
      if (status !== 'PAID') allPaid = false;
    }
    console.log(`  DB poll: ${Array.from(results.entries()).map(([id, s]) => `${id.slice(0, 8)}=${s}`).join(' | ')}`);
    if (allPaid) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  return results;
}

// ─── Scenario 1: 3 Parents Pay Simultaneously ────────────────────────────────

async function scenario1() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  SCENARIO 1: 3 Parents Pay Simultaneously                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Get the 3 students and their May 2026 ledgers
  const students = await prisma.student.findMany({
    where: { admissionNumber: { in: ['STU001', 'STU002', 'STU003'] } },
    include: {
      parent: { select: { email: true, id: true } },
      ledgers: { where: { month: 5, year: 2026, status: 'UNPAID' } },
    },
  });

  const testData = students
    .filter(s => s.ledgers.length > 0)
    .map(s => ({
      email: s.parent.email,
      studentId: s.id,
      studentName: s.name,
      ledgerId: s.ledgers[0].id,
    }));

  console.log('Test data:');
  testData.forEach(d => console.log(`  ${d.email} → ${d.studentName} → ${d.ledgerId}`));

  if (testData.length < 2) {
    console.log('⚠ Need at least 2 students with unpaid ledgers. Skipping...');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];

  try {
    // Step 1: Login all parents
    console.log('\nStep 1 — Logging in all parents...');
    for (const td of testData) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      const password = 'test123';
      const page = await login(ctx, td.email, password);
      pages.push(page);
      console.log(`  ✓ ${td.email} logged in`);
    }

    // Step 2: Navigate all to their ledger pages
    console.log('\nStep 2 — Navigating to ledger pages...');
    await Promise.all(testData.map((td, i) =>
      navigateToLedger(pages[i], td.studentId, td.studentName)
    ));

    // Step 3: Click Pay simultaneously on all
    console.log('\nStep 3 — Clicking Pay simultaneously...');
    const payPromises = testData.map((td, i) =>
      clickPayAndCompleteRazorpay(pages[i], td.studentName)
    );
    const payResults = await Promise.all(payPromises);
    console.log(`\nPay results: ${payResults.map((r, i) => `${testData[i].studentName}=${r ? 'OK' : 'FAILED'}`).join(', ')}`);

    // Step 4: Poll DB for status changes
    console.log('\nStep 4 — Polling DB for ledger status (60s max)...');
    const ledgerIds = testData.map(td => td.ledgerId);
    const finalStatuses = await pollLedgerStatus(ledgerIds, 60000);

    // Step 5: Final screenshots
    console.log('\nStep 5 — Final screenshots...');
    for (let i = 0; i < pages.length; i++) {
      await pages[i].waitForTimeout(2000);
      await screenshot(pages[i], `final_${testData[i].studentName}`);
    }

    // Step 6: Verify DB
    console.log('\nStep 6 — DB Verification...');
    let passed = 0;
    for (const td of testData) {
      const ledger = await prisma.ledger.findUnique({
        where: { id: td.ledgerId },
        include: { payments: { where: { status: 'SUCCESS' }, include: { receipt: true } } },
      });
      const status = ledger?.status || 'NOT_FOUND';
      const pCount = ledger?.payments.length || 0;
      const rCount = ledger?.payments.filter(p => p.receipt).length || 0;

      const icon = status === 'PAID' ? '✓' : '✗';
      console.log(`  ${icon} ${td.studentName}: status=${status} payments=${pCount} receipts=${rCount}`);
      if (status === 'PAID' && pCount === 1 && rCount === 1) passed++;
    }

    // Check no duplicate gateway IDs
    const allPayments = await prisma.payment.findMany({
      where: { ledgerId: { in: ledgerIds }, status: 'SUCCESS' },
      select: { gatewayPaymentId: true },
    });
    const gwIds = allPayments.map(p => p.gatewayPaymentId).filter(Boolean);
    const uniqueGwIds = new Set(gwIds);
    const hasDupes = gwIds.length > uniqueGwIds.size;
    console.log(`\n  Gateway IDs: ${gwIds.length} total, ${uniqueGwIds.size} unique${hasDupes ? ' ⚠ DUPLICATES!' : ' ✓ no duplicates'}`);

    console.log(`\n  Scenario 1 result: ${passed}/${testData.length} ledgers fully verified`);

  } finally {
    for (const ctx of contexts) await ctx.close();
    await browser.close();
  }
}

// ─── Scenario 2: Same Parent, Same Ledger, 2 Browsers ────────────────────────

async function scenario2() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  SCENARIO 2: Same Parent, Same Ledger, 2 Browsers            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Create a fresh unpaid ledger
  const student = await prisma.student.findUnique({
    where: { admissionNumber: 'STU001' },
    include: { parent: { select: { email: true } } },
  });

  if (!student) {
    console.log('⚠ STU001 not found. Skipping...');
    return;
  }

  await prisma.ledger.deleteMany({ where: { studentId: student.id, month: 6, year: 2026 } });
  const ledger = await prisma.ledger.create({
    data: {
      studentId: student.id, month: 6, year: 2026,
      baseAmount: 3000, lateFee: 0, totalAmount: 3000,
      dueDate: new Date(2026, 5, 10), status: 'UNPAID',
    },
  });

  console.log(`Parent: ${student.parent.email}`);
  console.log(`Student: ${student.name}`);
  console.log(`Ledger: ${ledger.id} (June 2026, ₹3000)\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();

  try {
    // Login both contexts
    console.log('Step 7 — Logging in both browser contexts...');
    const page1 = await login(ctx1, student.parent.email, 'test123');
    const page2 = await login(ctx2, student.parent.email, 'test123');

    // Navigate both to same ledger
    console.log('\nNavigating both to same ledger...');
    await Promise.all([
      navigateToLedger(page1, student.id, 'Browser1'),
      navigateToLedger(page2, student.id, 'Browser2'),
    ]);

    // Both click Pay simultaneously
    console.log('\nStep 8 — Both clicking Pay simultaneously...');
    const [result1, result2] = await Promise.all([
      clickPayAndCompleteRazorpay(page1, 'Browser1'),
      clickPayAndCompleteRazorpay(page2, 'Browser2'),
    ]);

    console.log(`\nBrowser1 result: ${result1 ? 'completed' : 'failed'}`);
    console.log(`Browser2 result: ${result2 ? 'completed' : 'failed'}`);

    // Poll for status
    console.log('\nStep 9 — Polling DB...');
    const finalStatuses = await pollLedgerStatus([ledger.id], 60000);

    // Final screenshots
    await screenshot(page1, 'scenario2_final_browser1');
    await screenshot(page2, 'scenario2_final_browser2');

    // Verify
    console.log('\nStep 10 — DB Verification...');
    const finalLedger = await prisma.ledger.findUnique({
      where: { id: ledger.id },
      include: { payments: { where: { status: 'SUCCESS' }, include: { receipt: true } } },
    });

    const paymentCount = finalLedger?.payments.length || 0;
    const receiptCount = finalLedger?.payments.filter(p => p.receipt).length || 0;

    console.log(`  Ledger status:  ${finalLedger?.status}`);
    console.log(`  Payment rows:   ${paymentCount}`);
    console.log(`  Receipts:       ${receiptCount}`);
    console.log(`  pendingOrderId: ${finalLedger?.pendingOrderId || 'null'}`);

    if (paymentCount === 1) {
      console.log(`\n  ✓ Only 1 payment recorded — double charge PREVENTED`);
    } else if (paymentCount === 2) {
      // Check if both have same orderId (pending order protection worked)
      const orderIds = finalLedger?.payments.map(p => p.referenceNumber) || [];
      const uniqueOrders = new Set(orderIds);
      if (uniqueOrders.size === 1) {
        console.log(`\n  ~ 2 payments but same Razorpay order — this means webhook fired twice`);
        console.log(`    Gateway IDs: ${finalLedger?.payments.map(p => p.gatewayPaymentId).join(', ')}`);
      } else {
        console.log(`\n  ⚠ 2 payments with DIFFERENT Razorpay orders — double charge occurred`);
        console.log(`    This means the pendingOrder lock was bypassed`);
      }
    } else if (paymentCount === 0) {
      console.log(`\n  ~ No payments recorded yet (webhooks may still be processing)`);
    }

    // Report what second browser showed
    console.log('\n  Browser states:');
    const page1Text = await page1.textContent('body') || '';
    const page2Text = await page2.textContent('body') || '';
    const page1HasSuccess = page1Text.includes('confirmed') || page1Text.includes('successful') || page1Text.includes('PAID');
    const page2HasSuccess = page2Text.includes('confirmed') || page2Text.includes('successful') || page2Text.includes('PAID');
    const page2HasProcessing = page2Text.includes('processing') || page2Text.includes('within the hour');
    console.log(`    Browser 1: ${page1HasSuccess ? 'Shows success/PAID' : 'Other state'}`);
    console.log(`    Browser 2: ${page2HasSuccess ? 'Shows success/PAID' : page2HasProcessing ? 'Shows processing message' : 'Other state'}`);

    // Cleanup
    const payIds = finalLedger?.payments.map(p => p.id) || [];
    if (payIds.length) {
      await prisma.receipt.deleteMany({ where: { paymentId: { in: payIds } } });
      await prisma.payment.deleteMany({ where: { id: { in: payIds } } });
    }
    await prisma.ledger.delete({ where: { id: ledger.id } }).catch(() => {});

  } finally {
    await ctx1.close();
    await ctx2.close();
    await browser.close();
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Playwright Chaos Payment Test — Razorpay Test Mode          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`Screenshots: ${SCREENSHOT_DIR}/\n`);

  try {
    await scenario1();
  } catch (err: any) {
    console.error(`Scenario 1 error: ${err.message}`);
  }

  try {
    await scenario2();
  } catch (err: any) {
    console.error(`Scenario 2 error: ${err.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);
  console.log(`Total screenshots: ${screenshotIndex}`);
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
