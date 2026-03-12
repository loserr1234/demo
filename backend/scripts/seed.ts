/**
 * Seed script — wipes all data and inserts a rich test dataset.
 *
 * Run: npm run seed
 *
 * Covers:
 *  - 5 parents, 10 students (1 inactive), classes 5–10
 *  - Fee structures per class (₹2500–₹5000)
 *  - 3 months of ledger history per student
 *  - PAID / PARTIAL / UNPAID / WAIVED ledgers
 *  - Late fees on overdue ledgers
 *  - Payments via CASH, UPI, BANK, RAZORPAY
 *  - Failed payment records
 *  - Multiple payments on one ledger (partial → full)
 *  - Receipts for all successful payments
 *  - Audit log entries
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma';
import { generateReceiptPDF } from '../src/utils/receipt';

// ─── helpers ──────────────────────────────────────────────────────────────────

const now   = new Date();
const CY    = now.getFullYear();
const CM    = now.getMonth() + 1;   // 1-12

/** Return { month, year } for N months ago */
function monthAgo(n: number) {
  const d = new Date(CY, CM - 1 - n, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

/** Due date = 10th of given month/year */
function dueDate(month: number, year: number) {
  return new Date(year, month - 1, 10);
}

/** Payment date = 5th of given month/year */
function payDate(month: number, year: number) {
  return new Date(year, month - 1, 5);
}

let rcpSeq = 1;
function nextReceiptNumber() {
  const seq = String(rcpSeq++).padStart(4, '0');
  return `RCP${CY}${String(CM).padStart(2, '0')}${seq}`;
}

async function makePaymentWithReceipt(opts: {
  ledgerId: string;
  amount: number;
  method: 'CASH' | 'UPI' | 'BANK' | 'RAZORPAY';
  source?: 'MANUAL' | 'ONLINE';
  date: Date;
  status?: 'SUCCESS' | 'FAILED';
  referenceNumber?: string;
  gatewayPaymentId?: string;
  studentName: string;
  admissionNumber: string;
  studentClass: string;
  section: string;
  month: number;
  year: number;
  withReceipt?: boolean;
}) {
  const status = opts.status ?? 'SUCCESS';
  const payment = await prisma.payment.create({
    data: {
      ledgerId        : opts.ledgerId,
      amountPaid      : opts.amount,
      paymentMethod   : opts.method,
      source          : opts.source ?? (opts.method === 'RAZORPAY' ? 'ONLINE' : 'MANUAL'),
      paymentDate     : opts.date,
      status,
      referenceNumber : opts.referenceNumber,
      gatewayPaymentId: opts.gatewayPaymentId,
    },
  });

  if (status === 'SUCCESS' && (opts.withReceipt !== false)) {
    const rcpNum = nextReceiptNumber();
    const rcpUrl = await generateReceiptPDF({
      receiptNumber  : rcpNum,
      paymentId      : payment.id,
      studentName    : opts.studentName,
      admissionNumber: opts.admissionNumber,
      class          : opts.studentClass,
      section        : opts.section,
      month          : opts.month,
      year           : opts.year,
      amount         : opts.amount,
      paymentDate    : opts.date,
      paymentMethod  : opts.method,
    });
    await prisma.receipt.create({
      data: { paymentId: payment.id, receiptNumber: rcpNum, receiptUrl: rcpUrl },
    });
    return { payment, receiptNumber: rcpNum };
  }

  return { payment, receiptNumber: null };
}

function printTable(rows: Record<string, string>[]) {
  if (!rows.length) return;
  const cols   = Object.keys(rows[0]);
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => (r[c] ?? '').length)));
  const sep    = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const header = '|' + cols.map((c, i) => ` ${c.padEnd(widths[i])} `).join('|') + '|';
  console.log(sep); console.log(header); console.log(sep);
  rows.forEach(r =>
    console.log('|' + cols.map((c, i) => ` ${(r[c] ?? '').padEnd(widths[i])} `).join('|') + '|')
  );
  console.log(sep);
}

