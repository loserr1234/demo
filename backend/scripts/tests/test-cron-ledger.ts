/**
 * Test: Monthly ledger cron job
 *
 * 1. Deletes any existing next-month ledger for Arjun Kumar (STU001)
 * 2. Calls runMonthlyLedgerJob() directly (no cron schedule)
 * 3. Confirms a new ledger exists for next month for every active student
 * 4. Confirms each ledger has status=UNPAID and amounts match fee structure
 * 5. Prints PASS or FAIL with reason
 *
 * Cleans up only the ledgers this test created (in the finally block).
 */

import 'dotenv/config';
import prisma from '../../src/config/prisma';
import { runMonthlyLedgerJob } from '../../src/jobs/ledger.job';

const now       = new Date();
const nextMonth = now.getMonth() === 11 ? 1                    : now.getMonth() + 2;
const nextYear  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();

const STU001_ADMISSION_NUMBER = 'STU001';

// Track IDs created by the job so we can clean up
const createdLedgerIds: string[] = [];

async function main() {
  console.log('=== Monthly Ledger Cron Job Test ===\n');
  console.log(`Target month : ${nextMonth}/${nextYear}`);

  // ── Step 1: Delete next-month ledger for Arjun Kumar (STU001) ──────────────
  console.log(`\nStep 1 — Deleting any existing ${nextMonth}/${nextYear} ledger for STU001...`);

  const arjun = await prisma.student.findUnique({
    where  : { admissionNumber: STU001_ADMISSION_NUMBER },
    select : { id: true, name: true, admissionNumber: true, class: true },
  });

  if (!arjun) {
    console.error(`FAIL — Student STU001 not found. Run \`npm run seed\` first.`);
    process.exitCode = 1;
    return;
  }

  const deleted = await prisma.ledger.deleteMany({
    where: { studentId: arjun.id, month: nextMonth, year: nextYear },
  });
  console.log(`  ${arjun.name} (${arjun.admissionNumber}): deleted ${deleted.count} existing ledger(s)`);

  // ── Step 2: Fetch all active students + fee structures ─────────────────────
  console.log('\nStep 2 — Fetching active students eligible for next month...');
  const firstDayNextMonth = new Date(nextYear, nextMonth - 1, 1);

  const students = await prisma.student.findMany({
    where  : { status: 'ACTIVE', admissionDate: { lte: firstDayNextMonth } },
    select : { id: true, name: true, admissionNumber: true, class: true },
  });

  if (students.length === 0) {
    console.error('FAIL — No active students found. Run `npm run seed` first.');
    process.exitCode = 1;
    return;
  }

  console.log(`  Found ${students.length} active student(s):`);
  students.forEach(s => console.log(`    • ${s.name} (${s.admissionNumber}) — Class ${s.class}`));

  const feeStructures = await prisma.feeStructure.findMany();
  const feeMap = new Map(feeStructures.map(f => [f.class, f]));

  // Snapshot ledger IDs that already exist before the job runs (so we know what
  // the job creates vs. what was already there)
  const preExistingIds = new Set(
    (await prisma.ledger.findMany({
      where  : { month: nextMonth, year: nextYear },
      select : { id: true },
    })).map(l => l.id)
  );

  // ── Step 3: Invoke the cron job function directly ──────────────────────────
  console.log(`\nStep 3 — Calling runMonthlyLedgerJob(${nextMonth}, ${nextYear}) directly...`);
  const createdCount = await runMonthlyLedgerJob(nextMonth, nextYear);
  console.log(`  Job reported ${createdCount} ledger(s) created`);

  // ── Step 4: Query all next-month ledgers ───────────────────────────────────
  console.log('\nStep 4 — Querying ledgers table for next month...');
  const ledgers = await prisma.ledger.findMany({
    where   : { month: nextMonth, year: nextYear },
    include : { student: { select: { name: true, admissionNumber: true, class: true } } },
    orderBy : { student: { admissionNumber: 'asc' } },
  });

  // Record newly-created IDs for cleanup
  ledgers
    .filter(l => !preExistingIds.has(l.id))
    .forEach(l => createdLedgerIds.push(l.id));

  console.log(`  Ledgers found: ${ledgers.length}`);
  ledgers.forEach(l =>
    console.log(
      `    • ${l.student.name} (${l.student.admissionNumber})` +
      `  status=${l.status}  base=₹${l.baseAmount}  late=₹${l.lateFee}  total=₹${l.totalAmount}` +
      `  due=${l.dueDate.toDateString()}`
    )
  );

  // ── Step 5: Assertions ─────────────────────────────────────────────────────
  console.log('\nStep 5 — Asserting...');
  let passed = true;

  // 5a. Every active student has exactly one ledger for next month
  const ledgerByStudentId = new Map(ledgers.map(l => [l.studentId, l]));

  for (const student of students) {
    if (!ledgerByStudentId.has(student.id)) {
      console.error(`  FAIL — No ledger found for ${student.name} (${student.admissionNumber})`);
      passed = false;
    }
  }

  if (passed) {
    console.log(`  ✓ All ${students.length} active student(s) have a ledger for ${nextMonth}/${nextYear}`);
  }

  // 5b. STU001 specifically has a ledger (confirms the job re-created it after deletion)
  const arjunLedger = ledgers.find(l => l.student.admissionNumber === STU001_ADMISSION_NUMBER);
  if (!arjunLedger) {
    console.error(`  FAIL — No ledger found for STU001 after running the job`);
    passed = false;
  } else {
    console.log(`  ✓ STU001 (${arjun.name}) ledger created by job`);
  }

  // 5c. Each ledger: status=UNPAID, lateFee=0, amounts match fee structure
  for (const ledger of ledgers) {
    const fee             = feeMap.get(ledger.student.class);
    const expectedBase    = Number(fee?.baseFee ?? 3000);
    const expectedDueDay  = fee?.dueDayOfMonth  ?? 10;
    const expectedDueDate = new Date(nextYear, nextMonth - 1, expectedDueDay);

    const label = `${ledger.student.name} (${ledger.student.admissionNumber})`;
    let rowOk = true;

    if (ledger.status !== 'UNPAID') {
      console.error(`  FAIL — ${label}: expected status=UNPAID, got ${ledger.status}`);
      rowOk = false;
    }
    if (Number(ledger.lateFee) !== 0) {
      console.error(`  FAIL — ${label}: expected lateFee=0, got ${ledger.lateFee}`);
      rowOk = false;
    }
    if (Number(ledger.baseAmount) !== expectedBase) {
      console.error(`  FAIL — ${label}: expected baseAmount=₹${expectedBase}, got ₹${ledger.baseAmount}`);
      rowOk = false;
    }
    if (Number(ledger.totalAmount) !== expectedBase) {
      console.error(`  FAIL — ${label}: expected totalAmount=₹${expectedBase}, got ₹${ledger.totalAmount}`);
      rowOk = false;
    }
    if (ledger.dueDate.getTime() !== expectedDueDate.getTime()) {
      console.error(`  FAIL — ${label}: expected dueDate=${expectedDueDate.toDateString()}, got ${ledger.dueDate.toDateString()}`);
      rowOk = false;
    }

    if (!rowOk) {
      passed = false;
    } else {
      console.log(`  ✓ ${label}: UNPAID  base=₹${ledger.baseAmount}  total=₹${ledger.totalAmount}  due=${ledger.dueDate.toDateString()}`);
    }
  }

  // 5d. Idempotency — second run must create 0 new ledgers
  console.log(`\n  → Idempotency check: running job again for ${nextMonth}/${nextYear}...`);
  const createdAgain = await runMonthlyLedgerJob(nextMonth, nextYear);
  if (createdAgain !== 0) {
    console.error(`  FAIL — Job created ${createdAgain} duplicate ledger(s) on second run`);
    passed = false;
  } else {
    console.log(`  ✓ Second run created 0 duplicates (idempotent)`);
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  if (passed) {
    console.log(
      `\nPASS — runMonthlyLedgerJob created ${createdCount} UNPAID ledger(s) for ${nextMonth}/${nextYear};` +
      ` all amounts match fee structures; job is idempotent.`
    );
  } else {
    console.error(`\nFAIL — One or more assertions failed (see above).`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => { console.error('Unexpected error:', err); process.exitCode = 1; })
  .finally(async () => {
    if (createdLedgerIds.length) {
      console.log('\n--- Cleaning up test ledgers ---');
      await prisma.ledger.deleteMany({ where: { id: { in: createdLedgerIds } } });
      console.log(`Deleted ${createdLedgerIds.length} ledger(s).`);
    }
    await prisma.$disconnect();
  });
