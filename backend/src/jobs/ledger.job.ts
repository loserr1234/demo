import cron from 'node-cron';
import prisma from '../config/prisma';

// Exported so it can be called directly in tests or scripts
export const runMonthlyLedgerJob = async (month: number, year: number): Promise<number> => {
  const firstDayOfMonth = new Date(year, month - 1, 1);

  const activeStudents = await prisma.student.findMany({
    where: {
      status: 'ACTIVE',
      admissionDate: { lte: firstDayOfMonth },
    },
  });

  let created = 0;
  for (const student of activeStudents) {
    const existing = await prisma.ledger.findUnique({
      where: { studentId_month_year: { studentId: student.id, month, year } },
    });

    if (!existing) {
      const feeStructure = await prisma.feeStructure.findFirst({
        where: { class: student.class },
      });

      const baseFee = feeStructure ? Number(feeStructure.baseFee) : 3000;
      const dueDay = feeStructure?.dueDayOfMonth || 10;
      const dueDate = new Date(year, month - 1, dueDay);

      await prisma.ledger.create({
        data: {
          studentId: student.id,
          month,
          year,
          baseAmount: baseFee,
          lateFee: 0,
          totalAmount: baseFee,
          dueDate,
          status: 'UNPAID',
        },
      });
      created++;
    }
  }

  console.log(`[CRON] Monthly ledger job: created ${created} ledgers for ${month}/${year}`);
  return created;
};

// Monthly Ledger Job — runs on 1st of every month at 00:05
export const startMonthlyLedgerJob = () => {
  cron.schedule('5 0 1 * *', async () => {
    console.log('[CRON] Running monthly ledger generation job...');
    try {
      const now = new Date();
      await runMonthlyLedgerJob(now.getMonth() + 1, now.getFullYear());
    } catch (err) {
      console.error('[CRON] Monthly ledger job failed:', err);
    }
  });

  console.log('[CRON] Monthly ledger job scheduled');
};

// Late Fee Job — runs daily at 00:30
export const startLateFeeJob = () => {
  cron.schedule('30 0 * * *', async () => {
    console.log('[CRON] Running late fee job...');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Apply late fee to both UNPAID and PARTIAL ledgers that don't yet have a late fee
      const overdueLedgers = await prisma.ledger.findMany({
        where: {
          status: { in: ['UNPAID', 'PARTIAL'] },
          lateFee: 0,
          dueDate: { lt: today },
        },
        include: {
          student: true,
        },
      });

      let updated = 0;
      for (const ledger of overdueLedgers) {
        // Read lateFeeAmount from FeeStructure for the student's class
        const feeStructure = await prisma.feeStructure.findFirst({
          where: { class: ledger.student.class },
        });
        const lateFeeAmount = feeStructure ? Number(feeStructure.lateFeeAmount) : 100;

        await prisma.ledger.update({
          where: { id: ledger.id },
          data: {
            lateFee: lateFeeAmount,
            totalAmount: Number(ledger.baseAmount) + lateFeeAmount,
          },
        });
        updated++;
      }

      console.log(`[CRON] Late fee job: updated ${updated} ledgers`);
    } catch (err) {
      console.error('[CRON] Late fee job failed:', err);
    }
  });

  console.log('[CRON] Late fee job scheduled');
};