// ─── clear ────────────────────────────────────────────────────────────────────

async function clearAll() {
  console.log('\n── Clearing existing data ──────────────────────────────────');
  const rc = await prisma.receipt.deleteMany();
  const pm = await prisma.payment.deleteMany();
  const ld = await prisma.ledger.deleteMany();
  const al = await prisma.auditLog.deleteMany();
  const st = await prisma.student.deleteMany();
  const fs = await prisma.feeStructure.deleteMany();
  const us = await prisma.user.deleteMany();
  const alerts = await prisma.alert.deleteMany();
  console.log(`  receipts=${rc.count} payments=${pm.count} ledgers=${ld.count} auditLogs=${al.count}`);
  console.log(`  students=${st.count} feeStructures=${fs.count} users=${us.count} alerts=${alerts.count}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║       Database Seed Script v2        ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Current month: ${CM}/${CY}\n`);

  await clearAll();

  // ── 1. Users ────────────────────────────────────────────────────────────────
  console.log('\n── Creating users ──────────────────────────────────────────');

  const [adminHash, parentHash] = await Promise.all([
    bcrypt.hash('admin@123', 12),
    bcrypt.hash('parent@123', 12),
  ]);

  const [admin, p1, p2, p3, p4, p5] = await Promise.all([
    prisma.user.create({ data: { name: 'Admin User',     email: 'admin@school.com',   passwordHash: adminHash,  role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'Ramesh Kumar',   email: 'parent1@test.com',   passwordHash: parentHash, role: 'PARENT', phone: '9876543210' } }),
    prisma.user.create({ data: { name: 'Sunita Singh',   email: 'parent2@test.com',   passwordHash: parentHash, role: 'PARENT', phone: '9876543211' } }),
    prisma.user.create({ data: { name: 'Arun Mehta',     email: 'parent3@test.com',   passwordHash: parentHash, role: 'PARENT', phone: '9876543212' } }),
    prisma.user.create({ data: { name: 'Kavitha Nair',   email: 'parent4@test.com',   passwordHash: parentHash, role: 'PARENT', phone: '9876543213' } }),
    prisma.user.create({ data: { name: 'Deepak Patel',   email: 'parent5@test.com',   passwordHash: parentHash, role: 'PARENT', phone: '9876543214' } }),
  ]);

  console.log(`  admin, parent1–parent5 created`);

  // ── 2. Fee structures ───────────────────────────────────────────────────────
  console.log('\n── Creating fee structures ─────────────────────────────────');

  const fees = await Promise.all([
    prisma.feeStructure.create({ data: { class: '5',  baseFee: 2500, lateFeeAmount: 100, dueDayOfMonth: 10 } }),
    prisma.feeStructure.create({ data: { class: '6',  baseFee: 2800, lateFeeAmount: 100, dueDayOfMonth: 10 } }),
    prisma.feeStructure.create({ data: { class: '7',  baseFee: 3000, lateFeeAmount: 150, dueDayOfMonth: 10 } }),
    prisma.feeStructure.create({ data: { class: '8',  baseFee: 3500, lateFeeAmount: 150, dueDayOfMonth: 10 } }),
    prisma.feeStructure.create({ data: { class: '9',  baseFee: 4000, lateFeeAmount: 200, dueDayOfMonth: 10 } }),
    prisma.feeStructure.create({ data: { class: '10', baseFee: 5000, lateFeeAmount: 200, dueDayOfMonth: 10 } }),
  ]);

  console.log(`  Classes 5–10 fee structures created`);

  // ── 3. Students ─────────────────────────────────────────────────────────────
  console.log('\n── Creating students ───────────────────────────────────────');

  const [arjun, priya, rahul, anjali, vikram, sneha, rohan, kavya, mohit, deepa] = await Promise.all([
    // parent1 (Ramesh) — 2 kids
    prisma.student.create({ data: { name: 'Arjun Kumar',    admissionNumber: 'STU001', class: '5',  section: 'A', parentId: p1.id, admissionDate: new Date('2022-06-01') } }),
    prisma.student.create({ data: { name: 'Priya Kumar',    admissionNumber: 'STU002', class: '8',  section: 'B', parentId: p1.id, admissionDate: new Date('2020-06-01') } }),
    // parent2 (Sunita) — 2 kids
    prisma.student.create({ data: { name: 'Rahul Singh',    admissionNumber: 'STU003', class: '7',  section: 'C', parentId: p2.id, admissionDate: new Date('2021-06-01') } }),
    prisma.student.create({ data: { name: 'Anjali Singh',   admissionNumber: 'STU004', class: '5',  section: 'B', parentId: p2.id, admissionDate: new Date('2022-06-01') } }),
    // parent3 (Arun) — 2 kids
    prisma.student.create({ data: { name: 'Vikram Mehta',   admissionNumber: 'STU005', class: '9',  section: 'A', parentId: p3.id, admissionDate: new Date('2019-06-01') } }),
    prisma.student.create({ data: { name: 'Sneha Mehta',    admissionNumber: 'STU006', class: '6',  section: 'A', parentId: p3.id, admissionDate: new Date('2022-06-01') } }),
    // parent4 (Kavitha) — 2 kids
    prisma.student.create({ data: { name: 'Rohan Nair',     admissionNumber: 'STU007', class: '10', section: 'A', parentId: p4.id, admissionDate: new Date('2018-06-01') } }),
    prisma.student.create({ data: { name: 'Kavya Nair',     admissionNumber: 'STU008', class: '6',  section: 'B', parentId: p4.id, admissionDate: new Date('2022-06-01'), status: 'INACTIVE' } }),
    // parent5 (Deepak) — 2 kids
    prisma.student.create({ data: { name: 'Mohit Patel',    admissionNumber: 'STU009', class: '9',  section: 'B', parentId: p5.id, admissionDate: new Date('2019-06-01') } }),
    prisma.student.create({ data: { name: 'Deepa Patel',    admissionNumber: 'STU010', class: '10', section: 'B', parentId: p5.id, admissionDate: new Date('2018-06-01') } }),
  ]);

  console.log(`  10 students created (1 inactive: Kavya Nair)`);

  // ── 4. Ledgers + Payments ───────────────────────────────────────────────────
  console.log('\n── Creating ledgers & payments ─────────────────────────────');

  const m0 = { month: CM,                   year: CY };                   // current month
  const m1 = monthAgo(1);                                                  // 1 month ago
  const m2 = monthAgo(2);                                                  // 2 months ago

  const summaryRows: Record<string, string>[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // ARJUN — Class 5A — ₹2500/mo
  //   m2: PAID (CASH)
  //   m1: PAID (UPI, two instalments)
  //   m0: UNPAID
  // ──────────────────────────────────────────────────────────────────────────
  {
    const base = 2500;
    const s = arjun;

    // m2 — full CASH payment
    const l2 = await prisma.ledger.create({ data: { studentId: s.id, ...m2, baseAmount: base, totalAmount: base, dueDate: dueDate(m2.month, m2.year), status: 'PAID' } });
    const { receiptNumber: r2 } = await makePaymentWithReceipt({ ledgerId: l2.id, amount: base, method: 'CASH', date: payDate(m2.month, m2.year), studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m2.month, year: m2.year });
    summaryRows.push({ student: s.name, period: `${m2.month}/${m2.year}`, status: 'PAID', paid: `₹${base}`, method: 'CASH', receipt: r2! });

    // m1 — two UPI instalments (1500 + 1000)
    const l1 = await prisma.ledger.create({ data: { studentId: s.id, ...m1, baseAmount: base, totalAmount: base, dueDate: dueDate(m1.month, m1.year), status: 'PAID' } });
    const { receiptNumber: r1a } = await makePaymentWithReceipt({ ledgerId: l1.id, amount: 1500, method: 'UPI', date: payDate(m1.month, m1.year), referenceNumber: 'UPI20260201001', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m1.month, year: m1.year });
    const { receiptNumber: r1b } = await makePaymentWithReceipt({ ledgerId: l1.id, amount: 1000, method: 'UPI', date: new Date(m1.year, m1.month - 1, 12), referenceNumber: 'UPI20260212001', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m1.month, year: m1.year });
    summaryRows.push({ student: s.name, period: `${m1.month}/${m1.year}`, status: 'PAID', paid: `₹${base}`, method: 'UPI×2', receipt: `${r1a!}, ${r1b!}` });

    // m0 — UNPAID
    await prisma.ledger.create({ data: { studentId: s.id, ...m0, baseAmount: base, totalAmount: base, dueDate: dueDate(m0.month, m0.year), status: 'UNPAID' } });
    summaryRows.push({ student: s.name, period: `${m0.month}/${m0.year}`, status: 'UNPAID', paid: '₹0', method: '—', receipt: '—' });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIYA — Class 8B — ₹3500/mo
  //   m2: PAID (BANK transfer)
  //   m1: PAID (Razorpay online)
  //   m0: PARTIAL (₹2000 of ₹3500 paid via UPI)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const base = 3500;
    const s = priya;

    // m2 — BANK transfer
    const l2 = await prisma.ledger.create({ data: { studentId: s.id, ...m2, baseAmount: base, totalAmount: base, dueDate: dueDate(m2.month, m2.year), status: 'PAID' } });
    const { receiptNumber: r2 } = await makePaymentWithReceipt({ ledgerId: l2.id, amount: base, method: 'BANK', date: payDate(m2.month, m2.year), referenceNumber: 'NEFT20260105', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m2.month, year: m2.year });
    summaryRows.push({ student: s.name, period: `${m2.month}/${m2.year}`, status: 'PAID', paid: `₹${base}`, method: 'BANK', receipt: r2! });

    // m1 — Razorpay (simulated)
    const l1 = await prisma.ledger.create({ data: { studentId: s.id, ...m1, baseAmount: base, totalAmount: base, dueDate: dueDate(m1.month, m1.year), status: 'PAID' } });
    const { receiptNumber: r1 } = await makePaymentWithReceipt({ ledgerId: l1.id, amount: base, method: 'RAZORPAY', source: 'ONLINE', date: payDate(m1.month, m1.year), gatewayPaymentId: 'pay_SEED_PRIYA_M1', referenceNumber: 'order_SEED_PRIYA_M1', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m1.month, year: m1.year });
    summaryRows.push({ student: s.name, period: `${m1.month}/${m1.year}`, status: 'PAID', paid: `₹${base}`, method: 'RAZORPAY', receipt: r1! });

    // m0 — PARTIAL: ₹2000 paid, ₹1500 remaining
    const l0 = await prisma.ledger.create({ data: { studentId: s.id, ...m0, baseAmount: base, totalAmount: base, dueDate: dueDate(m0.month, m0.year), status: 'PARTIAL' } });
    const { receiptNumber: r0 } = await makePaymentWithReceipt({ ledgerId: l0.id, amount: 2000, method: 'UPI', date: payDate(m0.month, m0.year), referenceNumber: 'UPI20260305001', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m0.month, year: m0.year });
    summaryRows.push({ student: s.name, period: `${m0.month}/${m0.year}`, status: 'PARTIAL', paid: '₹2000', method: 'UPI', receipt: r0! });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RAHUL — Class 7C — ₹3000/mo
  //   m2: PAID (CASH)
  //   m1: PAID (CASH) — had a FAILED attempt first
  //   m0: UNPAID (overdue — with late fee)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const base = 3000;
    const late = 150;
    const s = rahul;

    // m2 — CASH
    const l2 = await prisma.ledger.create({ data: { studentId: s.id, ...m2, baseAmount: base, totalAmount: base, dueDate: dueDate(m2.month, m2.year), status: 'PAID' } });
    const { receiptNumber: r2 } = await makePaymentWithReceipt({ ledgerId: l2.id, amount: base, method: 'CASH', date: payDate(m2.month, m2.year), studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m2.month, year: m2.year });
    summaryRows.push({ student: s.name, period: `${m2.month}/${m2.year}`, status: 'PAID', paid: `₹${base}`, method: 'CASH', receipt: r2! });

    // m1 — failed Razorpay attempt, then CASH success
    const l1 = await prisma.ledger.create({ data: { studentId: s.id, ...m1, baseAmount: base, totalAmount: base, dueDate: dueDate(m1.month, m1.year), status: 'PAID' } });
    await makePaymentWithReceipt({ ledgerId: l1.id, amount: base, method: 'RAZORPAY', source: 'ONLINE', date: new Date(m1.year, m1.month - 1, 8), gatewayPaymentId: 'pay_SEED_RAHUL_FAILED', status: 'FAILED', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m1.month, year: m1.year, withReceipt: false });
    const { receiptNumber: r1 } = await makePaymentWithReceipt({ ledgerId: l1.id, amount: base, method: 'CASH', date: new Date(m1.year, m1.month - 1, 9), studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m1.month, year: m1.year });
    summaryRows.push({ student: s.name, period: `${m1.month}/${m1.year}`, status: 'PAID', paid: `₹${base}`, method: 'CASH (failed RZP first)', receipt: r1! });

    // m0 — UNPAID with late fee (past due)
    await prisma.ledger.create({ data: { studentId: s.id, ...m0, baseAmount: base, lateFee: late, totalAmount: base + late, dueDate: dueDate(m0.month, m0.year), status: 'UNPAID' } });
    summaryRows.push({ student: s.name, period: `${m0.month}/${m0.year}`, status: 'UNPAID+LATE', paid: '₹0', method: '—', receipt: '—' });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ANJALI — Class 5B — ₹2500/mo
  //   m2: PAID (UPI)
  //   m1: WAIVED
  //   m0: UNPAID
  // ──────────────────────────────────────────────────────────────────────────
  {
    const base = 2500;
    const s = anjali;

    const l2 = await prisma.ledger.create({ data: { studentId: s.id, ...m2, baseAmount: base, totalAmount: base, dueDate: dueDate(m2.month, m2.year), status: 'PAID' } });
    const { receiptNumber: r2 } = await makePaymentWithReceipt({ ledgerId: l2.id, amount: base, method: 'UPI', date: payDate(m2.month, m2.year), referenceNumber: 'UPI20260105002', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m2.month, year: m2.year });
    summaryRows.push({ student: s.name, period: `${m2.month}/${m2.year}`, status: 'PAID', paid: `₹${base}`, method: 'UPI', receipt: r2! });

    await prisma.ledger.create({ data: { studentId: s.id, ...m1, baseAmount: base, totalAmount: base, dueDate: dueDate(m1.month, m1.year), status: 'WAIVED' } });
    summaryRows.push({ student: s.name, period: `${m1.month}/${m1.year}`, status: 'WAIVED', paid: '₹0', method: '—', receipt: '—' });

    await prisma.ledger.create({ data: { studentId: s.id, ...m0, baseAmount: base, totalAmount: base, dueDate: dueDate(m0.month, m0.year), status: 'UNPAID' } });
    summaryRows.push({ student: s.name, period: `${m0.month}/${m0.year}`, status: 'UNPAID', paid: '₹0', method: '—', receipt: '—' });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VIKRAM — Class 9A — ₹4000/mo
  //   m2: PAID (Razorpay)
  //   m1: PAID (Razorpay)
  //   m0: PAID (Razorpay)  — all online, good payer
  // ──────────────────────────────────────────────────────────────────────────
  {
    const base = 4000;
    const s = vikram;

    for (const [m, suffix] of [[m2, 'M2'], [m1, 'M1'], [m0, 'M0']] as const) {
      const l = await prisma.ledger.create({ data: { studentId: s.id, ...m, baseAmount: base, totalAmount: base, dueDate: dueDate(m.month, m.year), status: 'PAID' } });
      const { receiptNumber: r } = await makePaymentWithReceipt({ ledgerId: l.id, amount: base, method: 'RAZORPAY', source: 'ONLINE', date: payDate(m.month, m.year), gatewayPaymentId: `pay_SEED_VIKRAM_${suffix}`, referenceNumber: `order_SEED_VIKRAM_${suffix}`, studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m.month, year: m.year });
      summaryRows.push({ student: s.name, period: `${m.month}/${m.year}`, status: 'PAID', paid: `₹${base}`, method: 'RAZORPAY', receipt: r! });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SNEHA — Class 6A — ₹2800/mo
  //   m2: PAID (CASH)
  //   m1: PARTIAL (₹1500 of ₹2800)
  //   m0: UNPAID with late fee
  // ──────────────────────────────────────────────────────────────────────────
  {
    const base = 2800;
    const late = 100;
    const s = sneha;

    const l2 = await prisma.ledger.create({ data: { studentId: s.id, ...m2, baseAmount: base, totalAmount: base, dueDate: dueDate(m2.month, m2.year), status: 'PAID' } });
    const { receiptNumber: r2 } = await makePaymentWithReceipt({ ledgerId: l2.id, amount: base, method: 'CASH', date: payDate(m2.month, m2.year), studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m2.month, year: m2.year });
    summaryRows.push({ student: s.name, period: `${m2.month}/${m2.year}`, status: 'PAID', paid: `₹${base}`, method: 'CASH', receipt: r2! });

    const l1 = await prisma.ledger.create({ data: { studentId: s.id, ...m1, baseAmount: base, totalAmount: base, dueDate: dueDate(m1.month, m1.year), status: 'PARTIAL' } });
    const { receiptNumber: r1 } = await makePaymentWithReceipt({ ledgerId: l1.id, amount: 1500, method: 'CASH', date: payDate(m1.month, m1.year), studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m1.month, year: m1.year });
    summaryRows.push({ student: s.name, period: `${m1.month}/${m1.year}`, status: 'PARTIAL', paid: '₹1500', method: 'CASH', receipt: r1! });

    await prisma.ledger.create({ data: { studentId: s.id, ...m0, baseAmount: base, lateFee: late, totalAmount: base + late, dueDate: dueDate(m0.month, m0.year), status: 'UNPAID' } });
    summaryRows.push({ student: s.name, period: `${m0.month}/${m0.year}`, status: 'UNPAID+LATE', paid: '₹0', method: '—', receipt: '—' });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ROHAN — Class 10A — ₹5000/mo
  //   m2: PAID (BANK)
  //   m1: PAID (BANK)
  //   m0: PARTIAL (₹3000 of ₹5000, UPI)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const base = 5000;
    const s = rohan;

    const l2 = await prisma.ledger.create({ data: { studentId: s.id, ...m2, baseAmount: base, totalAmount: base, dueDate: dueDate(m2.month, m2.year), status: 'PAID' } });
    const { receiptNumber: r2 } = await makePaymentWithReceipt({ ledgerId: l2.id, amount: base, method: 'BANK', date: payDate(m2.month, m2.year), referenceNumber: 'NEFT20260105B', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m2.month, year: m2.year });
    summaryRows.push({ student: s.name, period: `${m2.month}/${m2.year}`, status: 'PAID', paid: `₹${base}`, method: 'BANK', receipt: r2! });

    const l1 = await prisma.ledger.create({ data: { studentId: s.id, ...m1, baseAmount: base, totalAmount: base, dueDate: dueDate(m1.month, m1.year), status: 'PAID' } });
    const { receiptNumber: r1 } = await makePaymentWithReceipt({ ledgerId: l1.id, amount: base, method: 'BANK', date: payDate(m1.month, m1.year), referenceNumber: 'NEFT20260205B', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m1.month, year: m1.year });
    summaryRows.push({ student: s.name, period: `${m1.month}/${m1.year}`, status: 'PAID', paid: `₹${base}`, method: 'BANK', receipt: r1! });

    const l0 = await prisma.ledger.create({ data: { studentId: s.id, ...m0, baseAmount: base, totalAmount: base, dueDate: dueDate(m0.month, m0.year), status: 'PARTIAL' } });
    const { receiptNumber: r0 } = await makePaymentWithReceipt({ ledgerId: l0.id, amount: 3000, method: 'UPI', date: payDate(m0.month, m0.year), referenceNumber: 'UPI20260305B', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m0.month, year: m0.year });
    summaryRows.push({ student: s.name, period: `${m0.month}/${m0.year}`, status: 'PARTIAL', paid: '₹3000', method: 'UPI', receipt: r0! });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // KAVYA (INACTIVE) — Class 6B — ₹2800/mo
  //   m2: PAID (last payment before going inactive)
  //   m1, m0: no ledgers (student inactive)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const base = 2800;
    const s = kavya;

    const l2 = await prisma.ledger.create({ data: { studentId: s.id, ...m2, baseAmount: base, totalAmount: base, dueDate: dueDate(m2.month, m2.year), status: 'PAID' } });
    const { receiptNumber: r2 } = await makePaymentWithReceipt({ ledgerId: l2.id, amount: base, method: 'CASH', date: payDate(m2.month, m2.year), studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m2.month, year: m2.year });
    summaryRows.push({ student: `${s.name} (INACTIVE)`, period: `${m2.month}/${m2.year}`, status: 'PAID', paid: `₹${base}`, method: 'CASH', receipt: r2! });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MOHIT — Class 9B — ₹4000/mo
  //   m2: PAID (Razorpay)
  //   m1: UNPAID (missed)
  //   m0: UNPAID (missed, with late fee)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const base = 4000;
    const late = 200;
    const s = mohit;

    const l2 = await prisma.ledger.create({ data: { studentId: s.id, ...m2, baseAmount: base, totalAmount: base, dueDate: dueDate(m2.month, m2.year), status: 'PAID' } });
    const { receiptNumber: r2 } = await makePaymentWithReceipt({ ledgerId: l2.id, amount: base, method: 'RAZORPAY', source: 'ONLINE', date: payDate(m2.month, m2.year), gatewayPaymentId: 'pay_SEED_MOHIT_M2', studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m2.month, year: m2.year });
    summaryRows.push({ student: s.name, period: `${m2.month}/${m2.year}`, status: 'PAID', paid: `₹${base}`, method: 'RAZORPAY', receipt: r2! });

    await prisma.ledger.create({ data: { studentId: s.id, ...m1, baseAmount: base, totalAmount: base, dueDate: dueDate(m1.month, m1.year), status: 'UNPAID' } });
    summaryRows.push({ student: s.name, period: `${m1.month}/${m1.year}`, status: 'UNPAID', paid: '₹0', method: '—', receipt: '—' });

    await prisma.ledger.create({ data: { studentId: s.id, ...m0, baseAmount: base, lateFee: late, totalAmount: base + late, dueDate: dueDate(m0.month, m0.year), status: 'UNPAID' } });
    summaryRows.push({ student: s.name, period: `${m0.month}/${m0.year}`, status: 'UNPAID+LATE', paid: '₹0', method: '—', receipt: '—' });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DEEPA — Class 10B — ₹5000/mo
  //   m2: PAID (BANK)
  //   m1: PAID (CASH)
  //   m0: PAID (UPI) — all paid up
  // ──────────────────────────────────────────────────────────────────────────
  {
    const base = 5000;
    const s = deepa;

    for (const [m, method, ref] of [[m2, 'BANK', 'NEFT20260105D'], [m1, 'CASH', undefined], [m0, 'UPI', 'UPI20260305D']] as const) {
      const l = await prisma.ledger.create({ data: { studentId: s.id, ...m, baseAmount: base, totalAmount: base, dueDate: dueDate(m.month, m.year), status: 'PAID' } });
      const { receiptNumber: r } = await makePaymentWithReceipt({ ledgerId: l.id, amount: base, method, date: payDate(m.month, m.year), referenceNumber: ref, studentName: s.name, admissionNumber: s.admissionNumber, studentClass: s.class, section: s.section, month: m.month, year: m.year });
      summaryRows.push({ student: s.name, period: `${m.month}/${m.year}`, status: 'PAID', paid: `₹${base}`, method, receipt: r! });
    }
  }

  // ── 5. Audit logs ───────────────────────────────────────────────────────────
  console.log('\n── Creating audit logs ─────────────────────────────────────');

  await prisma.auditLog.createMany({
    data: [
      {
        action: 'MANUAL_PAYMENT', entityType: 'PAYMENT', entityId: arjun.id,
        userId: admin.id, createdAt: new Date(m2.year, m2.month - 1, 5),
        newValue: { amount: 2500, method: 'CASH', student: 'Arjun Kumar' },
      },
      {
        action: 'MANUAL_PAYMENT', entityType: 'PAYMENT', entityId: rahul.id,
        userId: admin.id, createdAt: new Date(m1.year, m1.month - 1, 9),
        newValue: { amount: 3000, method: 'CASH', note: 'Replaced failed Razorpay attempt' },
      },
      {
        action: 'UPDATE_LEDGER', entityType: 'LEDGER', entityId: anjali.id,
        userId: admin.id, createdAt: new Date(m1.year, m1.month - 1, 3),
        oldValue: { status: 'UNPAID' },
        newValue: { status: 'WAIVED', reason: 'Merit scholarship' },
      },
      {
        action: 'STUDENT_STATUS_INACTIVE', entityType: 'STUDENT', entityId: kavya.id,
        userId: admin.id, createdAt: new Date(m1.year, m1.month - 1, 15),
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'INACTIVE', reason: 'Transfer to another school' },
      },
      {
        action: 'UPDATE_STUDENT', entityType: 'STUDENT', entityId: rohan.id,
        userId: admin.id, createdAt: new Date(m2.year, m2.month - 1, 1),
        oldValue: { class: '9', section: 'B' },
        newValue: { class: '10', section: 'A' },
      },
    ],
  });

  console.log(`  5 audit log entries created`);

  // ── 6. Summary ──────────────────────────────────────────────────────────────
  const paymentCount = await prisma.payment.count();
  const receiptCount = await prisma.receipt.count();
  const ledgerCount  = await prisma.ledger.count();

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║           Seed Complete ✓            ║');
  console.log('╚══════════════════════════════════════╝\n');

  console.log('CREDENTIALS');
  printTable([
    { role: 'ADMIN',  email: 'admin@school.com', password: 'admin@123' },
    { role: 'PARENT', email: 'parent1@test.com', password: 'parent@123', note: 'Arjun, Priya' },
    { role: 'PARENT', email: 'parent2@test.com', password: 'parent@123', note: 'Rahul, Anjali' },
    { role: 'PARENT', email: 'parent3@test.com', password: 'parent@123', note: 'Vikram, Sneha' },
    { role: 'PARENT', email: 'parent4@test.com', password: 'parent@123', note: 'Rohan, Kavya(inactive)' },
    { role: 'PARENT', email: 'parent5@test.com', password: 'parent@123', note: 'Mohit, Deepa' },
  ]);

  console.log('\nLEDGER & PAYMENT SUMMARY');
  printTable(summaryRows);

  console.log(`\nTOTALS`);
  console.log(`  ledgers  : ${ledgerCount}`);
  console.log(`  payments : ${paymentCount}`);
  console.log(`  receipts : ${receiptCount}`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
