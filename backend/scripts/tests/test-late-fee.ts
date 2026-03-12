/**
 * Test: Late fee application logic
 *
 * Replicates the exact query + update logic from startLateFeeJob() and runs it
 * against two isolated ledgers for Arjun Kumar (STU001):
 *
 *   Ledger A — last month, due date already passed  → late fee MUST be applied
 *   Ledger B — next month, due date in the future   → late fee MUST NOT be applied
 *
 * Cleans up both ledgers in a finally block.
 */

import 'dotenv/config';
import prisma from '../../src/config/prisma';

// ─── helpers ─────────────────────────────────────────────────────────────────

function pass(msg: string) { console.log(`\nPASS — ${msg}`); }
function fail(msg: string) { console.error(`\nFAIL — ${msg}`); process.exitCode = 1; }

/**
 * Mirrors the core of startLateFeeJob() exactly.
 * Finds UNPAID ledgers with lateFee=0 whose dueDate is before today
 * and zero payments, then applies the ₹100 late fee.
 *
 * Scoped to a specific ledger ID so tests don't accidentally affect real data.
 */
async function applyLateFees(ledgerId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueLedgers = await prisma.ledger.findMany({
    where: {
      id     : ledgerId,   // scoped to test ledger only
      status : 'UNPAID',
      lateFee: 0,
      dueDate: { lt: today },
    },
    include: {
      payments: { where: { status: 'SUCCESS' } },
    },
  });

  let updated = 0;
  for (const ledger of overdueLedgers) {
    const totalPaid = ledger.payments.reduce((s, p) => s + Number(p.amountPaid), 0);
    if (totalPaid === 0) {
      await prisma.ledger.update({
        where: { id: ledger.id },
        data : {
          lateFee    : 100,
          totalAmount: Number(ledger.baseAmount) + 100,
        },
      });
      updated++;
    }
  }

  return updated;
}

// ─── test data ───────────────────────────────────────────────────────────────

const now       = new Date();
const BASE_FEE  = 3000;
const LATE_FEE  = 100;

// Last month — due date is day 10, which has already passed
const lastMonth     = now.getMonth() === 0 ? 12 : now.getMonth();          // getMonth() is 0-based, so getMonth()=0 → Dec
const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
const pastDueDate   = new Date(lastMonthYear, lastMonth - 1, 10);          // day 10 of last month

// Next month — due date is day 28, which has not yet passed
const nextMonth     = now.getMonth() === 11 ? 1 : now.getMonth() + 2;     // getMonth()+2 because getMonth() is 0-based
const nextMonthYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
const futureDueDate = new Date(nextMonthYear, nextMonth - 1, 28);          // day 28 of next month

