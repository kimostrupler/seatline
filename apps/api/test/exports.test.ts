import type { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { csvField } from '../src/exports/exports.service';
import { api, appDb, createApp, createTenant, owner, resetDb, type Fixture } from './helpers';

let app: INestApplication;
let a: Fixture;
let b: Fixture;

beforeAll(async () => {
  app = await createApp();
});
afterAll(async () => {
  await app.close();
  await Promise.all([owner.$disconnect(), appDb.$disconnect()]);
});
beforeEach(async () => {
  await resetDb();
  a = await createTenant('alpha');
  b = await createTenant('beta');
  await owner.person.update({ where: { id: a.personIds[0] }, data: { department: 'Sales' } });
  await api(app)
    .post('/assignments')
    .set(a.headers)
    .send({ seatId: a.seatIds[0], personId: a.personIds[0] })
    .expect(201);
  await api(app)
    .post('/assignments/reservations')
    .set(a.headers)
    .send({ seatId: a.seatIds[1], reservedFor: 'New hire' })
    .expect(201);
});

const download = (path: string, headers: Record<string, string>) =>
  api(app)
    .get(path)
    .set(headers)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });

describe('exports', () => {
  it('seating list as Excel: one row per seat, in the chosen language', async () => {
    const res = await download('/exports/seating?format=xlsx&lang=de', a.viewerHeaders).expect(200);
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="seatline-seating-.+\.xlsx"/,
    );
    const book = new ExcelJS.Workbook();
    const bytes = res.body as Buffer;
    await book.xlsx.load(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    );
    const sheet = book.worksheets[0]!;
    const rows = sheet.getSheetValues().slice(1) as unknown[][];
    expect(rows[0]!.slice(1, 7)).toEqual([
      'Gebäude',
      'Stockwerk',
      'Raum',
      'Platz',
      'Status',
      'Person',
    ]);
    expect(rows).toHaveLength(4); // header + 3 seats
    expect(rows[1]!.slice(4, 9)).toEqual(['A1', 'Belegt', 'alpha p1', 'p1@alpha.example', 'Sales']);
    expect(rows[1]![10]).toBeInstanceOf(Date);
    expect(rows[2]!.slice(4, 6)).toEqual(['A2', 'Reserviert']);
    expect(rows[2]![11]).toBe('New hire');
    expect(rows[3]!.slice(4, 6)).toEqual(['A3', 'Frei']);
  });

  it('CSV for Swiss Excel (semicolons, UTF-8 BOM); exports are audited', async () => {
    const res = await download('/exports/seating?format=csv&lang=fr', a.headers).expect(200);
    const text = (res.body as Buffer).toString('utf8');
    expect(text.startsWith('﻿Bâtiment;Étage;Pièce;Place;Statut')).toBe(true);
    expect(text).toContain(';A1;Occupée;alpha p1;p1@alpha.example;Sales;');
    const logged = await owner.auditLog.findFirst({
      where: { tenantId: a.tenantId, action: 'export.seating' },
    });
    expect(logged?.actorId).toBe(a.adminId);
  });

  it('seat history for editors only; never another company’s data', async () => {
    await download('/exports/history?format=csv', a.viewerHeaders).expect(403);
    const res = await download('/exports/history?format=csv', a.headers).expect(200);
    const lines = (res.body as Buffer).toString('utf8').trim().split('\r\n');
    expect(lines).toHaveLength(3); // header + assignment + reservation
    const other = await download('/exports/seating?format=csv', b.headers).expect(200);
    expect((other.body as Buffer).toString('utf8')).not.toContain('alpha');
  });

  it('seat history as Excel, also for a company without any history yet', async () => {
    const res = await download('/exports/history?format=xlsx&lang=de', a.headers).expect(200);
    const book = new ExcelJS.Workbook();
    const bytes = res.body as Buffer;
    await book.xlsx.load(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    );
    expect(book.worksheets[0]!.rowCount).toBe(3);
    await download('/exports/history?format=xlsx', b.headers).expect(200);
  });

  it('CSV fields are quoted, and formulas are neutralised', () => {
    expect(csvField('Müller; Anna', ';')).toBe('"Müller; Anna"');
    expect(csvField('say "hi"', ',')).toBe('"say ""hi"""');
    expect(csvField('=HYPERLINK("x")', ';')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField(null, ';')).toBe('');
  });
});
