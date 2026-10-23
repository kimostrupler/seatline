/**
 * Builds the free Excel seating-plan templates for the website (one per language):
 *   node scripts/seating-template.mjs   → apps/web/public/templates/*.xlsx
 * Sheet 1 (people) uses column titles the people import understands, so a filled-in template
 * imports straight into Seatline (test/seating-template.test.ts checks it).
 */
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../../web/public/templates/', import.meta.url));

const TEMPLATES = {
  en: {
    file: 'seatline-seating-plan.xlsx',
    people: 'Seating plan',
    peopleCols: [
      'First name',
      'Last name',
      'E-mail',
      'Team',
      'Job title',
      'Building',
      'Floor',
      'Desk',
      'Since',
      'Note',
    ],
    desks: 'Desks',
    deskCols: ['Building', 'Floor', 'Room', 'Desk', 'Status', 'Person', 'Note'],
    status: ['Free', 'Taken', 'Reserved', 'Blocked'],
    summary: ['Desks', 'Free', 'Taken', 'Reserved'],
    help: 'How to use',
    lines: [
      'Seating plan template by Seatline (seatline.ch), free to use.',
      '',
      '1. "Seating plan": one row per person, with the desk they sit at.',
      '2. "Desks": one row per desk. Pick the status from the list; the colour follows it.',
      '3. The counts at the top of "Desks" update by themselves.',
      '',
      'Moving to Seatline later? The "Seating plan" sheet imports as it is:',
      'People › Import list › choose this file. Name and e-mail are enough.',
    ],
  },
  de: {
    file: 'seatline-sitzplan.xlsx',
    people: 'Sitzplan',
    peopleCols: [
      'Vorname',
      'Nachname',
      'E-Mail',
      'Team',
      'Funktion',
      'Gebäude',
      'Stockwerk',
      'Platz',
      'Seit',
      'Notiz',
    ],
    desks: 'Plätze',
    deskCols: ['Gebäude', 'Stockwerk', 'Raum', 'Platz', 'Status', 'Person', 'Notiz'],
    status: ['Frei', 'Besetzt', 'Reserviert', 'Gesperrt'],
    summary: ['Plätze', 'Frei', 'Besetzt', 'Reserviert'],
    help: 'Anleitung',
    lines: [
      'Sitzplan-Vorlage von Seatline (seatline.ch), gratis.',
      '',
      '1. «Sitzplan»: eine Zeile pro Person, mit ihrem Platz.',
      '2. «Plätze»: eine Zeile pro Platz. Wählen Sie den Status aus der Liste; die Farbe passt sich an.',
      '3. Die Zahlen oben in «Plätze» rechnen sich selbst.',
      '',
      'Später zu Seatline wechseln? Das Blatt «Sitzplan» lässt sich direkt importieren:',
      'Personen › Liste importieren › diese Datei wählen. Name und E-Mail genügen.',
    ],
  },
  fr: {
    file: 'seatline-plan-de-bureau.xlsx',
    people: 'Plan de bureau',
    peopleCols: [
      'Prénom',
      'Nom',
      'E-mail',
      'Équipe',
      'Fonction',
      'Bâtiment',
      'Étage',
      'Place',
      'Depuis',
      'Remarque',
    ],
    desks: 'Places',
    deskCols: ['Bâtiment', 'Étage', 'Salle', 'Place', 'Statut', 'Personne', 'Remarque'],
    status: ['Libre', 'Occupée', 'Réservée', 'Bloquée'],
    summary: ['Places', 'Libres', 'Occupées', 'Réservées'],
    help: 'Mode d’emploi',
    lines: [
      'Modèle de plan de bureau par Seatline (seatline.ch), gratuit.',
      '',
      '1. « Plan de bureau » : une ligne par personne, avec sa place.',
      '2. « Places » : une ligne par place. Choisissez le statut dans la liste ; la couleur suit.',
      '3. Les totaux en haut de « Places » se calculent tout seuls.',
      '',
      'Vous passez à Seatline plus tard ? La feuille « Plan de bureau » s’importe telle quelle :',
      'Personnes › Importer une liste › choisir ce fichier. Le nom et l’e-mail suffisent.',
    ],
  },
};

// the map's seat colours (light theme): free green, taken grey, reserved yellow, blocked red
const FILLS = ['FFDCFCE7', 'FFE5E7EB', 'FFFEF3C7', 'FFFEE2E2'];
const ROWS = 200;
const header = (row) => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  row.height = 20;
};

for (const t of Object.values(TEMPLATES)) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Seatline';
  book.created = book.modified = new Date('2026-10-29T00:00:00Z'); // same bytes on every run

  const people = book.addWorksheet(t.people, { views: [{ state: 'frozen', ySplit: 1 }] });
  const widths = [14, 16, 28, 16, 20, 14, 10, 10, 12, 24];
  people.columns = t.peopleCols.map((h, i) => ({ header: h, width: widths[i] }));
  header(people.getRow(1));
  people.autoFilter = { from: 'A1', to: { row: 1, column: t.peopleCols.length } };
  people.getColumn(9).numFmt = 'dd.mm.yyyy';

  const desks = book.addWorksheet(t.desks, { views: [{ state: 'frozen', ySplit: 3 }] });
  desks.columns = [14, 10, 16, 10, 14, 22, 24].map((width) => ({ width }));
  // row 1: counts that update themselves; row 3: column titles
  const status = `E4:E${ROWS + 3}`;
  const counts = [
    `COUNTA(D4:D${ROWS + 3})`,
    ...t.status.slice(0, 3).map((s) => `COUNTIF(${status},"${s}")`),
  ];
  t.summary.forEach((label, i) => {
    const name = desks.getCell(1, i * 2 + 1);
    name.value = label;
    name.font = { color: { argb: 'FF6B7280' } };
    const value = desks.getCell(1, i * 2 + 2);
    value.value = { formula: counts[i], result: 0 };
    value.font = { bold: true, size: 14 };
  });
  desks.getRow(3).values = t.deskCols;
  header(desks.getRow(3));
  desks.autoFilter = { from: 'A3', to: { row: 3, column: t.deskCols.length } };
  for (let r = 4; r <= ROWS + 3; r++)
    desks.getCell(r, 5).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${t.status.join(',')}"`],
    };
  desks.addConditionalFormatting({
    ref: `A4:G${ROWS + 3}`,
    rules: t.status.map((s, i) => ({
      type: 'expression',
      priority: i + 1,
      formulae: [`$E4="${s}"`],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: FILLS[i] } } },
    })),
  });

  const help = book.addWorksheet(t.help);
  help.getColumn(1).width = 100;
  t.lines.forEach((line, i) => (help.getCell(i + 1, 1).value = line));
  help.getCell(1, 1).font = { bold: true, size: 14 };

  await book.xlsx.writeFile(OUT + t.file);
  console.log('wrote', t.file);
}
