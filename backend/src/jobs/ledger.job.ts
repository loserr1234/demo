import cron from 'node-cron';
import prisma from '../config/prisma';

// Monthly Ledger Job — runs on 1st of every month at 00:05
export const startMonthlyLedgerJob = () => {
  cron.schedule('5 0 1 * *', async () => {
    console.log('[CRON] Running monthly ledger generation job...');
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
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

          const baseFee = feeStructure?.baseFee || 3000;
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

      const overdueLedgers = await prisma.ledger.findMany({
        where: {
          status: 'UNPAID',
          lateFee: 0,
          dueDate: { lt: today },
        },
        include: {
          payments: { where: { status: 'SUCCESS' } },
        },
      });

      let updated = 0;
      for (const ledger of overdueLedgers) {
        const totalPaid = ledger.payments.reduce((s, p) => s + p.amountPaid, 0);

        if (totalPaid === 0) {
          const lateFeeAmount = 100;
          await prisma.ledger.update({
            where: { id: ledger.id },
            data: {
              lateFee: lateFeeAmount,
              totalAmount: ledger.baseAmount + lateFeeAmount,
            },
          });
          updated++;
        }
      }

      console.log(`[CRON] Late fee job: updated ${updated} ledgers`);
    } catch (err) {
      console.error('[CRON] Late fee job failed:', err);
    }
  });

  console.log('[CRON] Late fee job scheduled');
};
