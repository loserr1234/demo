import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminHash = await bcrypt.hash('admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vidyaschool.edu' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@vidyaschool.edu',
      passwordHash: adminHash,
      role: 'ADMIN',
      phone: '9876543210',
    },
  });
  console.log('✅ Admin created:', admin.email);

  // Create fee structures
  const classes = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  for (const cls of classes) {
    const baseFee = parseInt(cls) <= 5 ? 2500 : parseInt(cls) <= 8 ? 3000 : 3500;
    await prisma.feeStructure.upsert({
      where: { id: `fee-class-${cls}` },
      update: {},
      create: {
        id: `fee-class-${cls}`,
        class: cls,
        baseFee,
        lateFeeAmount: 100,
        dueDayOfMonth: 10,
      },
    });
  }
  console.log('✅ Fee structures created');

  // Create sample parents and students
  const parentHash = await bcrypt.hash('parent@123', 12);

  const parents = [
    { name: 'Rajesh Kumar', email: 'rajesh@example.com', phone: '9876543211' },
    { name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543212' },
    { name: 'Suresh Patel', email: 'suresh@example.com', phone: '9876543213' },
  ];

  const studentData = [
    { name: 'Arjun Kumar', admissionNumber: 'ADM2024001', class: '8', section: 'A', parentIdx: 0 },
    { name: 'Kavya Kumar', admissionNumber: 'ADM2024002', class: '5', section: 'B', parentIdx: 0 },
    { name: 'Rohit Sharma', admissionNumber: 'ADM2024003', class: '10', section: 'A', parentIdx: 1 },
    { name: 'Ananya Patel', admissionNumber: 'ADM2024004', class: '7', section: 'C', parentIdx: 2 },
  ];

  const parentRecords: { id: string }[] = [];
  for (const p of parents) {
    const parent = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        name: p.name,
        email: p.email,
        passwordHash: parentHash,
        role: 'PARENT',
        phone: p.phone,
      },
    });
    parentRecords.push(parent);
  }

  const now = new Date();
  for (const s of studentData) {
    const existing = await prisma.student.findUnique({ where: { admissionNumber: s.admissionNumber } });
    if (!existing) {
      const student = await prisma.student.create({
        data: {
          name: s.name,
          admissionNumber: s.admissionNumber,
          class: s.class,
          section: s.section,
          parentId: parentRecords[s.parentIdx].id,
          admissionDate: new Date('2024-06-01'),
          status: 'ACTIVE',
        },
      });

      // Create ledgers for last 3 months
      for (let i = 2; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const dueDate = new Date(year, month - 1, 10);
        const feeStructure = await prisma.feeStructure.findFirst({ where: { class: s.class } });
        const baseFee = feeStructure?.baseFee || 3000;

        const isPast = i > 0;
        const lateFee = isPast && new Date() > dueDate ? 100 : 0;

        await prisma.ledger.create({
          data: {
            studentId: student.id,
            month,
            year,
            baseAmount: baseFee,
            lateFee,
            totalAmount: baseFee + lateFee,
            dueDate,
            status: i === 2 ? 'PAID' : i === 1 ? 'UNPAID' : 'UNPAID',
          },
        });
      }
    }
  }

  console.log('✅ Students and ledgers created');
  console.log('\n📋 Login Credentials:');
  console.log('Admin: admin@vidyaschool.edu / admin@123');
  console.log('Parents: rajesh@example.com / parent@123');
  console.log('         priya@example.com / parent@123');
  console.log('         suresh@example.com / parent@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
