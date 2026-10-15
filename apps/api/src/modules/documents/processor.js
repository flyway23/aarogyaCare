import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { prisma } from '../../lib/prisma.js';

const classify = (text) => {
  const t = text.toLowerCase();
  if (/\b(rx|tablet|capsule)\b/.test(t)) return 'PRESCRIPTION';
  if (/hemoglobin|reference range|hba1c/.test(t)) return 'LAB_REPORT';
  if (/discharge/.test(t)) return 'DISCHARGE_SUMMARY';
  if (/invoice|total amount|\bbill\b/.test(t)) return 'BILL';
  if (/x-ray|mri|ct scan|ultrasound/.test(t)) return 'IMAGING';
  return 'OTHER';
};
const ocrCacheDir = fileURLToPath(
  new URL('../../../.cache/tesseract/', import.meta.url),
);
const dateRegex = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/g;
const extract = (text, type) => {
  const rows = [];
  for (const line of text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    for (const match of line.matchAll(dateRegex))
      rows.push({
        kind: 'date',
        value: match[0],
        sourceSnippet: line,
        confidence: 0.75,
        isAbnormal: false,
      });
    if (/\b\d+(?:\.\d+)?\s*(?:mg|ml)\b/i.test(line))
      rows.push({
        kind: 'medicine',
        value: line,
        sourceSnippet: line,
        confidence: 0.65,
        isAbnormal: false,
      });
    const lab = line.match(
      /^([A-Za-z][A-Za-z ]{1,30})\s+([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z/%]+)?\s+(?:range\s*)?([0-9.]+)[-–]([0-9.]+)/i,
    );
    if (lab)
      rows.push({
        kind: 'lab',
        value:
          `${lab[1].trim()}: ${lab[2]} ${lab[3] || ''} (range ${lab[4]}-${lab[5]})`.trim(),
        sourceSnippet: line,
        confidence: 0.6,
        isAbnormal:
          Number(lab[2]) < Number(lab[4]) || Number(lab[2]) > Number(lab[5]),
      });
    const amount = line.match(
      /(?:total amount|grand total|total|amount due)\s*(?::|-)?\s*(?:₹|rs\.?\s*)?([0-9,]+(?:\.\d{1,2})?)/i,
    );
    if (type === 'BILL' && amount)
      rows.push({
        kind: 'amount',
        value: amount[1],
        sourceSnippet: line,
        confidence: 0.8,
        isAbnormal: false,
      });
  }
  return rows;
};

export async function processDocument(documentId) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error('Document no longer exists');
  await prisma.document.update({
    where: { id: doc.id },
    data: { status: 'PROCESSING', failReason: null },
  });
  const buffer = await readFile(doc.storagePath);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const duplicate = await prisma.document.findFirst({
    where: { patientId: doc.patientId, sha256, id: { not: doc.id } },
  });
  if (duplicate) {
    await prisma.document.update({
      where: { id: doc.id },
      data: { sha256, status: 'FAILED', failReason: 'duplicate' },
    });
    return;
  }
  let text;
  if (doc.mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      text = (await parser.getText({ first: 10 })).text;
    } finally {
      await parser.destroy();
    }
  } else {
    await mkdir(ocrCacheDir, { recursive: true });
    const ocr = await createWorker('eng', 1, { cachePath: ocrCacheDir });
    try {
      text = (await ocr.recognize(buffer)).data.text;
    } finally {
      await ocr.terminate();
    }
  }
  const type = classify(text);
  const extractions = extract(text, type);
  await prisma.$transaction(async (tx) => {
    await tx.documentExtraction.deleteMany({ where: { documentId: doc.id } });
    await tx.timelineEvent.deleteMany({ where: { documentId: doc.id } });
    await tx.document.update({
      where: { id: doc.id },
      data: {
        sha256,
        extractedText: text,
        type,
        status: 'READY',
        failReason: null,
        extractions: { create: extractions },
      },
    });
    for (const row of extractions.filter((x) => x.kind === 'date')) {
      const date = new Date(row.value);
      if (!Number.isNaN(date.getTime()))
        await tx.timelineEvent.create({
          data: {
            patientId: doc.patientId,
            documentId: doc.id,
            eventDate: date,
            description: `${type.replaceAll('_', ' ')}: ${row.sourceSnippet}`,
          },
        });
    }
    if (doc.appointmentId) {
      const [patient, appointmentDocs] = await Promise.all([
        tx.patientProfile.findUnique({
          where: { userId: doc.patientId },
          select: { allergies: true },
        }),
        tx.document.findMany({
          where: { appointmentId: doc.appointmentId },
          include: { extractions: true },
        }),
      ]);
      const all = [
        ...appointmentDocs.flatMap((item) => item.extractions),
        ...extractions,
      ];
      const conditions =
        [...appointmentDocs.map((item) => item.extractedText), text]
          .flatMap((content) => content.split(/\r?\n/))
          .filter((line) => /diagnos|condition/i.test(line))
          .join('; ') || 'No diagnosis detected';
      const medicines =
        all
          .filter((x) => x.kind === 'medicine')
          .map((x) => x.value)
          .join('; ') || 'None detected';
      const abnormal =
        all
          .filter((x) => x.kind === 'lab' && x.isAbnormal)
          .map((x) => x.value)
          .join('; ') || 'None detected';
      const content = `Conditions/diagnoses: ${conditions}\nCurrent medicines: ${medicines}\nAllergies: ${patient?.allergies || 'None recorded'}\nAbnormal labs: ${abnormal}\nMachine-generated – verify with original documents`;
      await tx.visitSummary.upsert({
        where: { appointmentId: doc.appointmentId },
        create: {
          patientId: doc.patientId,
          appointmentId: doc.appointmentId,
          content,
        },
        update: { content },
      });
    }
  });
}
