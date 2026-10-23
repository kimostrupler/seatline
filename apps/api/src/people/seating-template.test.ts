import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPeopleFile } from './import-file';

// the free templates on the website (scripts/seating-template.mjs) must import as they are
const DIR = join(__dirname, '../../../web/public/templates');

describe('free seating-plan templates', () => {
  it.each(['seatline-seating-plan.xlsx', 'seatline-sitzplan.xlsx', 'seatline-plan-de-bureau.xlsx'])(
    '%s imports into Seatline once filled in',
    async (file) => {
      const book = new ExcelJS.Workbook();
      await book.xlsx.load((await readFile(join(DIR, file))) as unknown as ArrayBuffer);
      book.worksheets[0]!.addRow([
        'Anna',
        'Keller',
        'anna@example.ch',
        'Finance',
        'Controller',
        'HQ',
        '1',
        '1.01',
      ]);
      const filled = Buffer.from(await book.xlsx.writeBuffer());
      expect(await readPeopleFile(filled, file)).toEqual([
        {
          line: 2,
          displayName: 'Anna Keller',
          email: 'anna@example.ch',
          department: 'Finance',
          jobTitle: 'Controller',
          problem: null,
        },
      ]);
    },
  );
});
