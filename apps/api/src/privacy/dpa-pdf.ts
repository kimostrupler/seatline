import { DPA, fillLegal, LEGAL_UPDATED, type LegalLanguage } from '@seatline/shared/dist/legal';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const TEXT = {
  en: {
    title: 'Data processing agreement (DPA)',
    customer: 'Customer (controller)',
    accepted: (who: string, date: string) =>
      `Concluded electronically as part of the terms of service. Copy requested on ${date} by ${who}. Under Swiss law (nDSG) and GDPR art. 28(9) it is valid without a handwritten signature.`,
    version: `Version of ${LEGAL_UPDATED}`,
    page: (n: number, of: number) => `Page ${n} of ${of}`,
  },
  de: {
    title: 'Auftragsverarbeitungsvertrag (AVV)',
    customer: 'Kunde (Verantwortlicher)',
    accepted: (who: string, date: string) =>
      `Elektronisch als Teil der Nutzungsbedingungen abgeschlossen. Kopie angefordert am ${date} von ${who}. Nach Schweizer Recht (nDSG) und Art. 28 Abs. 9 DSGVO gilt er ohne handschriftliche Unterschrift.`,
    version: `Fassung vom ${LEGAL_UPDATED}`,
    page: (n: number, of: number) => `Seite ${n} von ${of}`,
  },
  fr: {
    title: 'Accord de sous-traitance (DPA)',
    customer: 'Client (responsable du traitement)',
    accepted: (who: string, date: string) =>
      `Conclu par voie électronique dans le cadre des conditions d’utilisation. Copie demandée le ${date} par ${who}. Selon le droit suisse (nLPD) et l’art. 28, par. 9 RGPD, il est valable sans signature manuscrite.`,
    version: `Version du ${LEGAL_UPDATED}`,
    page: (n: number, of: number) => `Page ${n} sur ${of}`,
  },
};

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56;

/**
 * The DPA as a PDF for one customer: its name filled in, all sections in the reader's language,
 * and a note on how it was concluded (online, with the terms — no signature needed).
 */
export async function dpaPdf(opts: {
  language: LegalLanguage;
  company: string;
  requestedBy: string;
  date: string;
}): Promise<Uint8Array> {
  const t = TEXT[opts.language];
  const doc = await PDFDocument.create();
  doc.setTitle(`${t.title} · ${opts.company}`);
  doc.setAuthor('Seatline');
  doc.setLanguage(opts.language);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;

  const write = (text: string, font: PDFFont, size: number, gapAfter: number, grey = false) => {
    for (const line of wrap(safe(text, font), font, size, A4.w - 2 * MARGIN)) {
      if (y < MARGIN + size + 20) {
        page = doc.addPage([A4.w, A4.h]);
        y = A4.h - MARGIN;
      }
      page.drawText(line, {
        x: MARGIN,
        y: y - size,
        size,
        font,
        color: grey ? rgb(0.4, 0.4, 0.4) : rgb(0, 0, 0),
      });
      y -= size * 1.4;
    }
    y -= gapAfter;
  };

  write(t.title, bold, 18, 4);
  write(`Seatline · ${t.version}`, regular, 9, 14, true);
  write(t.customer, bold, 10, 0);
  write(opts.company, regular, 10, 14);
  for (const s of DPA[opts.language]) {
    write(s.heading, bold, 11, 2);
    for (const p of s.paragraphs) write(fillLegal(p), regular, 9.5, 6);
    y -= 6;
  }
  write(t.accepted(opts.requestedBy, opts.date), regular, 9, 0, true);

  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(t.page(i + 1, pages.length), {
      x: MARGIN,
      y: MARGIN / 2,
      size: 8,
      font: regular,
      color: rgb(0.5, 0.5, 0.5),
    }),
  );
  return doc.save();
}

/** Characters the standard PDF fonts can't draw (outside WinAnsi) become '?'. */
function safe(text: string, font: PDFFont): string {
  return [...text]
    .map((c) => {
      try {
        font.encodeText(c);
        return c;
      } catch {
        return '?';
      }
    })
    .join('');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
