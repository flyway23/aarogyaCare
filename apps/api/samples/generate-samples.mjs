import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const dir = path.dirname(fileURLToPath(import.meta.url));
function pdf(lines) {
  const commands = lines
    .map(
      (line, i) =>
        `${i ? '0 -18 Td ' : ''}(${line.replace(/[\\()]/g, (c) => `\\${c}`)}) Tj`,
    )
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(`BT /F1 12 Tf 50 740 Td ${commands} ET`)} >>\nstream\nBT /F1 12 Tf 50 740 Td ${commands} ET\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'ascii');
}
const samples = {
  'fake-prescription.pdf': [
    'AAROGYACARE DEMO - FICTIONAL',
    'Prescription',
    'Date: 2026-10-12',
    'Paracetamol 500 mg tablet twice daily',
  ],
  'fake-lab-report.pdf': [
    'AAROGYACARE DEMO - FICTIONAL',
    'LAB REPORT',
    'Date: 2026-10-13',
    'Hemoglobin 9.2 g/dL range 12-16',
    'HbA1c 5.4 percent',
  ],
  'fake-bill.pdf': [
    'AAROGYACARE DEMO - FICTIONAL',
    'INVOICE',
    'Date: 2026-10-14',
    'Consultation fee Rs. 800',
    'Total amount: Rs. 800',
  ],
};
for (const [name, lines] of Object.entries(samples))
  await writeFile(path.join(dir, name), pdf(lines));
