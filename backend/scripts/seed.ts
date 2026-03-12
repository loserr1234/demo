/**
 * Seed script — wipes all data and inserts a clean test dataset.
 *
 * Run: npm run seed
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma';
import { generateReceiptPDF } from '../src/utils/receipt';

const now   = new Date();
const MONTH = now.getMonth() + 1;   // current month (1-12)
const YEAR  = now.getFullYear();

// ─── helpers ─────────────────────────────────────────────────────────────────

const receiptNum = (suffix: string) =>
  `RCP${YEAR}${String(MONTH).padStart(2, '0')}${suffix}`;

function printTable(rows: Record<string, string>[]) {
  if (!rows.length) return;
  const cols    = Object.keys(rows[0]);
  const widths  = cols.map(c => Math.max(c.length, ...rows.map(r => (r[c] ?? '').length)));
  const sep     = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const header  = '|' + cols.map((c, i) => ` ${c.padEnd(widths[i])} `).join('|') + '|';
  console.log(sep);
  console.log(header);
  console.log(sep);
  rows.forEach(r =>
    console.log('|' + cols.map((c, i) => ` ${(r[c] ?? '').padEnd(widths[i])} `).join('|') + '|')
  );
  console.log(sep);
}

// ─── 1. Clear ────────────────────────────────────────────────────────────────

async function clearAll() {
  console.log('\n── Clearing existing data ──────────────────────────────────');
  // Must delete in FK-dependency order (child → parent)
  const rc = await prisma.receipt.deleteMany();
  const pm = await prisma.payment.deleteMany();
  const ld = await prisma.ledger.deleteMany();
  const al = await prisma.auditLog.deleteMany();
  const st = await prisma.student.deleteMany();
  const fs = await prisma.feeStructure.deleteMany();
  const us = await prisma.user.deleteMany();
  console.log(`  receipts       deleted: ${rc.count}`);
  console.log(`  payments       deleted: ${pm.count}`);
  console.log(`  ledgers        deleted: ${ld.count}`);
  console.log(`  audit_logs     deleted: ${al.count}`);
  console.log(`  students       deleted: ${st.count}`);
  console.log(`  fee_structures deleted: ${fs.count}`);
  console.log(`  users          deleted: ${us.count}`);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║          Database Seed Script        ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Seeding for month: ${MONTH}/${YEAR}\n`);

  await clearAll();

  // ── 2. Users ───────────────────────────────────────────────────────────────
  console.log('\n── Creating users ──────────────────────────────────────────');

  const [adminHash, parentHash] = await Promise.all([
    bcrypt.hash('admin123', 12),
    bcrypt.hash('test123', 12),
  ]);

  const [admin, parent1, parent2] = await Promise.all([
    prisma.user.create({
      data: { name: 'Admin User', email: 'admin@school.com', passwordHash: adminHash, role: 'ADMIN' },
    }),
    prisma.user.create({
      data: { name: 'Parent One', email: 'parent1@test.com', passwordHash: parentHash, role: 'PARENT' },
    }),
    prisma.user.create({
      data: { name: 'Parent Two', email: 'parent2@test.com', passwordHash: parentHash, role: 'PARENT' },
    }),
  ]);

  console.log(`  admin   : ${admin.email}`);
  console.log(`  parent1 : ${parent1.email}`);
  console.log(`  parent2 : ${parent2.email}`);

  // ── 3. Students ────────────────────────────────────────────────────────────
  console.log('\n── Creating students ───────────────────────────────────────');

  const [arjun, priya, rahul] = await Promise.all([
    prisma.student.create({
      data: {
        name: 'Arjun Kumar', admissionNumber: 'STU001',
        class: '5', section: 'A',
        parentId: parent1.id, admissionDate: new Date('2024-06-01'),
      },
    }),
    prisma.student.create({
      data: {
        name: 'Priya Sharma', admissionNumber: 'STU002',
        class: '6', section: 'B',
        parentId: parent1.id, admissionDate: new Date('2024-06-01'),
      },
    }),
    prisma.student.create({
      data: {
        name: 'Rahul Singh', admissionNumber: 'STU003',
        class: '7', section: 'C',
        parentId: parent2.id, admissionDate: new Date('2024-06-01'),
      },
    }),
  ]);

  console.log(`  STU001 Arjun Kumar  (Class 5A) → parent1`);
  console.log(`  STU002 Priya Sharma (Class 6B) → parent1`);
  console.log(`  STU003 Rahul Singh  (Class 7C) → parent2`);

  // ── 4. Fee structures ──────────────────────────────────────────────────────
  console.log('\n── Creating fee structures ─────────────────────────────────');

  const [fee5, fee6, fee7] = await Promise.all([
    prisma.feeStructure.create({ data: { class: '5', baseFee: 3000, lateFeeAmount: 100, dueDayOfMonth: 10 } }),
    prisma.feeStructure.create({ data: { class: '6', baseFee: 3000, lateFeeAmount: 100, dueDayOfMonth: 10 } }),
    prisma.feeStructure.create({ data: { class: '7', baseFee: 3000, lateFeeAmount: 100, dueDayOfMonth: 10 } }),
  ]);

  console.log(`  Class 5 : baseFee=₹${fee5.baseFee}  lateFee=₹${fee5.lateFeeAmount}  due=day ${fee5.dueDayOfMonth}`);
  console.log(`  Class 6 : baseFee=₹${fee6.baseFee}  lateFee=₹${fee6.lateFeeAmount}  due=day ${fee6.dueDayOfMonth}`);
  console.log(`  Class 7 : baseFee=₹${fee7.baseFee}  lateFee=₹${fee7.lateFeeAmount}  due=day ${fee7.dueDayOfMonth}`);

  // ── 5. Ledgers ─────────────────────────────────────────────────────────────
  console.log('\n── Creating ledgers ────────────────────────────────────────');

  const dueDate = new Date(YEAR, MONTH - 1, 10);

  // Arjun — UNPAID
  const arjunLedger = await prisma.ledger.create({
    data: {
      studentId: arjun.id, month: MONTH, year: YEAR,
      baseAmount: 3000, totalAmount: 3000, dueDate,
      status: 'UNPAID',
    },
  });

  // Priya — PARTIAL (will be set after partial payment below)
  const priyaLedger = await prisma.ledger.create({
    data: {
      studentId: priya.id, month: MONTH, year: YEAR,
      baseAmount: 3000, totalAmount: 3000, dueDate,
      status: 'PARTIAL',
    },
  });

  // Rahul — PAID (will be set after full payment below)
  const rahulLedger = await prisma.ledger.create({
    data: {
      studentId: rahul.id, month: MONTH, year: YEAR,
      baseAmount: 3000, totalAmount: 3000, dueDate,
      status: 'PAID',
    },
  });

  console.log(`  Arjun  ledger → UNPAID   (no payments)`);
  console.log(`  Priya  ledger → PARTIAL  (₹500 of ₹3000 paid)`);
  console.log(`  Rahul  ledger → PAID     (₹3000 of ₹3000 paid)`);

  // ── 6. Payments & Receipts ─────────────────────────────────────────────────
  console.log('\n── Creating payments & receipts ────────────────────────────');

  const paymentDate = new Date(YEAR, MONTH - 1, 5);

  // Priya — ₹500 partial payment
  const priyaRcpNum = receiptNum('SEED01');
  const priyaRcpUrl = await generateReceiptPDF({
    receiptNumber  : priyaRcpNum,
    paymentId      : 'SEED-PRIYA-PARTIAL',
    studentName    : priya.name,
    admissionNumber: priya.admissionNumber,
    class          : priya.class,
    section        : priya.section,
    month          : MONTH,
    year           : YEAR,
    amount         : 500,
    paymentDate,
    paymentMethod  : 'CASH',
  });

  const priyaPayment = await prisma.payment.create({
    data: {
      ledgerId      : priyaLedger.id,
      amountPaid    : 500,
      paymentMethod : 'CASH',
      source        : 'MANUAL',
      paymentDate,
      status        : 'SUCCESS',
    },
  });

  await prisma.receipt.create({
    data: {
      paymentId    : priyaPayment.id,
      receiptNumber: priyaRcpNum,
      receiptUrl   : priyaRcpUrl,
    },
  });

  // Rahul — ₹3000 full payment
  const rahulRcpNum = receiptNum('SEED02');
  const rahulRcpUrl = await generateReceiptPDF({
    receiptNumber  : rahulRcpNum,
    paymentId      : 'SEED-RAHUL-PAID',
    studentName    : rahul.name,
    admissionNumber: rahul.admissionNumber,
    class          : rahul.class,
    section        : rahul.section,
    month          : MONTH,
    year           : YEAR,
    amount         : 3000,
    paymentDate,
    paymentMethod  : 'CASH',
  });

  const rahulPayment = await prisma.payment.create({
    data: {
      ledgerId      : rahulLedger.id,
      amountPaid    : 3000,
      paymentMethod : 'CASH',
      source        : 'MANUAL',
      paymentDate,
      status        : 'SUCCESS',
    },
  });

  await prisma.receipt.create({
    data: {
      paymentId    : rahulPayment.id,
      receiptNumber: rahulRcpNum,
      receiptUrl   : rahulRcpUrl,
    },
  });

  console.log(`  Priya  payment: ₹500  CASH  receipt=${priyaRcpNum}`);
  console.log(`  Rahul  payment: ₹3000 CASH  receipt=${rahulRcpNum}`);

  // ── 7. Summary table ───────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║              Seed Complete           ║');
  console.log('╚══════════════════════════════════════╝\n');

  console.log('USERS');
  printTable([
    { role: 'ADMIN',  email: admin.email,   password: 'admin123', id: admin.id },
    { role: 'PARENT', email: parent1.email, password: 'test123',  id: parent1.id },
    { role: 'PARENT', email: parent2.email, password: 'test123',  id: parent2.id },
  ]);

  console.log('\nSTUDENTS');
  printTable([
    { admission: 'STU001', name: 'Arjun Kumar',  class: '5A', parent: 'parent1', id: arjun.id },
    { admission: 'STU002', name: 'Priya Sharma', class: '6B', parent: 'parent1', id: priya.id },
    { admission: 'STU003', name: 'Rahul Singh',  class: '7C', parent: 'parent2', id: rahul.id },
  ]);

  console.log('\nFEE STRUCTURES');
  printTable([
    { class: '5', baseFee: '₹3000', lateFee: '₹100', dueDay: '10', id: fee5.id },
    { class: '6', baseFee: '₹3000', lateFee: '₹100', dueDay: '10', id: fee6.id },
    { class: '7', baseFee: '₹3000', lateFee: '₹100', dueDay: '10', id: fee7.id },
  ]);

  console.log('\nLEDGERS');
  printTable([
    { student: 'Arjun',  month: `${MONTH}/${YEAR}`, total: '₹3000', paid: '₹0',    status: 'UNPAID',  id: arjunLedger.id },
    { student: 'Priya',  month: `${MONTH}/${YEAR}`, total: '₹3000', paid: '₹500',  status: 'PARTIAL', id: priyaLedger.id },
    { student: 'Rahul',  month: `${MONTH}/${YEAR}`, total: '₹3000', paid: '₹3000', status: 'PAID',    id: rahulLedger.id },
  ]);

  console.log('\nPAYMENTS');
  printTable([
    { student: 'Priya', amount: '₹500',  method: 'CASH', status: 'SUCCESS', id: priyaPayment.id },
    { student: 'Rahul', amount: '₹3000', method: 'CASH', status: 'SUCCESS', id: rahulPayment.id },
  ]);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
