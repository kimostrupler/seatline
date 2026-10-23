import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { TenantDb } from '../db/tenant-db.service';
import { seatOccupancy } from '../seats/occupancy';

export type ExportLang = 'en' | 'de' | 'fr';
export type ExportFormat = 'xlsx' | 'csv';
type Cell = string | number | Date | null;

const HEADERS = {
  seating: {
    en: [
      'Building',
      'Floor',
      'Room',
      'Seat',
      'Status',
      'Person',
      'E-mail',
      'Department',
      'Job title',
      'Since',
      'Reserved for',
    ],
    de: [
      'Gebäude',
      'Stockwerk',
      'Raum',
      'Platz',
      'Status',
      'Person',
      'E-Mail',
      'Abteilung',
      'Funktion',
      'Seit',
      'Reserviert für',
    ],
    fr: [
      'Bâtiment',
      'Étage',
      'Pièce',
      'Place',
      'Statut',
      'Personne',
      'E-mail',
      'Service',
      'Fonction',
      'Depuis',
      'Réservée pour',
    ],
  },
  history: {
    en: [
      'Building',
      'Floor',
      'Seat',
      'Person',
      'E-mail',
      'Kind',
      'Reserved for',
      'From',
      'To',
      'Changed by',
      'Note',
    ],
    de: [
      'Gebäude',
      'Stockwerk',
      'Platz',
      'Person',
      'E-Mail',
      'Art',
      'Reserviert für',
      'Von',
      'Bis',
      'Geändert von',
      'Notiz',
    ],
    fr: [
      'Bâtiment',
      'Étage',
      'Place',
      'Personne',
      'E-mail',
      'Type',
      'Réservée pour',
      'Du',
      'Au',
      'Modifié par',
      'Note',
    ],
  },
} as const;

const WORDS = {
  en: {
    free: 'Free',
    taken: 'Taken',
    reserved: 'Reserved',
    blocked: 'Blocked',
    assigned: 'Assigned',
    sheet: 'Seating',
    // not "History": Excel reserves that sheet name (ExcelJS throws)
    history: 'Seat history',
  },
  de: {
    free: 'Frei',
    taken: 'Belegt',
    reserved: 'Reserviert',
    blocked: 'Gesperrt',
    assigned: 'Zugewiesen',
    sheet: 'Belegung',
    history: 'Verlauf',
  },
  fr: {
    free: 'Libre',
    taken: 'Occupée',
    reserved: 'Réservée',
    blocked: 'Bloquée',
    assigned: 'Attribuée',
    sheet: 'Occupation',
    history: 'Historique',
  },
} as const;

/** "2026-10-21" in Swiss time (CSV); Excel gets real dates. */
const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });

/** Quote a CSV field when needed; neutralise values Excel would run as formulas. */
export function csvField(value: Cell, sep: string): string {
  if (value === null) return '';
  let text = value instanceof Date ? day(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /["\n\r]/.test(text) || text.includes(sep) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Exports for Excel: the current seating and the seat history. Exports contain personal data,
 * so each one is recorded in the audit log.
 */
@Injectable()
export class ExportsService {
  constructor(private readonly db: TenantDb) {}

  async seating(
    ctx: RequestContext,
    opts: { lang: ExportLang; format: ExportFormat; buildingId?: string; floorId?: string },
  ) {
    const w = WORDS[opts.lang];
    const rows = await this.db.run(ctx.tenantId, async (tx) => {
      const seats = await tx.seat.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(opts.floorId && { floorId: opts.floorId }),
          ...(opts.buildingId && { floor: { buildingId: opts.buildingId } }),
        },
        include: {
          floor: { include: { building: true } },
          room: true,
          assignments: { where: { endAt: null }, include: { person: true } },
        },
      });
      await audit(tx, ctx, {
        action: 'export.seating',
        entityType: 'tenant',
        entityId: ctx.tenantId,
        after: {
          format: opts.format,
          floorId: opts.floorId,
          buildingId: opts.buildingId,
          rows: seats.length,
        },
      });
      return seats
        .sort(
          (a, b) =>
            a.floor.building.name.localeCompare(b.floor.building.name) ||
            a.floor.level - b.floor.level ||
            a.label.localeCompare(b.label, undefined, { numeric: true }),
        )
        .map((s): Cell[] => {
          const open = s.assignments[0];
          const status = seatOccupancy(s, open ? { kind: open.kind } : null);
          const p = open?.kind === 'assigned' ? open.person : null;
          return [
            s.floor.building.name,
            s.floor.name,
            s.room?.name ?? null,
            s.label,
            w[status],
            p?.displayName ?? null,
            p?.email ?? null,
            p?.department ?? null,
            p?.jobTitle ?? null,
            open?.startAt ?? null,
            open?.kind === 'reserved' ? (open.reservedFor ?? null) : null,
          ];
        });
    });
    return this.file(HEADERS.seating[opts.lang], rows, opts.format, opts.lang, w.sheet, 'seating');
  }

  async history(ctx: RequestContext, opts: { lang: ExportLang; format: ExportFormat }) {
    const w = WORDS[opts.lang];
    const rows = await this.db.run(
      ctx.tenantId,
      async (tx) => {
        const items = await tx.seatAssignment.findMany({
          where: { tenantId: ctx.tenantId },
          include: {
            seat: { include: { floor: { include: { building: true } } } },
            person: true,
            assignedBy: true,
          },
          orderBy: { startAt: 'desc' },
        });
        await audit(tx, ctx, {
          action: 'export.history',
          entityType: 'tenant',
          entityId: ctx.tenantId,
          after: { format: opts.format, rows: items.length },
        });
        return items.map((a): Cell[] => [
          a.seat.floor.building.name,
          a.seat.floor.name,
          a.seat.label,
          a.person?.displayName ?? null,
          a.person?.email ?? null,
          a.kind === 'reserved' ? w.reserved : w.assigned,
          a.reservedFor,
          a.startAt,
          a.endAt,
          a.assignedBy.displayName,
          a.note,
        ]);
      },
      { timeoutMs: 60_000 },
    );
    return this.file(
      HEADERS.history[opts.lang],
      rows,
      opts.format,
      opts.lang,
      w.history,
      'seat-history',
    );
  }

  private async file(
    headers: readonly string[],
    rows: Cell[][],
    format: ExportFormat,
    lang: ExportLang,
    sheetName: string,
    baseName: string,
  ) {
    const name = `seatline-${baseName}-${day(new Date())}.${format}`;
    if (format === 'csv') {
      // Swiss/European Excel expects ";" — English Excel ","; the BOM makes Excel read UTF-8
      const sep = lang === 'en' ? ',' : ';';
      const text = [headers, ...rows]
        .map((r) => r.map((v) => csvField(v, sep)).join(sep))
        .join('\r\n');
      return { name, type: 'text/csv; charset=utf-8', data: Buffer.from(`﻿${text}\r\n`, 'utf8') };
    }
    const book = new ExcelJS.Workbook();
    book.creator = 'Seatline';
    const sheet = book.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.addRow([...headers]).font = { bold: true };
    for (const r of rows) sheet.addRow(r);
    sheet.columns.forEach((col, i) => {
      const longest = Math.max(headers[i]!.length, ...rows.map((r) => String(r[i] ?? '').length));
      col.width = Math.min(40, Math.max(10, longest + 2));
      if (rows.some((r) => r[i] instanceof Date)) col.numFmt = 'dd.mm.yyyy';
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    return {
      name,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: Buffer.from(await book.xlsx.writeBuffer()),
    };
  }
}
