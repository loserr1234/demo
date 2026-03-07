import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface ReceiptData {
  receiptNumber: string;
  paymentId: string;
  studentName: string;
  admissionNumber: string;
  class: string;
  section: string;
  month: number;
  year: number;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const generateReceiptPDF = async (data: ReceiptData): Promise<string> => {
  const receiptsDir = process.env.RECEIPTS_DIR || './receipts';

  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }

  const fileName = `receipt_${data.receiptNumber}.pdf`;
  const filePath = path.join(receiptsDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Header background
    doc.rect(0, 0, 612, 120).fill('#1e3a5f');

    // School name
    doc.fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(28)
      .text('VIDYA SCHOOL', 50, 30, { align: 'center' });

    doc.fillColor('#a8c4e8')
      .font('Helvetica')
      .fontSize(12)
      .text('Excellence in Education Since 2000', 50, 65, { align: 'center' });

    doc.fillColor('#ffffff')
      .fontSize(10)
      .text('123 School Road, Education City | Phone: +91 98765 43210 | info@vidyaschool.edu', 50, 90, { align: 'center' });

    // Receipt title
    doc.rect(0, 120, 612, 45).fill('#f0f7ff');
    doc.fillColor('#1e3a5f')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('FEE PAYMENT RECEIPT', 50, 133, { align: 'center' });

    // Receipt details box
    doc.rect(50, 185, 512, 60).fill('#f8fafc').stroke('#e2e8f0');

    doc.fillColor('#64748b')
      .font('Helvetica')
      .fontSize(10)
      .text('Receipt Number', 70, 198);
    doc.fillColor('#1e293b')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(data.receiptNumber, 70, 213);

    doc.fillColor('#64748b')
      .font('Helvetica')
      .fontSize(10)
      .text('Payment Date', 280, 198);
    doc.fillColor('#1e293b')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(data.paymentDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), 280, 213);

    // Student Info Section
    doc.fillColor('#1e3a5f')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('STUDENT INFORMATION', 50, 270);

    doc.moveTo(50, 287).lineTo(562, 287).strokeColor('#3b82f6').lineWidth(2).stroke();

    const studentFields = [
      { label: 'Student Name', value: data.studentName },
      { label: 'Admission Number', value: data.admissionNumber },
      { label: 'Class & Section', value: `${data.class} - ${data.section}` },
    ];

    let yPos = 300;
    studentFields.forEach((field) => {
      doc.fillColor('#64748b').font('Helvetica').fontSize(10).text(field.label, 70, yPos);
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(11).text(field.value, 280, yPos);
      yPos += 25;
    });

    // Fee Details Section
    doc.fillColor('#1e3a5f')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('FEE DETAILS', 50, yPos + 15);

    doc.moveTo(50, yPos + 32).lineTo(562, yPos + 32).strokeColor('#3b82f6').lineWidth(2).stroke();

    yPos += 45;
    const feeFields = [
      { label: 'Month', value: `${MONTHS[data.month - 1]} ${data.year}` },
      { label: 'Payment Method', value: data.paymentMethod },
      { label: 'Payment ID', value: data.paymentId.substring(0, 20) + '...' },
    ];

    feeFields.forEach((field) => {
      doc.fillColor('#64748b').font('Helvetica').fontSize(10).text(field.label, 70, yPos);
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(11).text(field.value, 280, yPos);
      yPos += 25;
    });

    // Amount Box
    yPos += 20;
    doc.rect(50, yPos, 512, 70).fill('#1e3a5f');
    doc.fillColor('#a8c4e8')
      .font('Helvetica')
      .fontSize(13)
      .text('AMOUNT PAID', 50, yPos + 15, { align: 'center' });
    doc.fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(28)
      .text(`₹ ${data.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 50, yPos + 35, { align: 'center' });

    // Footer
    yPos += 100;
    doc.moveTo(50, yPos).lineTo(562, yPos).strokeColor('#e2e8f0').lineWidth(1).stroke();

    doc.fillColor('#16a34a')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('✓ Payment Received Successfully', 50, yPos + 15, { align: 'center' });

    doc.fillColor('#94a3b8')
      .font('Helvetica')
      .fontSize(9)
      .text('This is a computer-generated receipt and does not require a signature.', 50, yPos + 35, { align: 'center' });

    doc.fillColor('#94a3b8')
      .fontSize(9)
      .text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 50, yPos + 50, { align: 'center' });

    doc.end();

    stream.on('finish', () => resolve(`/receipts/${fileName}`));
    stream.on('error', reject);
  });
};
