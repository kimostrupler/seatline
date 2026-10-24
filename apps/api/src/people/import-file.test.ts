import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  MAX_XLSX_UNPACKED_BYTES,
  mapColumns,
  parseCsv,
  readPeopleFile,
  zipUnpackedSize,
} from './import-file';

describe('reading people from a spreadsheet', () => {
  it('finds the columns in English, German and French', () => {
    expect(mapColumns(['Name', 'E-Mail', 'Department', 'Job title'])).toEqual({
      name: 0,
      email: 1,
      department: 2,
      jobTitle: 3,
    });
    expect(mapColumns(['Vorname', 'Nachname', 'E-Mail-Adresse', 'Abteilung'])).toMatchObject({
      first: 0,
      last: 1,
      email: 2,
      department: 3,
    });
    // "Nom" next to "Prénom" is the last name
    expect(mapColumns(['Prénom', 'Nom', 'Courriel', 'Équipe'])).toMatchObject({
      first: 0,
      last: 1,
      email: 2,
      department: 3,
    });
    expect(mapColumns(['Nom', 'Adresse e-mail'])).toMatchObject({ name: 0, email: 1 });
  });

  it('reads CSV with ; or , and quoted cells', () => {
    expect(parseCsv('a;b\r\n"x; y";"say ""hi"""\n')).toEqual([
      ['a', 'b'],
      ['x; y', 'say "hi"'],
    ]);
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('checks each row and joins first and last names', async () => {
    const csv = Buffer.from(
      'Vorname;Nachname;E-Mail;Abteilung\nMia;Schmid;MIA@Firma.ch;Sales\n;;;\nNoah;;kein-mail;\n;;ohne@name.ch;\n',
    );
    expect(await readPeopleFile(csv, 'people.csv')).toEqual([
      {
        line: 2,
        displayName: 'Mia Schmid',
        email: 'mia@firma.ch',
        department: 'Sales',
        jobTitle: null,
        problem: null,
      },
      expect.objectContaining({ line: 4, displayName: 'Noah', problem: 'bad_email' }),
      expect.objectContaining({ line: 5, email: 'ohne@name.ch', problem: 'no_name' }),
    ]);
  });

  it('reads Windows (Excel) CSV with umlauts', async () => {
    const csv = Buffer.from('Name;E-Mail\nJürg Müller;juerg@firma.ch\n', 'latin1');
    expect((await readPeopleFile(csv, 'p.csv'))[0]?.displayName).toBe('Jürg Müller');
  });

  it('reads Excel files', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('People');
    sheet.addRow(['Full name', 'Email', 'Team']);
    sheet.addRow(['Léa Favre', { text: 'lea@firma.ch', hyperlink: 'mailto:lea@firma.ch' }, 'IT']);
    const file = Buffer.from(await book.xlsx.writeBuffer());
    expect(await readPeopleFile(file, 'people.xlsx')).toEqual([
      expect.objectContaining({
        displayName: 'Léa Favre',
        email: 'lea@firma.ch',
        department: 'IT',
      }),
    ]);
  });

  it('explains files it can’t use', async () => {
    await expect(
      readPeopleFile(Buffer.from('Vorname;Ort\nMia;Bern'), 'x.csv'),
    ).rejects.toMatchObject({
      response: { code: 'no_columns' },
    });
    await expect(readPeopleFile(Buffer.from('xx'), 'old.xls')).rejects.toMatchObject({
      response: { code: 'bad_format' },
    });
  });

  it('refuses an Excel file that unpacks to too much (zip bomb) before inflating it', async () => {
    const book = new ExcelJS.Workbook();
    book.addWorksheet('People').addRow(['Name', 'E-Mail']);
    const real = Buffer.from(await book.xlsx.writeBuffer());
    const size = zipUnpackedSize(real);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(1024 * 1024);

    // the same file with one entry claiming 3 GB uncompressed in the central directory
    const bomb = Buffer.from(real);
    const end = bomb.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const first = bomb.readUInt32LE(end + 16);
    bomb.writeUInt32LE(3 * 1024 ** 3, first + 24);
    expect(zipUnpackedSize(bomb)).toBeGreaterThan(MAX_XLSX_UNPACKED_BYTES);
    await expect(readPeopleFile(bomb, 'people.xlsx')).rejects.toMatchObject({
      response: { code: 'too_many' },
    });
    // not a zip at all → "infinite"
    expect(zipUnpackedSize(Buffer.from('PK\x03\x04 nope'))).toBe(Infinity);
  });
});
