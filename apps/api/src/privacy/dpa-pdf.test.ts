import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { dpaPdf } from './dpa-pdf';

describe('DPA as PDF', () => {
  it('is a PDF titled for the customer, in every language', async () => {
    for (const language of ['en', 'de', 'fr'] as const) {
      const bytes = await dpaPdf({
        language,
        company: 'Zürcher Bäckerei AG',
        requestedBy: 'Anna Meier (anna@example.ch)',
        date: '23.10.2026',
      });
      expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
      const doc = await PDFDocument.load(bytes);
      expect(doc.getTitle()).toContain('Zürcher Bäckerei AG');
      expect(doc.getPageCount()).toBeGreaterThan(1);
    }
  });
});
