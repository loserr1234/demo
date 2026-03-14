import cron from 'node-cron';
import prisma from '../config/prisma';
import logger from '../utils/logger';

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

  logger.info('Monthly ledger job complete', { created, month, year });
  return created;
};

// Monthly Ledger Job — runs on 1st of every month at 00:05
export const startMonthlyLedgerJob = () => {
  cron.schedule('5 0 1 * *', async () => {
    logger.info('Cron job start: monthly ledger generation');
    try {
      const now = new Date();
      await runMonthlyLedgerJob(now.getMonth() + 1, now.getFullYear());
      logger.info('Cron job complete: monthly ledger generation');
    } catch (err) {
      logger.error('Cron job failed: monthly ledger generation', { error: (err as Error).message });
    }
  });

  logger.info('Cron job scheduled: monthly ledger generation (5 0 1 * *)');
};

// Late Fee Job — runs daily at 00:30
export const startLateFeeJob = () => {
  cron.schedule('30 0 * * *', async () => {
    logger.info('Cron job start: late fee application');
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

      logger.info('Cron job complete: late fee application', { updated });
    } catch (err) {
      logger.error('Cron job failed: late fee application', { error: (err as Error).message });
    }
  });

  logger.info('Cron job scheduled: late fee application (30 0 * * *)');
};
