import type { Language } from '@/lib/locales';
import { helpPath } from '.';

/** The free Excel seating-plan template (files made by apps/api/scripts/seating-template.mjs). */
export const templatePath = (language: Language) => `${helpPath(language)}/excel-template`;

export const TEMPLATE: Record<
  Language,
  {
    file: string;
    title: string;
    metaTitle: string;
    intro: string;
    download: string;
    size: string;
    inside: string;
    sheets: { name: string; body: string }[];
    laterTitle: string;
    later: string;
    tryDemo: string;
    faq: { q: string; a: string }[];
  }
> = {
  en: {
    file: 'seatline-seating-plan.xlsx',
    title: 'Free Excel seating plan template',
    metaTitle: 'Free Excel seating plan template for offices | Seatline',
    intro:
      'Keep track of who sits where with a simple Excel file: people, desks and free places at a glance. Free, no sign-up, in English, German and French.',
    download: 'Download the template (.xlsx)',
    size: 'Excel file, 10 KB. Works in Excel, Numbers and LibreOffice.',
    inside: 'What’s inside',
    sheets: [
      {
        name: 'Seating plan',
        body: 'One row per person: name, e-mail, team, job title and the desk they sit at.',
      },
      {
        name: 'Desks',
        body: 'One row per desk. Pick free, taken, reserved or blocked from a list; the row takes the colour. The counts at the top update by themselves.',
      },
      { name: 'How to use', body: 'Three short steps, and how to move to Seatline later.' },
    ],
    laterTitle: 'When Excel gets too small',
    later:
      'Once people move often, a spreadsheet goes out of date fast. Seatline shows the seating plan on your floor plan, keeps every move in the history and plans moves ahead. The template’s “Seating plan” sheet imports as it is: People › Import list.',
    tryDemo: 'Try the demo',
    faq: [
      {
        q: 'Is the template really free?',
        a: 'Yes. Download it, change it and use it as you like. No sign-up and no e-mail address needed.',
      },
      {
        q: 'Can I import the template into Seatline?',
        a: 'Yes. In Seatline open People › Import list and choose the file. Name and e-mail are enough; team and job title come along too.',
      },
    ],
  },
  de: {
    file: 'seatline-sitzplan.xlsx',
    title: 'Gratis Excel-Vorlage für den Sitzplan',
    metaTitle: 'Sitzplan Büro: gratis Excel-Vorlage | Seatline',
    intro:
      'Behalten Sie mit einer einfachen Excel-Datei den Überblick, wer wo sitzt: Personen, Plätze und freie Plätze auf einen Blick. Gratis, ohne Anmeldung, auf Deutsch, Französisch und Englisch.',
    download: 'Vorlage herunterladen (.xlsx)',
    size: 'Excel-Datei, 10 KB. Läuft in Excel, Numbers und LibreOffice.',
    inside: 'Das ist drin',
    sheets: [
      {
        name: 'Sitzplan',
        body: 'Eine Zeile pro Person: Name, E-Mail, Team, Funktion und ihr Platz.',
      },
      {
        name: 'Plätze',
        body: 'Eine Zeile pro Platz. Wählen Sie frei, besetzt, reserviert oder gesperrt aus einer Liste; die Zeile nimmt die Farbe an. Die Zahlen oben rechnen sich selbst.',
      },
      { name: 'Anleitung', body: 'Drei kurze Schritte, und wie Sie später zu Seatline wechseln.' },
    ],
    laterTitle: 'Wenn Excel zu klein wird',
    later:
      'Sobald oft umgezogen wird, ist eine Tabelle schnell veraltet. Seatline zeigt den Sitzplan auf Ihrem Grundriss, hält jeden Umzug in der Historie fest und plant Umzüge im Voraus. Das Blatt «Sitzplan» der Vorlage lässt sich direkt importieren: Personen › Liste importieren.',
    tryDemo: 'Demo ausprobieren',
    faq: [
      {
        q: 'Ist die Vorlage wirklich gratis?',
        a: 'Ja. Laden Sie sie herunter, passen Sie sie an und nutzen Sie sie, wie Sie möchten. Ohne Anmeldung und ohne E-Mail-Adresse.',
      },
      {
        q: 'Kann ich die Vorlage in Seatline importieren?',
        a: 'Ja. Öffnen Sie in Seatline Personen › Liste importieren und wählen Sie die Datei. Name und E-Mail genügen; Team und Funktion kommen mit.',
      },
    ],
  },
  fr: {
    file: 'seatline-plan-de-bureau.xlsx',
    title: 'Modèle Excel gratuit de plan de bureau',
    metaTitle: 'Plan de bureau : modèle Excel gratuit | Seatline',
    intro:
      'Suivez qui est assis où avec un simple fichier Excel : collaborateurs, places et places libres en un coup d’œil. Gratuit, sans inscription, en français, allemand et anglais.',
    download: 'Télécharger le modèle (.xlsx)',
    size: 'Fichier Excel, 10 Ko. Fonctionne dans Excel, Numbers et LibreOffice.',
    inside: 'Ce qu’il contient',
    sheets: [
      {
        name: 'Plan de bureau',
        body: 'Une ligne par personne : nom, e-mail, équipe, fonction et sa place.',
      },
      {
        name: 'Places',
        body: 'Une ligne par place. Choisissez libre, occupée, réservée ou bloquée dans une liste ; la ligne prend la couleur. Les totaux en haut se calculent tout seuls.',
      },
      {
        name: 'Mode d’emploi',
        body: 'Trois étapes courtes, et comment passer à Seatline plus tard.',
      },
    ],
    laterTitle: 'Quand Excel ne suffit plus',
    later:
      'Dès que les déménagements sont fréquents, un tableau est vite dépassé. Seatline montre le plan sur votre plan d’étage, garde chaque déménagement dans l’historique et planifie les déménagements à l’avance. La feuille « Plan de bureau » du modèle s’importe telle quelle : Personnes › Importer une liste.',
    tryDemo: 'Essayer la démo',
    faq: [
      {
        q: 'Le modèle est-il vraiment gratuit ?',
        a: 'Oui. Téléchargez-le, adaptez-le et utilisez-le comme vous voulez. Sans inscription et sans adresse e-mail.',
      },
      {
        q: 'Puis-je importer le modèle dans Seatline ?',
        a: 'Oui. Dans Seatline, ouvrez Personnes › Importer une liste et choisissez le fichier. Le nom et l’e-mail suffisent ; l’équipe et la fonction suivent.',
      },
    ],
  },
};
