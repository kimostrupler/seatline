import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { z } from 'zod';

/** One person read from a spreadsheet (before checking it against the workspace). */
export interface ImportRow {
  /** row number in the file (1 = header) */
  line: number;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  problem: 'no_name' | 'bad_email' | null;
}

export const MAX_IMPORT_ROWS = 2000;
/** An .xlsx is a zip; what it unpacks to must stay far below the API's memory (2000 rows ≈ 1 MB). */
export const MAX_XLSX_UNPACKED_BYTES = 50 * 1024 * 1024;

type Field = 'name' | 'first' | 'last' | 'email' | 'department' | 'jobTitle';

/** Column titles we recognise (en, de, fr), compared without case, accents and punctuation. */
const ALIASES: Record<Field, string[]> = {
  name: [
    'name',
    'fullname',
    'displayname',
    'anzeigename',
    'vollername',
    'nomcomplet',
    'person',
    'employee',
    'mitarbeiter',
    'mitarbeitende',
    'collaborateur',
  ],
  first: ['firstname', 'givenname', 'vorname', 'prenom'],
  last: ['lastname', 'surname', 'familyname', 'nachname', 'nomdefamille'],
  email: ['email', 'mail', 'emailaddress', 'emailadresse', 'adresseemail', 'courriel', 'workemail'],
  department: ['department', 'team', 'abteilung', 'bereich', 'service', 'departement', 'equipe'],
  jobTitle: ['jobtitle', 'title', 'position', 'funktion', 'stelle', 'fonction', 'poste', 'titre'],
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const isEmail = (s: string) => z.email().safeParse(s).success;

/** Which column holds what. "Nom" next to "Prénom" is the last name, else the full name. */
export function mapColumns(header: string[]): Partial<Record<Field, number>> {
  const keys = header.map(norm);
  const out: Partial<Record<Field, number>> = {};
  for (const field of Object.keys(ALIASES) as Field[]) {
    const i = keys.findIndex((k) => ALIASES[field].includes(k));
    if (i >= 0) out[field] = i;
  }
  const nom = keys.indexOf('nom');
  if (nom >= 0) {
    if (out.first !== undefined && out.last === undefined) out.last = nom;
    else if (out.name === undefined) out.name = nom;
  }
  return out;
}

/** People from a table (first row = column titles). Empty rows are skipped. */
export function rowsFromTable(table: string[][]): ImportRow[] {
  const headerAt = table.findIndex((r) => r.some((c) => c.trim()));
  if (headerAt < 0) throw new BadRequestException({ message: 'The file is empty', code: 'empty' });
  const cols = mapColumns(table[headerAt] ?? []);
  if (
    cols.email === undefined ||
    (cols.name === undefined && cols.first === undefined && cols.last === undefined)
  )
    throw new BadRequestException({
      message: 'The file needs a column for the name and one for the e-mail address',
      code: 'no_columns',
    });
  const cell = (row: string[], f: Field) =>
    cols[f] === undefined ? '' : (row[cols[f]] ?? '').trim();
  const rows: ImportRow[] = [];
  table.slice(headerAt + 1).forEach((row, i) => {
    if (!row.some((c) => c.trim())) return;
    const displayName =
      cell(row, 'name') || [cell(row, 'first'), cell(row, 'last')].filter(Boolean).join(' ');
    const email = cell(row, 'email')
      .replace(/^mailto:/i, '')
      .toLowerCase();
    rows.push({
      line: headerAt + i + 2,
      displayName: displayName.slice(0, 200),
      email,
      department: cell(row, 'department').slice(0, 100) || null,
      jobTitle: cell(row, 'jobTitle').slice(0, 200) || null,
      problem: !displayName ? 'no_name' : !isEmail(email) ? 'bad_email' : null,
    });
  });
  if (rows.length > MAX_IMPORT_ROWS)
    throw new BadRequestException({
      message: `At most ${MAX_IMPORT_ROWS} people per file`,
      code: 'too_many',
    });
  return rows;
}

/** CSV text → table. Separator ; , or tab (whichever the header uses most); "quoted" cells. */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = [';', ',', '\t'].reduce((best, s) =>
    firstLine.split(s).length > firstLine.split(best).length ? s : best,
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && !cell) quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

/** UTF-8, or Windows-1252 (what Excel in Switzerland often saves as CSV). */
function decode(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** An Excel (.xlsx) or CSV file → people. */
export async function readPeopleFile(buffer: Buffer, filename: string): Promise<ImportRow[]> {
  const xlsx = buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])); // zip
  if (!xlsx) {
    if (/\.(xls|numbers|ods)$/i.test(filename))
      throw new BadRequestException({
        message: 'Save the file as Excel (.xlsx) or CSV first',
        code: 'bad_format',
      });
    return rowsFromTable(parseCsv(decode(buffer)));
  }
  if (zipUnpackedSize(buffer) > MAX_XLSX_UNPACKED_BYTES)
    throw new BadRequestException({ message: 'This Excel file is too big', code: 'too_many' });
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestException({
      message: 'This Excel file could not be read',
      code: 'bad_format',
    });
  }
  const sheet = book.worksheets[0];
  if (!sheet) throw new BadRequestException({ message: 'The file is empty', code: 'empty' });
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, n) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (c, col) => {
      values[col - 1] = cellText(c.value);
    });
    table[n - 1] = Array.from(values, (v) => v ?? '');
  });
  return rowsFromTable(Array.from(table, (r) => r ?? []));
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if ('text' in v && typeof v.text === 'string') return v.text; // hyperlink (mailto:)
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return v.result == null ? '' : String(v.result);
    return '';
  }
  return String(v);
}

/**
 * What a zip file unpacks to, read from its central directory (the sizes are stored there, so
 * nothing is inflated). A zip can shrink 1000:1 — 2 MB in, 2 GB out — so the upload limit
 * alone is no protection. Anything unreadable or ZIP64 counts as infinite.
 */
export function zipUnpackedSize(zip: Buffer): number {
  const EOCD = 0x06054b50;
  const ENTRY = 0x02014b50;
  // the end record sits in the last 22 bytes + a comment of up to 65535
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i--)
    if (zip.readUInt32LE(i) === EOCD) {
      end = i;
      break;
    }
  if (end < 0) return Infinity;
  const entries = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  if (entries === 0xffff || at === 0xffffffff) return Infinity; // ZIP64
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (at + 46 > zip.length || zip.readUInt32LE(at) !== ENTRY) return Infinity;
    const size = zip.readUInt32LE(at + 24);
    if (size === 0xffffffff) return Infinity; // ZIP64
    total += size;
    at += 46 + zip.readUInt16LE(at + 28) + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
  }
  return total;
}
