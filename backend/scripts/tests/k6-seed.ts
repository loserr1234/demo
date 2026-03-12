/**
 * k6 Load Test — Seed Script
 *
 * Creates 10 test parents + students + UNPAID ledgers for load testing.
 * Also creates a "race" ledger that two parents will try to pay simultaneously.
 * Outputs a JSON manifest that k6 scripts consume.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../../src/config/prisma';
import { signToken } from '../../src/utils/jwt';

const MANIFEST_PATH = '/tmp/k6-test-manifest.json';

interface TestParent {
  userId: string;
  email: string;
  token: string;
  studentId: string;
  studentName: string;
  ledgerId: string;
  ledgerAmount: number;
}

interface Manifest {
  parents: TestParent[];
  raceLedger: {
    ledgerId: string;
    studentId: string;
    amount: number;
    tokens: string[];   // two parent tokens that both "own" competing requests
  };
  webhookSecret: string;
  baseUrl: string;
}

async function main() {
  console.log('=== k6 Load Test Seed ===\n');

  // Clean up any previous run
  await prisma.alert.deleteMany({ where: { message: { contains: 'K6_TEST' } } });
  const oldStudents = await prisma.student.findMany({
    where: { admissionNumber: { startsWith: 'K6STU' } },
    select: { id: true },
  });
  if (oldStudents.length) {
    const ids = oldStudents.map(s => s.id);
    // Delete receipts → payments → ledgers → students → users
    const ledgers = await prisma.ledger.findMany({ where: { studentId: { in: ids } }, select: { id: true } });
    const ledgerIds = ledgers.map(l => l.id);
    if (ledgerIds.length) {
      const payments = await prisma.payment.findMany({ where: { ledgerId: { in: ledgerIds } }, select: { id: true } });
      const paymentIds = payments.map(p => p.id);
      if (paymentIds.length) {
        await prisma.receipt.deleteMany({ where: { paymentId: { in: paymentIds } } });
        await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
      }
      await prisma.ledger.deleteMany({ where: { id: { in: ledgerIds } } });
    }
    await prisma.student.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: 'k6parent' } } });
  console.log('Cleaned up previous test data');

  const passwordHash = await bcrypt.hash('test123', 10);
  const parents: TestParent[] = [];

  for (let i = 1; i <= 10; i++) {
    const email = `k6parent${i}@test.com`;
    const user = await prisma.user.create({
      data: {
        name: `K6 Parent ${i}`,
        email,
        passwordHash,
        role: 'PARENT',
      },
    });

    const student = await prisma.student.create({
      data: {
        name: `K6 Student ${i}`,
        admissionNumber: `K6STU${String(i).padStart(3, '0')}`,
        class: '5',
        section: 'A',
        parentId: user.id,
        admissionDate: new Date('2024-06-01'),
      },
    });

    const amount = 2000 + (i * 500); // vary amounts: 2500..7000
    const ledger = await prisma.ledger.create({
      data: {
        studentId: student.id,
        month: 7,
        year: 2099,
        baseAmount: amount,
        lateFee: 0,
        totalAmount: amount,
        dueDate: new Date(2099, 6, 10),
        status: 'UNPAID',
      },
    });

    const token = signToken({ userId: user.id, role: 'PARENT', email });

    parents.push({
      userId: user.id,
      email,
      token,
      studentId: student.id,
      studentName: `K6 Student ${i}`,
      ledgerId: ledger.id,
      ledgerAmount: amount,
    });

    console.log(`  Created: ${email} → ${student.name} → ledger ₹${amount}`);
  }

  // Race ledger: a separate ledger that scenario 2 will target
  const raceLedger = await prisma.ledger.create({
    data: {
      studentId: parents[0].studentId,  // belongs to parent 1
      month: 8,
      year: 2099,
      baseAmount: 3000,
      lateFee: 0,
      totalAmount: 3000,
      dueDate: new Date(2099, 7, 10),
      status: 'UNPAID',
    },
  });

  console.log(`\n  Race ledger: ${raceLedger.id} (₹3000, owned by ${parents[0].email})`);

  const manifest: Manifest = {
    parents,
    raceLedger: {
      ledgerId: raceLedger.id,
      studentId: parents[0].studentId,
      amount: 3000,
      tokens: [parents[0].token, parents[1].token],
    },
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    baseUrl: `http://localhost:${process.env.PORT || 5001}`,
  };

  const fs = await import('fs');
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to ${MANIFEST_PATH}`);
  console.log(`  ${parents.length} parents, ${parents.length} ledgers + 1 race ledger`);
  console.log('\nReady for k6.');
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