const createdIds: string[] = [];

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Late Fee Application Test ===\n');

  // Resolve Arjun Kumar (STU001)
  const arjun = await prisma.student.findUnique({
    where: { admissionNumber: 'STU001' },
    select: { id: true, name: true },
  });

  if (!arjun) {
    fail('Arjun Kumar (STU001) not found — run `npm run seed` first');
    return;
  }

  console.log(`Student : ${arjun.name} (${arjun.id})`);
  console.log(`Today   : ${now.toDateString()}\n`);

  // ── Ledger A: overdue ─────────────────────────────────────────────────────
  console.log('── Ledger A (overdue) ──────────────────────────────────────');
  console.log(`  month/year : ${lastMonth}/${lastMonthYear}`);
  console.log(`  due_date   : ${pastDueDate.toDateString()}  ← already passed`);

  // Guard: delete any pre-existing ledger for this month/year (re-run safety)
  await prisma.ledger.deleteMany({
    where: { studentId: arjun.id, month: lastMonth, year: lastMonthYear },
  });

  const ledgerA = await prisma.ledger.create({
    data: {
      studentId  : arjun.id,
      month      : lastMonth,
      year       : lastMonthYear,
      baseAmount : BASE_FEE,
      lateFee    : 0,
      totalAmount: BASE_FEE,
      dueDate    : pastDueDate,
      status     : 'UNPAID',
    },
  });
  createdIds.push(ledgerA.id);

  console.log(`  ledger_id  : ${ledgerA.id}`);
  console.log(`  base_fee   : ₹${ledgerA.baseAmount}`);
  console.log(`  late_fee   : ₹${ledgerA.lateFee} (before)`);
  console.log(`  total      : ₹${ledgerA.totalAmount} (before)`);

  console.log('\n  → Running late fee calculation...');
  const updatedA = await applyLateFees(ledgerA.id);
  const afterA   = await prisma.ledger.findUniqueOrThrow({ where: { id: ledgerA.id } });

  console.log(`  ledgers updated by job : ${updatedA}`);
  console.log(`  late_fee   : ₹${afterA.lateFee} (after)`);
  console.log(`  total      : ₹${afterA.totalAmount} (after)`);

  const expectedTotalA = BASE_FEE + LATE_FEE;

  if (Number(afterA.lateFee) !== LATE_FEE) {
    fail(`Ledger A: expected late_fee=₹${LATE_FEE}, got ₹${afterA.lateFee}`);
    return;
  }
  if (Number(afterA.totalAmount) !== expectedTotalA) {
    fail(`Ledger A: expected total=₹${expectedTotalA}, got ₹${afterA.totalAmount}`);
    return;
  }

  console.log(`  ✓ late_fee applied: ₹${BASE_FEE} + ₹${LATE_FEE} = ₹${afterA.totalAmount}`);

  // ── Ledger B: future due date ─────────────────────────────────────────────
  console.log('\n── Ledger B (future due date) ──────────────────────────────');
  console.log(`  month/year : ${nextMonth}/${nextMonthYear}`);
  console.log(`  due_date   : ${futureDueDate.toDateString()}  ← not yet passed`);

  // Guard: delete any pre-existing ledger for this month/year
  await prisma.ledger.deleteMany({
    where: { studentId: arjun.id, month: nextMonth, year: nextMonthYear },
  });

  const ledgerB = await prisma.ledger.create({
    data: {
      studentId  : arjun.id,
      month      : nextMonth,
      year       : nextMonthYear,
      baseAmount : BASE_FEE,
      lateFee    : 0,
      totalAmount: BASE_FEE,
      dueDate    : futureDueDate,
      status     : 'UNPAID',
    },
  });
  createdIds.push(ledgerB.id);

  console.log(`  ledger_id  : ${ledgerB.id}`);
  console.log(`  base_fee   : ₹${ledgerB.baseAmount}`);
  console.log(`  late_fee   : ₹${ledgerB.lateFee} (before)`);
  console.log(`  total      : ₹${ledgerB.totalAmount} (before)`);

  console.log('\n  → Running late fee calculation...');
  const updatedB = await applyLateFees(ledgerB.id);
  const afterB   = await prisma.ledger.findUniqueOrThrow({ where: { id: ledgerB.id } });

  console.log(`  ledgers updated by job : ${updatedB}`);
  console.log(`  late_fee   : ₹${afterB.lateFee} (after)`);
  console.log(`  total      : ₹${afterB.totalAmount} (after)`);

  if (Number(afterB.lateFee) !== 0) {
    fail(`Ledger B: expected late_fee=₹0, got ₹${afterB.lateFee}`);
    return;
  }
  if (Number(afterB.totalAmount) !== BASE_FEE) {
    fail(`Ledger B: expected total=₹${BASE_FEE} (no late fee), got ₹${afterB.totalAmount}`);
    return;
  }

  console.log(`  ✓ no late_fee: total remains ₹${afterB.totalAmount}`);

  // ── Result ────────────────────────────────────────────────────────────────
  pass(
    `Overdue ledger got late_fee=₹${LATE_FEE} → total=₹${afterA.totalAmount}. ` +
    `Future ledger kept late_fee=₹0 → total=₹${afterB.totalAmount}.`
  );
}

// ─── run ─────────────────────────────────────────────────────────────────────

main()
  .catch(async (err) => {
    console.error('Unexpected error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (createdIds.length) {
      console.log('\n--- Cleaning up test ledgers ---');
      await prisma.ledger.deleteMany({ where: { id: { in: createdIds } } });
      console.log(`Deleted ${createdIds.length} ledger(s): ${createdIds.join(', ')}`);
    }
    await prisma.$disconnect();
  });
